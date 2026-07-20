"""
Router  —  Channel Decision Tree  (deterministic, no LLM)

Decides HOW to reach a scored prospect, not whether they're worth reaching (the Scorer
already did that). This is the single most important judgment in the whole pipeline,
because an unsolicited "we scanned you, click here" email for a security product is
indistinguishable from a phishing lure. So this stays in auditable code, never in a
model: every routing decision can be explained after the fact.

Mirrors implementation pack §3:

  A  Credible public reply        (they publicly posted a warning w/ a reply path)
  B  Official security/abuse inbox (security@ / abuse@ / report-fraud@ / form)
  C  LinkedIn message — YOUR personal profile
       (i) security-sensitive ICP — NEVER cold-email them, OR
       (ii) a real person is reachable on LinkedIn AND a message from a verifiable
            human profile will out-perform email — see _linkedin_is_more_effective()
  D  Legitimacy-first cold email  (US B2B, compliant, verified business contact)
  E  Inbound capture              (always-on, parallel, every prospect)

Why Channel C is special: a message from your real, verifiable personal profile
(real face, real history, mutual connections) sidesteps the "this looks like
phishing" problem that sinks cold email for a security product. It's drafted by the
agent but SENT BY YOU, by hand, from your own profile — no LinkedIn automation or
scraping-at-scale (that would violate LinkedIn's terms and undo the trust benefit).

Hard stops before anything: suppression list, below threshold, BANT hold,
EU/UK with only a scraped personal address.
"""
from __future__ import annotations

from typing import Any, Optional

try:
    from common.models import Prospect, ROUTE_THRESHOLD
except ImportError:  # allow running the file directly
    Prospect = None  # type: ignore
    ROUTE_THRESHOLD = 50

try:
    from pipeline.contact_quality import contact_is_low_quality
except ImportError:  # allow running the file directly
    def contact_is_low_quality(_p):  # type: ignore
        return (False, "")

# ICP verticals where a cold email reads as phishing and gets reported.
# These route to LinkedIn (C) rather than cold email (D).
SECURITY_SENSITIVE_VERTICALS = {
    "fintech", "payments", "banking", "crypto", "web3", "insurance",
    "healthcare", "health", "legal", "accounting", "security",
}

# Owner/founder-style titles where a personal LinkedIn note lands harder than email.
OWNER_TITLES = (
    "owner", "founder", "co-founder", "cofounder", "ceo", "president",
    "principal", "managing director", "proprietor", "partner",
)

# Channels considered a "published business intake" — safe for cold contact.
INTAKE_CHANNELS = {"abuse_inbox", "security_inbox", "contact_form"}

EU_UK = {"EU", "UK"}


def _has_public_reply_path(prospect: "Prospect") -> bool:
    """Q1: did they publicly post a scam warning we can credibly reply to?"""
    if prospect.contact_channel == "public_reply":
        return True
    return any(
        getattr(s, "signal_type", "") == "public_scam_warning" and getattr(s, "signal_url", None)
        for s in prospect.signals
    )


def _has_intake_inbox(prospect: "Prospect") -> bool:
    """Q2: do they publish an official intake inbox / form?"""
    return prospect.contact_channel in INTAKE_CHANNELS


def _is_security_sensitive(prospect: "Prospect") -> bool:
    """Q3: is the ICP security-sensitive (cold email = phishing report)?"""
    return (prospect.vertical or "").lower() in SECURITY_SENSITIVE_VERTICALS


def _contact_is_scraped_personal(prospect: "Prospect") -> bool:
    """A named-person email that wasn't a published intake address."""
    return prospect.contact_channel == "email" and bool(prospect.contact_name) \
        and prospect.contact_channel not in INTAKE_CHANNELS


def _linkedin_reachable(prospect: "Prospect") -> bool:
    """Is there an actual person we can message on LinkedIn?"""
    return bool(prospect.linkedin_url) or prospect.contact_channel == "linkedin"


def _linkedin_is_more_effective(prospect: "Prospect") -> tuple[bool, str]:
    """
    Decide whether a message from YOUR personal LinkedIn profile beats the cold-email
    path for this prospect. Returns (is_better, reason).

    Requires: a reachable person on LinkedIn AND a named contact (you can't send a
    credible personal note to nobody). Then at least one positive reason:

      * owner/founder-led SMB  — a peer-to-peer note from a real founder lands harder
        than a cold email and feels like outreach, not a lure.
      * they're already active on LinkedIn (the harm signal came from there) — meet
        them where they already are.
      * email path is risky — no published intake and only a scraped personal address,
        so a transparent LinkedIn note is both more effective AND more compliant.
    """
    if not _linkedin_reachable(prospect) or not prospect.contact_name:
        return False, ""

    size = (prospect.company_size_band or "").lower()
    title = (prospect.contact_title or "").lower()
    owner_led_smb = size in ("solo", "smb") and any(t in title for t in OWNER_TITLES)
    if owner_led_smb:
        return True, ("owner/founder-led SMB reachable on LinkedIn — a peer note from "
                      "your real profile out-performs a cold email and avoids the lure look.")

    active_on_linkedin = any(
        "linkedin" in (getattr(s, "source", "") or "").lower()
        or "linkedin" in (getattr(s, "signal_url", "") or "").lower()
        for s in prospect.signals
    )
    if active_on_linkedin:
        return True, ("they're already active on LinkedIn — meet them where they raised "
                      "the issue, with a message from your verifiable personal profile.")

    email_path_risky = (
        prospect.contact_channel in (None, "email")
        and not _has_intake_inbox(prospect)
        and bool(prospect.contact_name)
    )
    if email_path_risky:
        return True, ("no published intake and only a personal email — a transparent "
                      "LinkedIn note from your profile is both more effective and more compliant.")

    return False, ""


def route(prospect: "Prospect") -> dict[str, Any]:
    """
    Return {"channel": "A".."E" or None, "compliance_ok": bool, "reason": str,
            "stop": bool}. Also mutates prospect.routed_channel / .compliance_ok.

    Channel E (inbound) is ALWAYS-ON in parallel and is not returned here as the
    routed channel; it's a separate always-running track. This function decides the
    *outbound* channel (A-D) or a hard stop.
    """
    def _finish(channel: Optional[str], compliance_ok: bool, reason: str,
                stop: bool = False) -> dict[str, Any]:
        prospect.routed_channel = channel
        prospect.compliance_ok = compliance_ok
        return {"channel": channel, "compliance_ok": compliance_ok,
                "reason": reason, "stop": stop}

    # ---- Hard stops (before the tree) ------------------------------------
    if prospect.suppressed:
        return _finish(None, False, "On suppression list — never contact.", stop=True)

    if prospect.victim_score < ROUTE_THRESHOLD:
        return _finish(None, False,
                       f"Victim Score {prospect.victim_score} < threshold {ROUTE_THRESHOLD}. "
                       "Inbound/nurture only.", stop=True)

    if prospect.bant_status == "hold":
        return _finish(None, False, "BANT on hold — route to nurture, not outbound.", stop=True)

    # ---- Q1: public reply path -> CHANNEL A (highest trust) --------------
    if _has_public_reply_path(prospect):
        return _finish("A", True, "Publicly posted a warning with a reply path — "
                                  "reply where they raised their hand.")

    # ---- contact-quality gate (ported from the Cowork outreach fix) ------
    # A registrar/third-party/role address (abuse@godaddy.com, webmaster@…,
    # registrar@nameshield.net, domain.operations@web.com, …) is WHOIS noise, not
    # the prospect's own intake. It must NOT count as a legitimate Channel B inbox.
    low_q, low_q_reason = contact_is_low_quality(prospect)

    # ---- Q2: official intake inbox -> CHANNEL B --------------------------
    if _has_intake_inbox(prospect) and not low_q:
        return _finish("B", True, "Publishes an official security/abuse intake — "
                                  "expected, legitimate channel.")

    # ---- Q3: security-sensitive ICP -> CHANNEL C (never cold email) ------
    if _is_security_sensitive(prospect):
        return _finish("C", True, "Security-sensitive ICP — LinkedIn message from your "
                                  "personal profile; cold email here gets reported as phishing.")

    # ---- Q3.5: would a personal LinkedIn note beat email here? -> CHANNEL C
    li_better, li_reason = _linkedin_is_more_effective(prospect)
    if li_better:
        return _finish("C", True, "LinkedIn (your personal profile) is the stronger path — " + li_reason)

    # ---- contact-quality hard stop --------------------------------------
    # We've exhausted A (public reply), B (real intake), and C (LinkedIn/security-
    # sensitive). The only remaining outbound path is D (cold email). If the sole
    # contact is a registrar/role address, a cold email would bounce or hit the wrong
    # party — do NOT queue a dead-end draft; hand off to contact discovery instead.
    if low_q:
        return _finish(None, False,
                       "Low-quality contact — " + low_q_reason +
                       ". Route to contact-discovery; do not queue.", stop=True)

    # ---- Q4: compliance gate --------------------------------------------
    region = (prospect.compliance_region or "US").upper()
    if region in EU_UK:
        if _contact_is_scraped_personal(prospect):
            # Don't email a scraped personal address under PECR/GDPR. Prefer a
            # transparent LinkedIn note from your profile IF the person is reachable;
            # otherwise there's no legitimate path -> inbound only.
            if _linkedin_reachable(prospect):
                return _finish("C", True, "EU/UK with only a scraped personal address — "
                                          "send a LinkedIn note from your personal profile "
                                          "instead (PECR/GDPR-safer).")
            return _finish(None, False, "EU/UK with only a scraped personal address and no "
                                        "LinkedIn path — no legitimate-interest basis. Inbound only.",
                           stop=True)
        if not prospect.contact_channel:
            return _finish(None, False, "EU/UK with no published contact — "
                                        "no legitimate-interest path. Inbound only.", stop=True)
        # EU/UK but a published business contact exists -> allowed cold email
        return _finish("D", True, "EU/UK with a published business contact — "
                                  "legitimate-interest cold email (keep records).")

    if not prospect.contact_channel:
        return _finish(None, False, "No verified contact — inbound/nurture only.", stop=True)

    # ---- Q5: US B2B, verified, compliant -> CHANNEL D --------------------
    return _finish("D", True, "US B2B, verified business contact — "
                              "legitimacy-first cold email.")


# Always-on parallel track, returned for completeness / logging.
INBOUND_CHANNEL = {
    "channel": "E",
    "always_on": True,
    "note": ("Free public 'is my domain being spoofed?' scan + SEO for post-incident "
             "searches. Runs for every prospect in parallel; zero phishing suspicion."),
}

# Cadence rule shared by all outbound channels (enforced by the sequencer, not here).
FOLLOWUP_RULE = {
    "max_touches": 3,
    "same_channel": True,
    "value_add_each_touch": True,
    "on_reply_or_optout": "stop sequence + update Supabase",
    "after_touch_3_no_reply": "60-day nurture queue",
}


if __name__ == "__main__":
    import json
    from datetime import date

    if Prospect is None:
        print("Run as a module:  python -m pipeline.router")
        raise SystemExit(0)

    from common.models import RawSignal, SignalTier

    samples = [
        # A — public warning with a URL
        Prospect(company_name="Northwind", vertical="ecommerce", company_size_band="smb",
                 victim_score=70, bant_status="pass", contact_channel="public_reply",
                 signals=[RawSignal(source="x_profile", tier=SignalTier.PUBLIC_VICTIM,
                          signal_type="public_scam_warning", signal_url="https://x.com/northwind")]),
        # B — published abuse inbox
        Prospect(company_name="Acme", vertical="saas", company_size_band="smb",
                 victim_score=60, bant_status="pass", contact_channel="abuse_inbox"),
        # C — security-sensitive vertical
        Prospect(company_name="PayCo", vertical="fintech", company_size_band="mid",
                 victim_score=80, bant_status="pass", contact_channel="email",
                 contact_name="J. Doe"),
        # C — owner-led SMB reachable on LinkedIn (personal profile beats email)
        Prospect(company_name="Maple Goods", vertical="ecommerce", company_size_band="smb",
                 victim_score=65, bant_status="pass", contact_channel="email",
                 contact_name="Sam Ito", contact_title="Founder & CEO",
                 linkedin_url="https://linkedin.com/in/samito", compliance_region="US"),
        # C — reachable & active on LinkedIn, but harm signal isn't a public reply path
        Prospect(company_name="Studio Verde", vertical="design", company_size_band="smb",
                 victim_score=60, bant_status="pass", contact_channel="linkedin",
                 contact_name="R. Vega", contact_title="Marketing Lead",
                 signals=[RawSignal(source="linkedin_posts", tier=SignalTier.DOCUMENTED_HARM,
                          signal_type="customer_complaint",
                          signal_url="https://linkedin.com/posts/studioverde")]),
        # D — US B2B verified, no LinkedIn edge -> cold email
        Prospect(company_name="Toolset", vertical="ecommerce", company_size_band="smb",
                 victim_score=55, bant_status="pass", contact_channel="email",
                 contact_name="K. Roe", contact_title="Operations", compliance_region="US"),
        # EU/UK scraped personal -> downgrade to C
        Prospect(company_name="Brit Ltd", vertical="retail", company_size_band="smb",
                 victim_score=65, bant_status="pass", contact_channel="email",
                 contact_name="A. Smith", compliance_region="UK"),
        # Hard stop — suppressed
        Prospect(company_name="DoNotContact", victim_score=90, bant_status="pass",
                 suppressed=True),
        # Hard stop — below threshold
        Prospect(company_name="Faint", victim_score=30, bant_status="pass",
                 contact_channel="email", contact_name="x"),
    ]

    for p in samples:
        r = route(p)
        print(f"{p.company_name:14} -> channel={r['channel']}  stop={r['stop']}  | {r['reason']}")
