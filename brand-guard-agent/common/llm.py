"""
Local-model helper for the Brand Guard agent.

Wraps Ollama's chat API for the three narrow language tasks the agent needs:
  - classify_signal(): is a snippet a genuine impersonation-victim signal?
  - extract_fields():  pull structured facts from messy text
  - draft_email():     fill the legitimacy-first template (human-approved before send)

Design rules (see implementation pack §0):
  * The LLM ONLY does language tasks. Discovery / scoring / routing live in code.
  * Every call forces JSON output (format="json") and is validated here.
  * Thinking mode is OFF for high-volume classify/extract; optional for drafting.
  * Treat all output as untrusted: validate, retry once, then fail closed.

Requires a local Ollama running qwen3.5:9b:
    ollama pull qwen3.5:9b
    ollama serve            # usually already running on :11434
"""
from __future__ import annotations

import json
import urllib.request
from typing import Any, Optional

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen3.5:9b"


def _chat(system: str, user: str, *, think: bool = False,
          temperature: float = 0.0, images: Optional[list[str]] = None,
          timeout: int = 120) -> dict[str, Any]:
    """Single JSON-constrained chat call. Returns parsed dict or raises ValueError."""
    user_msg: dict[str, Any] = {"role": "user", "content": user}
    if images:                      # base64-encoded PNGs/JPEGs for the vision classifier
        user_msg["images"] = images

    payload = {
        "model": MODEL,
        "messages": [{"role": "system", "content": system}, user_msg],
        "stream": False,
        "format": "json",
        "think": think,             # qwen3.5 thinking toggle; verify your Ollama version supports it
        "options": {"temperature": temperature},
    }
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )

    def _call() -> dict[str, Any]:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        content = body.get("message", {}).get("content", "")
        return json.loads(content)

    try:
        return _call()
    except (json.JSONDecodeError, KeyError):
        # one retry, per the reliability rule
        return _call()


def classify_signal(snippet: str, source: str) -> dict[str, Any]:
    system = (
        "You classify whether a text snippet is evidence that a specific business "
        "has been impersonated, spoofed, or defrauded. Output JSON only."
    )
    user = (
        f'Snippet: """{snippet}"""\n'
        f"Source: {source}\n\n"
        'Return exactly: {"is_victim_signal": true|false, '
        '"impersonation_type": "domain"|"email"|"social"|"marketplace"|"unknown", '
        '"impersonated_brand": "<string or null>", "confidence": 0.0-1.0}'
    )
    return _chat(system, user, think=False, temperature=0.0)


def extract_fields(text: str) -> dict[str, Any]:
    system = (
        "Extract structured facts. Output JSON only. Use null if absent. "
        "Do not guess values that are not in the text."
    )
    user = (
        f'Text: """{text}"""\n\n'
        'Return: {"company_name": null, "primary_domain": null, '
        '"disputed_or_fake_domain": null, "incident_date": null}'
    )
    return _chat(system, user, think=False, temperature=0.0)


def classify_image(image_b64: str, claimed_brand: str) -> dict[str, Any]:
    """Vision classifier for screenshots of fake sites / scam-warning posts."""
    system = (
        "You analyze an image (a website screenshot or social post). Output JSON only. "
        "Do not transcribe more than is needed to classify."
    )
    user = (
        f"Context: claimed brand = {claimed_brand}\n\n"
        'Return: {"appears_to_be_scam_warning": true|false, '
        '"appears_to_be_impersonation_site": true|false, '
        '"impersonated_brand": "<string or null>", '
        '"evidence": "<one short sentence>", "confidence": 0.0-1.0}'
    )
    return _chat(system, user, images=[image_b64], think=False, temperature=0.0)


def draft_email(prospect: dict[str, Any], findings: dict[str, Any],
                channel: str, sender_block: str, think: bool = False) -> dict[str, Any]:
    system = (
        "You draft a short, credible B2B outreach message for Brand Guard, a "
        "brand-protection service. Rules: state who you are and link the real company "
        "site; reference ONLY the findings provided (never invent threats); no "
        "countdown/urgency pressure; no shortened or disguised links; offer a free "
        "self-serve scan they can run themselves; include opt-out. Output JSON."
    )
    user = (
        f"Prospect: {prospect.get('company_name')} ({prospect.get('primary_domain')}), "
        f"vertical {prospect.get('vertical')}\n"
        f"Verified findings: {json.dumps(findings)}\n"
        f"Channel: {channel}\n"
        f"Sender identity: {sender_block}\n\n"
        'Return: {"subject": "<plain, non-deceptive>", '
        '"body": "<= 120 words, credible, self-serve CTA>", '
        '"opt_out_line": "<string>"}'
    )
    return _chat(system, user, think=think, temperature=0.5)


if __name__ == "__main__":
    # smoke test — requires a running Ollama with qwen3.5:9b
    demo = classify_signal(
        "⚠️ WARNING: There is a fake account on X pretending to be Acme Tools. "
        "We are NOT affiliated with @acme_tools_support. Do not send them payment.",
        source="x_profile",
    )
    print(json.dumps(demo, indent=2))
