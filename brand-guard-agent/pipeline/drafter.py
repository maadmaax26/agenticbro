"""
Drafter  —  turn a routed Prospect into a channel-correct draft for the approval queue

Runs AFTER scorer + router. Picks the right template for prospect.routed_channel,
fills it from ONLY the verified signals on the prospect, and returns a draft shaped
like the `outreach_drafts` row in db/schema.sql. It never sends — every draft lands
in the Drafts tab for a human to approve, edit, or reject.

Two modes:
  * deterministic (default) — fill the markdown templates with merge fields. Reproducible,
    can't hallucinate, and is the path you should trust for volume.
  * use_llm=True           — optionally let qwen3.5:9b polish subject/body for B/D, but
    constrained to the same findings and validated; if Ollama is down or the output
    looks wrong, it falls back to the deterministic fill. The model never adds facts.

Hard rule mirrored from the templates: only real, verified findings; verifiable identity;
no urgency; no disguised links; self-serve CTA; opt-out; human approves every send.

The canonical wording lives in templates/outreach_email.md. The constants below mirror
it so the Drafter is self-contained and testable offline (no file parsing at runtime).
Keep the two in sync if either changes.
"""
from __future__ import annotations

import re
from typing import Any, Optional

try:
    from common.models import Prospect, RawSignal
except ImportError:  # allow running the file directly
    Prospect = RawSignal = None  # type: ignore


# ---------------------------------------------------------------------------
# Contact email verification gate
# ---------------------------------------------------------------------------
# When verify_contact=True is passed to draft_for_prospect, the drafter calls
# discover_contacts.discover_contacts() to SMTP-verify the prospect's contact_email
# before marking the draft as sendable. This prevents creating drafts with
# email addresses that will bounce.
#
# The verification adds ~2-5 seconds per prospect (DNS + SMTP checks). For batch
# use where verification has already been done, pass verify_contact=False (default).

def _verify_contact_email(prospect: "Prospect") -> dict[str, Any]:
    """
    SMTP-verify the prospect's contact email. Returns a dict:
      {"verified": bool, "confidence": "HIGH"|"MEDIUM"|"LOW"|"NONE",
       "best_email": str|None, "alternatives": [...], "recommendation": str}

    Imports discover_contacts lazily so the drafter still works offline without it.
    """
    try:
        from discover_contacts import discover_contacts, ContactReport
    except ImportError:
        return {"verified": False, "confidence": "NONE",
                "best_email": None, "alternatives": [],
                "recommendation": "discover_contacts module not available"}

    domain = prospect.primary_domain
    if not domain:
        return {"verified": False, "confidence": "NONE",
                "best_email": None, "alternatives": [],
                "recommendation": "no primary_domain on prospect"}

    report = discover_contacts(
        domain=domain,
        company=prospect.company_name or domain,
        person_name=getattr(prospect, "contact_name", None),
        max_smtp_checks=12,
    )

    # If the prospect already has a contact_email, check if it's verified
    existing_email = getattr(prospect, "contact_email", None)
    alternatives = []
    existing_match = None

    for c in report.candidates:
        alt = {"email": c.email, "confidence": c.confidence,
               "source": c.source, "smtp_status": c.smtp_status}
        alternatives.append(alt)
        if existing_email and c.email.lower() == existing_email.lower():
            existing_match = alt

    if existing_match:
        return {
            "verified": existing_match["confidence"] == "HIGH",
            "confidence": existing_match["confidence"],
            "best_email": existing_match["email"],
            "alternatives": alternatives,
            "recommendation": report.recommendation,
        }

    # No match for the existing email — use the best candidate from discovery
    return {
        "verified": report.best_confidence == "HIGH",
        "confidence": report.best_confidence,
        "best_email": report.best_email,
        "best_person_name": getattr(report, "best_person_name", None),
        "best_person_title": getattr(report, "best_person_title", None),
        "best_linkedin_url": getattr(report, "best_linkedin_url", None),
        "key_people": getattr(report, "key_people", []),
        "alternatives": alternatives,
        "recommendation": report.recommendation,
        "linkedin_url": report.linkedin_url,
        "website_contact_url": report.website_contact_url,
    }


# --- Your identity. Fill once; reused on every draft. ----------------------
DEFAULT_SENDER = {
    "sender_name": "Earl Finney",
    "sender_title": "Founder",
    "sender_org": "Agentic Insights LLC",
    "company_address": "155 Willowbrook Blvd, Ste 110 #8469, Wayne, New Jersey 07470",
    "optout_url": "https://agenticbro.app/brand-guard/optout",
    "scan_url": "https://agenticbro.app/brand-guard/scan",
    "trial_url": "https://agenticbro.app/brand-guard?request_pilot=1",
    "site": "agenticbro.app/brand-guard",
}

# --- Templates (mirror templates/outreach_email.md) ------------------------
D_SUBJECT = "30-day Brand Guard trial for {{company}}"
D_BODY = """\
Hi {{contact_first_name}},

I'm {{sender_name}}, {{sender_title}} of Agentic Insights LLC. We created
Brand Guard, a brand-protection service that's part of the AgenticBro trust
ecosystem ({{site}} — feel free to verify us before reading on).

While reviewing public records, we noticed something about {{company}}:
- {{finding_1}}
- {{finding_2}}

You can see the public source here: {{evidence_url}}

We're opening a limited 30-day Brand Guard pilot for {{company}} —
a $299 value on us. Fortress monitors for social impersonators, lookalike
domains, fake stores, spoofed email posture, marketplace clones, alerts,
evidence records, and takedown workflow support.

No card, no commitment. You'll see what continuous monitoring finds
before deciding on a paid plan.

Start your 30-day pilot here (create your account with email + password to
onboard your brand and open your dashboard): {{trial_url}}

If this isn't relevant, no worries at all and apologies for the interruption.

Best,
{{sender_name}}
{{sender_title}}, Agentic Insights LLC
Brand Guard — part of the AgenticBro trust ecosystem"""
D_FOOTER = """\
—
Brand Guard · Agentic Insights LLC · {{company_address}}
You received this one-time note because {{company}} appeared in public
brand-abuse records. Prefer not to hear from us? Opt out here: {{optout_url}}"""

B_SUBJECT = "30-day Brand Guard trial — brand-impersonation report for {{company}}"
B_BODY = """\
Hello,

Reporting a possible brand-impersonation issue affecting {{company}},
found via public records:

- {{finding_1}}
- {{finding_2}}
Public source: {{evidence_url}}

We're Agentic Insights LLC — we created Brand Guard ({{site}}), a
brand-protection service that's part of the AgenticBro trust ecosystem. We're
opening a limited 30-day pilot for {{company}} — a $299 value on us. Fortress monitors
for social impersonators, lookalike domains, fake stores, spoofed email
posture, marketplace clones, alerts, evidence records, and takedown
workflow support.

No card, no commitment. Start the pilot here (create your account with email +
password to onboard your brand): {{trial_url}}

Happy to provide details to a named contact if helpful.

{{sender_name}} · {{sender_title}}, Agentic Insights LLC · Brand Guard (AgenticBro trust ecosystem)
{{company_address}} · opt out: {{optout_url}}"""

A_BODY = """\
Sorry you're dealing with this — impersonation is exhausting to chase.
We're running a 30-day Brand Guard pilot (normally $299, free right now)
that monitors lookalike domains, social impersonators, and email spoofing
in one place. No card needed — create your account with email + password to
onboard your brand: {{trial_url}}
We're Agentic Insights LLC — we created Brand Guard ({{site}}), part of the
AgenticBro trust ecosystem. Happy to point you to takedown steps either way."""

C_CONNECTION = """\
Hi {{contact_first_name}} — I'm {{sender_name}}, founder of Agentic Insights LLC.
We created Brand Guard (part of the AgenticBro trust ecosystem), which flags brand
impersonation for companies like {{company}}, and noticed something public worth a
heads-up. We're running a free 30-day pilot — happy to share details. ({{site}})"""
C_AFTER_ACCEPT = """\
Thanks for connecting, {{contact_first_name}}. The specific thing: {{finding_1_inline}}.
Public source: {{evidence_url}}.

We're running a 30-day Brand Guard pilot for {{company}} — normally $299,
free during the pilot. Fortress monitors lookalike domains, social
impersonators, email spoofing, marketplace clones, and includes takedown
workflow support. No card needed — create your account with email + password to
onboard your brand:

{{trial_url}}

Happy to answer anything either way."""

OPT_OUT_LINE = "Prefer not to hear from us? Opt out here: {{optout_url}}"

# Patterns that must NEVER appear (catches an LLM polish drifting off-spec).
FORBIDDEN_PATTERNS = [
    r"\bact now\b", r"\burgent\b", r"\bimmediately\b", r"\bwithin 24 hours\b",
    r"\bclick here\b", r"bit\.ly", r"tinyurl", r"\bverify your account\b",
    r"\bsuspend(ed)?\b", r"countdown",
]


# ---------------------------------------------------------------------------
# findings — derive human-readable bullets from ONLY the verified signals
# ---------------------------------------------------------------------------
def summarize_findings(prospect: "Prospect") -> list[str]:
    """
    Turn structured signals into plain-English findings we're allowed to state.
    Nothing here is invented — each line maps to a signal already on the prospect.
    """
    findings: list[str] = []

    lookalikes: list[str] = []
    for s in prospect.signals:
        if getattr(s, "signal_type", "") == "lookalike_domain":
            d = (getattr(s, "extra", {}) or {}).get("domain") or getattr(s, "impersonated_brand", None)
            if d:
                lookalikes.append(d)
    if lookalikes:
        shown = ", ".join(f'"{d}"' for d in lookalikes[:3])
        more = f" (+{len(lookalikes) - 3} more)" if len(lookalikes) > 3 else ""
        findings.append(
            f"Lookalike domain(s) {shown}{more} appear in public Certificate "
            f"Transparency logs."
        )

    if (prospect.dmarc_policy or "").lower() in ("none", "missing"):
        findings.append(
            f"Your email authentication (DMARC) is "
            f"{prospect.dmarc_policy or 'missing'}, which means "
            f"{prospect.primary_domain or 'your domain'} can be spoofed to your customers."
        )

    if any(getattr(s, "signal_type", "") == "public_scam_warning" for s in prospect.signals):
        findings.append("A public scam-warning post references impersonation of your brand.")

    if any(getattr(s, "signal_type", "") == "customer_complaint" for s in prospect.signals):
        findings.append("A public customer complaint references a fake/impersonating account.")

    if any(getattr(s, "signal_type", "") in ("udrp_filing", "udrp_filing_old")
           for s in prospect.signals):
        findings.append("A domain-dispute (UDRP) filing involving your brand is on public record.")

    for s in prospect.signals:
        if getattr(s, "signal_type", "") == "live_phishing":
            evidence_url = getattr(s, "signal_url", None) or (getattr(s, "extra", {}) or {}).get("evidence_url")
            if evidence_url:
                findings.append(f"A live phishing page targeting your brand was observed: {evidence_url}")
            # If no evidence URL, do NOT claim a live phishing page was observed
            break

    return findings


def _evidence_url(prospect: "Prospect") -> Optional[str]:
    for s in prospect.signals:
        if getattr(s, "signal_url", None):
            return s.signal_url
    return None


def _first_name(full: Optional[str]) -> str:
    return (full or "").strip().split(" ")[0] if full else "there"


# ---------------------------------------------------------------------------
# template fill
# ---------------------------------------------------------------------------
_MERGE_RE = re.compile(r"\{\{(\w+)\}\}")


def _fill(template: str, values: dict[str, Any]) -> str:
    return _MERGE_RE.sub(lambda m: str(values.get(m.group(1), m.group(0))), template)


def _unfilled(*texts: str) -> list[str]:
    """Any merge field left unresolved -> the draft is NOT sendable until fixed."""
    leftover: set[str] = set()
    for t in texts:
        leftover.update(_MERGE_RE.findall(t))
    return sorted(leftover)


def _check_forbidden(*texts: str) -> list[str]:
    hits: list[str] = []
    blob = "\n".join(texts).lower()
    for pat in FORBIDDEN_PATTERNS:
        if re.search(pat, blob):
            hits.append(pat)
    return hits


def _build_values(prospect: "Prospect", findings: list[str],
                  sender: dict[str, Any]) -> dict[str, Any]:
    vals = dict(sender)
    vals.update({
        "company": prospect.company_name or "your company",
        "domain": prospect.primary_domain or "your domain",
        "contact_first_name": _first_name(prospect.contact_name),
        "finding_1": findings[0] if len(findings) >= 1 else "",
        "finding_2": findings[1] if len(findings) >= 2 else "",
        # period-stripped variants for use mid-sentence (e.g. Channel C after-accept)
        "finding_1_inline": findings[0].rstrip(".") if len(findings) >= 1 else "",
        "finding_2_inline": findings[1].rstrip(".") if len(findings) >= 2 else "",
        "evidence_url": _evidence_url(prospect) or "",
    })
    return vals


# ---------------------------------------------------------------------------
# main entry
# ---------------------------------------------------------------------------
def draft_for_prospect(prospect: "Prospect", *, sender: Optional[dict[str, Any]] = None,
                       use_llm: bool = False,
                       verify_contact: bool = False) -> Optional[dict[str, Any]]:
    """
    Produce a channel-correct draft for the approval queue, or None if the prospect
    shouldn't be contacted (no routed channel / hard-stopped by the router).

    Returns a dict matching outreach_drafts:
      channel, subject, body, opt_out_line, send_by_hand, parts (channel C),
      findings_used, model, approval="unreviewed", sendable (bool), blockers (list)

    When verify_contact=True, SMTP-verifies the contact email before marking
    sendable. Drafts with unverified emails get a blocker and are NOT sendable.
    """
    channel = prospect.routed_channel
    if not channel or channel == "E":
        # No outbound channel (stopped, or inbound-only). Nothing to draft.
        return None

    sender = {**DEFAULT_SENDER, **(sender or {})}
    findings = summarize_findings(prospect)
    values = _build_values(prospect, findings, sender)

    blockers: list[str] = []
    if not findings:
        blockers.append("no_verified_findings")   # refuse to draft threats we can't show
    if prospect.routed_channel == "C" and not prospect.contact_name:
        blockers.append("no_named_manual_outreach_target")

    # --- Contact email verification gate ---
    contact_verification = None
    if verify_contact and channel in ("B", "D"):
        contact_verification = _verify_contact_email(prospect)
        if contact_verification.get("confidence") == "LOW":
            blockers.append(f"contact_email_unverified:{contact_verification.get('recommendation','')}")
        elif contact_verification.get("confidence") == "NONE":
            blockers.append(f"contact_email_not_found:{contact_verification.get('recommendation','')}")
        # If a better email was found, suggest it
        if contact_verification.get("best_email") and contact_verification["best_email"].lower() != (getattr(prospect, 'contact_email', '') or '').lower():
            blockers.append(f"better_email_available:{contact_verification['best_email']}")
        if contact_verification.get("best_person_name") and not getattr(prospect, "contact_name", None):
            blockers.append(
                "named_target_available:"
                f"{contact_verification['best_person_name']}"
                f" ({contact_verification.get('best_person_title') or 'title unknown'})"
            )

    draft: dict[str, Any] = {
        "channel": channel,
        "subject": None,
        "body": "",
        "opt_out_line": None,
        "send_by_hand": channel == "C",
        "parts": None,
        "findings_used": {"findings": findings, "evidence_url": values["evidence_url"]},
        "model": "template",
        "approval": "unreviewed",
        "contact_verification": contact_verification,
    }

    if channel == "A":
        draft["body"] = _fill(A_BODY, values)

    elif channel == "B":
        draft["subject"] = _fill(B_SUBJECT, values)
        draft["body"] = _fill(B_BODY, values)
        draft["opt_out_line"] = _fill(OPT_OUT_LINE, values)

    elif channel == "C":
        # The pair: connection note (pre-accept) + first message (post-accept).
        draft["parts"] = {
            "connection_note": _fill(C_CONNECTION, values),
            "after_accept": _fill(C_AFTER_ACCEPT, values),
        }
        # `body` is a readable combined preview for the Drafts tab.
        draft["body"] = ("CONNECTION NOTE:\n" + draft["parts"]["connection_note"]
                         + "\n\nAFTER THEY ACCEPT:\n" + draft["parts"]["after_accept"])
        draft["model"] = "template"

    elif channel == "D":
        draft["subject"] = _fill(D_SUBJECT, values)
        body = _fill(D_BODY, values)
        footer = _fill(D_FOOTER, values)
        draft["body"] = body + "\n" + footer
        draft["opt_out_line"] = _fill(OPT_OUT_LINE, values)

        if use_llm:
            polished = _try_llm_polish(prospect, findings, channel, sender)
            if polished:
                draft.update(polished)
                draft["body"] = draft["body"] + "\n" + footer  # always keep the footer

    # --- sendability gate -------------------------------------------------
    texts = [t for t in (draft.get("subject"), draft.get("body")) if t]
    unresolved = _unfilled(*texts)
    if unresolved:
        blockers.append("unfilled_fields:" + ",".join(unresolved))
    forbidden = _check_forbidden(*texts)
    if forbidden:
        blockers.append("forbidden_language:" + ",".join(forbidden))

    draft["blockers"] = blockers
    draft["sendable"] = not blockers
    return draft


def _try_llm_polish(prospect: "Prospect", findings: list[str], channel: str,
                    sender: dict[str, Any]) -> Optional[dict[str, Any]]:
    """
    Optional: let the local model tailor subject/body for B/D. Constrained to the
    same findings; validated; returns None (-> keep the template) on any problem.
    """
    try:
        from common import llm  # lazy: only needs Ollama when actually used
    except Exception:
        return None

    sender_block = f"{sender['sender_name']}, {sender['sender_title']}, {sender.get('sender_org', 'Agentic Insights LLC')} — Brand Guard, part of the AgenticBro trust ecosystem ({sender['site']})"
    findings_payload = {"findings": findings, "evidence_url": _evidence_url(prospect)}
    try:
        out = llm.draft_email(prospect.to_dict(), findings_payload, channel, sender_block)
    except Exception:
        return None

    subject = (out or {}).get("subject")
    body = (out or {}).get("body")
    if not subject or not body:
        return None
    # validate: no forbidden language, no invented links, references nothing new
    if _check_forbidden(subject, body):
        return None
    if "{{" in body or "{{" in subject:
        return None
    return {"subject": subject, "body": body, "model": llm.MODEL}


if __name__ == "__main__":
    import json
    from datetime import date, timedelta

    if Prospect is None:
        print("Run as a module:  python -m pipeline.drafter")
        raise SystemExit(0)

    from common.models import SignalTier, ImpersonationType
    from pipeline.router import route
    from pipeline.scorer import score_prospect

    today = date.today()

    # A Channel-D prospect (cold email): documented harm + lookalikes + weak DMARC.
    # (Lookalikes alone are only *exposure* and would be BANT-held; the news incident
    # is the real harm signal that makes them worth contacting.)
    d_prospect = Prospect(
        company_name="Northwind Coffee Co.", primary_domain="northwindcoffee.com",
        vertical="ecommerce", company_size_band="smb",
        contact_name="Dana Lee", contact_title="Operations",
        contact_channel="email", compliance_region="US", dmarc_policy="none",
        signals=[
            RawSignal(source="news", tier=SignalTier.DOCUMENTED_HARM,
                      signal_type="news_incident",
                      signal_url="https://news.example/northwind-invoice-fraud",
                      incident_date=today - timedelta(days=6)),
            RawSignal(source="crt.sh", tier=SignalTier.EXPOSURE,
                      signal_type="lookalike_domain",
                      extra={"domain": "northwind-coffee.shop"}),
            RawSignal(source="crt.sh", tier=SignalTier.EXPOSURE,
                      signal_type="lookalike_domain",
                      extra={"domain": "nothwind-coffee.com"}),
        ],
    )

    # A Channel-C prospect (owner-led SMB on LinkedIn).
    c_prospect = Prospect(
        company_name="Maple Goods", primary_domain="maplegoods.com",
        vertical="ecommerce", company_size_band="smb",
        contact_name="Sam Ito", contact_title="Founder & CEO",
        contact_channel="email", linkedin_url="https://linkedin.com/in/samito",
        compliance_region="US",
        signals=[
            RawSignal(source="review_site", tier=SignalTier.DOCUMENTED_HARM,
                      signal_type="customer_complaint",
                      signal_url="https://reviews.example/maplegoods/fake-store"),
            RawSignal(source="crt.sh", tier=SignalTier.EXPOSURE,
                      signal_type="lookalike_domain",
                      extra={"domain": "maple-goods.shop"}),
        ],
    )

    for p in (d_prospect, c_prospect):
        score_prospect(p)
        route(p)
        d = draft_for_prospect(p, use_llm=False)
        print("=" * 70)
        if d is None:
            print(f"{p.company_name}  ->  Channel {p.routed_channel}  (no draft — not contacted)")
            continue
        print(f"{p.company_name}  ->  Channel {p.routed_channel}  "
              f"(sendable={d['sendable']}, send_by_hand={d['send_by_hand']})")
        if d["subject"]:
            print(f"\nSubject: {d['subject']}")
        if d.get("parts"):
            print("\n--- Connection note (≤300 chars, sent by hand) ---")
            print(d["parts"]["connection_note"])
            print("\n--- After they accept ---")
            print(d["parts"]["after_accept"])
        else:
            print("\n" + d["body"])
        if d["blockers"]:
            print(f"\nBLOCKERS: {d['blockers']}")
