"""
contact_quality.py — is this contact a REAL, reachable prospect intake, or WHOIS noise?

Ported from the Cowork outreach fix (2026-07). The router historically treated any
abuse_inbox / security_inbox / contact_form as a legitimate Channel B intake. But a
lot of "contacts" harvested from WHOIS/RDAP are the *registrar's* abuse desk or a
generic role mailbox on a third-party domain — emailing those about brand monitoring
is undeliverable, wrong-audience, and pollutes the funnel (it was the single biggest
source of dead-end drafts: abuse@godaddy.com, DomainAbuse@service.aliyun.com,
registrar@nameshield.net, webmaster@…, domain.operations@web.com, etc.).

This module is deterministic and store-free so the router can call it inline.

A contact is LOW QUALITY when:
  * its email domain is a known registrar / brand-protection / third-party service
    domain that is NOT the prospect's own primary_domain, OR
  * its local-part is a low-value role mailbox (webmaster/hostmaster/postmaster/
    domain*/registrar) — these bounce or get ignored for B2B outreach.

An on-domain security@ / abuse@ / report-fraud@ (i.e. on the prospect's OWN domain)
is STILL a legitimate intake and stays high quality → Channel B as before.
"""
from __future__ import annotations
from typing import Optional

# Third-party domains that show up as WHOIS/RDAP/registrar/brand-protection contacts.
# An address on one of these is (almost) never the prospect's own intake.
REGISTRAR_THIRDPARTY_DOMAINS = {
    "godaddy.com", "service.aliyun.com", "aliyun.com", "nameshield.net", "nameshield.com",
    "key-systems.net", "web.com", "safebrands.com", "namecheap.com", "markmonitor.com",
    "cscglobal.com", "csc.com", "comlaude.com", "gandi.net", "ovh.net", "tucows.com",
    "enom.com", "publicdomainregistry.com", "networksolutions.com", "1api.net",
    "registrar-servers.com", "whoisguard.com", "domainsbyproxy.com",
}

# Low-value role local-parts (RFC-2142-ish) that don't reach a decision-maker and
# frequently bounce for cold B2B outreach. NOTE: abuse@/security@ are intentionally
# NOT here — on the prospect's own domain those are valid intakes.
LOW_QUALITY_ROLE_LOCALPARTS = {
    "webmaster", "hostmaster", "postmaster", "registrar", "domainadmin",
    "domainabuse", "domain", "domains", "domain.operations", "dns", "noc",
}


def _split_email(email: Optional[str]) -> tuple[str, str]:
    if not email or "@" not in email:
        return "", ""
    local, _, domain = email.strip().lower().partition("@")
    return local, domain


def email_is_low_quality(email: Optional[str], primary_domain: Optional[str]) -> tuple[bool, str]:
    """Return (is_low_quality, reason). Store-free, deterministic."""
    local, domain = _split_email(email)
    if not domain:
        return False, ""  # no email is handled elsewhere (contact discovery / other channels)
    pd = (primary_domain or "").strip().lower().lstrip("www.")
    # 1) third-party / registrar domain that isn't the prospect's own
    if domain in REGISTRAR_THIRDPARTY_DOMAINS and domain != pd:
        return True, f"contact address is on registrar/third-party domain '{domain}', not the prospect's own — WHOIS noise, not a reachable intake"
    # 2) low-value role local-part
    if local in LOW_QUALITY_ROLE_LOCALPARTS:
        return True, f"role mailbox '{local}@' is a low-value/bouncing address for outreach — needs a real contact"
    return False, ""


def contact_is_low_quality(prospect) -> tuple[bool, str]:
    """Prospect-level wrapper used by the router."""
    return email_is_low_quality(
        getattr(prospect, "contact_email", None),
        getattr(prospect, "primary_domain", None),
    )
