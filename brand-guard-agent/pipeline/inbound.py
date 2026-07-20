"""
Inbound worker  —  Channel E, the always-on parallel track

Everything else in the pipeline is outbound: find a victim, score, route, draft, send.
Channel E is the opposite direction — it catches people who come to YOU, and it closes
the loop on outbound sequences. It carries zero phishing suspicion because the person
initiated contact, so it's the highest-trust lead source you have.

Two event streams land here:

  1. REPLIES to outbound touches (email replies, LinkedIn replies, form notes).
       → classify intent in code first (opt-out keywords are deterministic and must
         never be missed), optionally refine sentiment with the local model, then:
         • opt-out  → add to the suppression list (permanent) + stop the sequence
         • reply    → stop the sequence, flag for a human in the Replies tab
       This is what guarantees "on reply or opt-out: stop + update Supabase".

  2. INBOUND LEADS (someone runs the free public "is my domain spoofed?" scan, or
     submits the contact form).
       → they consented by showing up, so they SKIP the cold-outreach gate, but they
         still DON'T get an auto-reply — they become a warm Prospect (routed_channel
         "E") queued for fast human follow-up. We never auto-send on their behalf.

Design rules:
  * Opt-out detection is deterministic and case-insensitive — no model in the path
    that could miss an unsubscribe.
  * The worker proposes actions (suppress / stop / create-warm-lead); a caller persists
    them to Supabase. Nothing here deletes data or sends anything.
  * Inbound leads are consented and high-priority, but a human still does the outreach.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

try:
    from common.models import Prospect, RawSignal, SignalTier
except ImportError:  # allow running the file directly
    Prospect = RawSignal = SignalTier = None  # type: ignore

# Deterministic opt-out / unsubscribe phrases. Matched case-insensitively against the
# reply body. Kept broad on purpose — a false "opt-out" only costs us one lead; a
# missed one is a compliance violation.
OPT_OUT_PATTERNS = (
    r"\bunsubscribe\b",
    r"\bopt[\s-]?out\b",
    r"\bremove me\b",
    r"\btake me off\b",
    r"\bstop (emailing|contacting|messaging)\b",
    r"\bdo not (contact|email|message)\b",
    r"\bdon'?t (contact|email|message) me\b",
    r"\bno longer .*(interested|contact)\b",
    r"\bplease remove\b",
)

# Light positive / negative cues for a deterministic first-pass sentiment. The LLM
# (optional) can override 'neutral' with a finer read, never the opt-out decision.
_POSITIVE_CUES = ("interested", "tell me more", "how much", "pricing", "demo",
                  "yes", "sounds good", "let's talk", "book", "call")
_NEGATIVE_CUES = ("not interested", "no thanks", "spam", "scam", "leave me alone",
                  "reported", "who are you")

INBOUND_SOURCES = {"scan", "contact_form", "public_scan", "form"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# events in
# ---------------------------------------------------------------------------
@dataclass
class InboundEvent:
    """
    One inbound thing to process. Either a reply to an outbound touch, or a fresh
    inbound lead. Keep this loose — adapt your mail/webhook payloads into it.
    """
    kind: str                                   # 'reply' | 'lead'
    source: str = "email"                       # 'email' | 'linkedin' | 'scan' | 'contact_form'
    from_address: Optional[str] = None
    from_domain: Optional[str] = None
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    body: str = ""
    prospect_domain: Optional[str] = None       # links a reply back to a known prospect
    received_at: datetime = field(default_factory=_utcnow)
    extra: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# classify a reply — opt-out is deterministic, sentiment is best-effort
# ---------------------------------------------------------------------------
def is_opt_out(text: str) -> bool:
    blob = (text or "").lower()
    return any(re.search(p, blob) for p in OPT_OUT_PATTERNS)


def classify_reply(text: str, *, use_llm: bool = False) -> dict[str, Any]:
    """
    Return {'sentiment', 'opt_out'(bool), 'method'}.
    Opt-out is decided in code and is authoritative. Sentiment is a deterministic
    first pass; if use_llm and a refinement is available it may upgrade a 'neutral'
    read, but it can never clear an opt-out.
    """
    opt = is_opt_out(text)
    if opt:
        return {"sentiment": "opt_out", "opt_out": True, "method": "rule"}

    blob = (text or "").lower()
    sentiment = "neutral"
    if any(c in blob for c in _NEGATIVE_CUES):
        sentiment = "negative"
    elif any(c in blob for c in _POSITIVE_CUES):
        sentiment = "positive"
    method = "rule"

    if use_llm and sentiment == "neutral":
        refined = _try_llm_sentiment(text)
        if refined in ("positive", "negative", "neutral"):
            sentiment, method = refined, "llm"

    return {"sentiment": sentiment, "opt_out": False, "method": method}


def _try_llm_sentiment(text: str) -> Optional[str]:
    """Optional finer sentiment via the local model. Returns None on any problem."""
    try:
        from common.llm import _chat  # lazy import; offline-safe
        import json
        out = _chat(
            system=("Classify the sentiment of a reply to a cold B2B outreach email. "
                    "Respond as JSON {\"sentiment\":\"positive|neutral|negative\"} only."),
            user=text[:1500],
            temperature=0.0,
        )
        data = json.loads(out) if isinstance(out, str) else out
        s = (data or {}).get("sentiment")
        return s if s in ("positive", "neutral", "negative") else None
    except Exception:                                    # noqa: BLE001
        return None


# ---------------------------------------------------------------------------
# handlers — each returns a list of proposed actions for the caller to persist
# ---------------------------------------------------------------------------
def handle_reply(event: InboundEvent, *, use_llm: bool = False) -> dict[str, Any]:
    """
    Process a reply. Produces actions but performs no DB writes / sends itself.
    Actions vocabulary: 'suppress', 'stop_sequence', 'set_response_status',
    'flag_for_human', 'log_reply'.
    """
    cls = classify_reply(event.body, use_llm=use_llm)
    actions: list[dict[str, Any]] = [{
        "action": "log_reply",
        "prospect_domain": event.prospect_domain or event.from_domain,
        "from": event.from_address,
        "sentiment": cls["sentiment"],
        "channel": "E",
    }]

    if cls["opt_out"]:
        if event.from_address:
            actions.append({"action": "suppress", "match_type": "email",
                            "value": event.from_address, "reason": "opt_out"})
        actions.append({"action": "set_response_status",
                        "prospect_domain": event.prospect_domain or event.from_domain,
                        "value": "opted_out"})
        actions.append({"action": "stop_sequence",
                        "prospect_domain": event.prospect_domain or event.from_domain,
                        "reason": "opt_out"})
        return {"type": "reply", "sentiment": "opt_out", "actions": actions}

    # any non-opt-out reply still stops the cadence and goes to a human
    actions.append({"action": "set_response_status",
                    "prospect_domain": event.prospect_domain or event.from_domain,
                    "value": "replied"})
    actions.append({"action": "stop_sequence",
                    "prospect_domain": event.prospect_domain or event.from_domain,
                    "reason": "got_reply"})
    actions.append({"action": "flag_for_human", "queue": "replies",
                    "priority": "high" if cls["sentiment"] == "positive" else "normal",
                    "sentiment": cls["sentiment"]})
    return {"type": "reply", "sentiment": cls["sentiment"], "actions": actions}


def handle_inbound_lead(event: InboundEvent) -> dict[str, Any]:
    """
    Someone came to us (scan / form). Build a WARM prospect: consented, so it skips
    the cold gate, routed_channel 'E', compliance_ok True (they initiated), queued
    for fast human follow-up. We still never auto-send to them.
    """
    if Prospect is None:
        return {"type": "lead", "actions": [], "prospect": None,
                "note": "models unavailable (run as a module)"}

    signals = []
    if RawSignal is not None and event.source in ("scan", "public_scan"):
        signals.append(RawSignal(
            source="inbound_scan", tier=SignalTier.PUBLIC_VICTIM,
            signal_type="inbound_scan_request",
            snippet=event.body[:500] if event.body else None,
            extra={"self_reported": True, **(event.extra or {})},
        ))

    p = Prospect(
        company_name=event.company_name,
        primary_domain=event.prospect_domain or event.from_domain,
        contact_name=event.contact_name,
        contact_channel="email" if event.from_address else None,
        signals=signals,
        routed_channel="E",
        compliance_region=(event.extra or {}).get("compliance_region", "US"),
        compliance_ok=True,            # they initiated contact
        bant_status="pass",            # inbound intent ≈ qualified to talk
        approval_status="unreviewed",  # a human still owns the follow-up
    )
    actions = [
        {"action": "upsert_prospect", "primary_domain": p.primary_domain,
         "routed_channel": "E", "source": event.source},
        {"action": "flag_for_human", "queue": "inbound_leads", "priority": "high",
         "reason": "consented inbound — fast follow-up"},
    ]
    return {"type": "lead", "actions": actions, "prospect": p}


def process_inbound(events: list[InboundEvent], *,
                    use_llm: bool = False) -> list[dict[str, Any]]:
    """Route each event to the right handler. Returns one result per event."""
    results: list[dict[str, Any]] = []
    for ev in events:
        if ev.kind == "lead" or ev.source in INBOUND_SOURCES:
            results.append(handle_inbound_lead(ev))
        else:
            results.append(handle_reply(ev, use_llm=use_llm))
    return results


# Public scan / SEO landing — the always-on capture surface (config, not runtime).
INBOUND_CAPTURE = {
    "channel": "E",
    "always_on": True,
    "surfaces": [
        "Free 'is my domain being spoofed?' public scan (no account, no card)",
        "SEO pages targeting post-incident searches "
        "('<brand> fake website', 'someone is impersonating my company')",
        "Contact form on the Brand Guard site",
    ],
    "promise": "Consented, zero phishing suspicion. A human follows up fast; never auto-sent.",
}


if __name__ == "__main__":
    if Prospect is None:
        print("Run as a module:  python -m pipeline.inbound")
        raise SystemExit(0)

    events = [
        InboundEvent(kind="reply", source="email", from_address="ceo@goodlead.com",
                     prospect_domain="goodlead.com",
                     body="This is helpful — can you tell me more about pricing?"),
        InboundEvent(kind="reply", source="email", from_address="busy@acme.com",
                     prospect_domain="acme.com",
                     body="Please unsubscribe me and remove me from your list."),
        InboundEvent(kind="reply", source="email", from_address="nope@xyz.com",
                     prospect_domain="xyz.com",
                     body="Who are you? This looks like spam."),
        InboundEvent(kind="reply", source="email", from_address="maybe@later.com",
                     prospect_domain="later.com",
                     body="Got it, thanks."),
        InboundEvent(kind="lead", source="scan", from_address="owner@warmlead.com",
                     company_name="Warm Lead Co.", contact_name="Robin Warm",
                     prospect_domain="warmlead.com",
                     body="Ran the scan — found 3 lookalike domains, worried."),
        InboundEvent(kind="lead", source="contact_form", from_address="hi@formlead.com",
                     company_name="Form Lead LLC", prospect_domain="formlead.com",
                     body="Someone is impersonating us on social. Help?"),
    ]

    print("=" * 72)
    for r in process_inbound(events, use_llm=False):
        if r["type"] == "reply":
            kinds = ", ".join(a["action"] for a in r["actions"])
            print(f"REPLY  [{r['sentiment']:8}] → {kinds}")
        else:
            p = r["prospect"]
            kinds = ", ".join(a["action"] for a in r["actions"])
            dom = p.primary_domain if p else "?"
            print(f"LEAD   [{dom:14}] warm, routed_channel={p.routed_channel if p else '?'}, "
                  f"compliance_ok={p.compliance_ok if p else '?'} → {kinds}")
    print("=" * 72)
    print("No sends, no deletes — actions are proposals for the caller to persist.")
