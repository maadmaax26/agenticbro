"""
collectors/enrich.py — DMARC + contact enrichment for a resolved Prospect.

This is the seam pipeline/resolver._enrich deliberately left as a stub: it derives
the few facts the scorer/router need but that the signal collectors don't carry —

    * dmarc_policy   (none|quarantine|reject|missing)  → scorer "dmarc_weak" +10
    * spf / mx       (deliverability context, display only)
    * a reachable intake contact (abuse_inbox / security_inbox / role email)

Everything here is PUBLIC DATA / passive OSINT only, consistent with the project's
guardrails (no login-walled scraping, no probing, no auth automation):

    DMARC/SPF/MX   DNS TXT/MX over DNS-over-HTTPS (dns.google, cloudflare-dns)
    abuse contact  RDAP (rdap.org bootstrap) registrar/registrant abuse entity
    security.txt   the published /.well-known/security.txt (RFC 9116)
    role addresses RFC 2142 well-knowns (abuse@, security@, …) — DERIVED, not looked up

Two hard rules baked in:

  1. OFFLINE BY DEFAULT. enrich_domain(..., live=False) does ZERO network I/O. Live
     lookups happen only when the caller passes live=True (which resolver threads from
     an explicit enrich_live flag, default False). Reserved/synthetic domains
     (.example/.invalid/.test/.localhost) are never touched on the network.

  2. PROVENANCE, NOT INVENTION. Every Contact records where it came from and whether
     it was VERIFIED (actually present in RDAP/security.txt) or an UNVERIFIED guess
     (a role-address pattern). Unverified guesses are gated behind allow_unverified
     (default False). We never synthesize a *named person* or a title here, so the
     scorer's "decision_maker_found" stays honest.

NB on intake inboxes: abuse@/security@ and security.txt contacts exist to RECEIVE
ABUSE / VULNERABILITY REPORTS, not sales mail. Each such Contact is flagged
report_only=True so the human Drafts reviewer can see it and decide. Nothing here
sends anything.

Deps: stdlib only.  Run the offline parser self-test with:  python -m collectors.enrich
"""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Optional

# Prospect import is only needed by apply_enrichment(); keep the parsers usable standalone.
try:
    from common.models import Prospect
except ImportError:                              # allow running the file directly
    Prospect = None  # type: ignore


# ---------------------------------------------------------------------------
# config / constants
# ---------------------------------------------------------------------------
USER_AGENT = "BrandGuard-Research/0.1 (+https://agenticbro.app/brand-guard)"
HTTP_TIMEOUT = 15

# DNS-over-HTTPS resolvers (JSON API). Primary, then fallback.
DOH_ENDPOINTS = (
    "https://dns.google/resolve",
    "https://cloudflare-dns.com/dns-query",
)

# Reserved / synthetic TLDs we must never hit on the network (RFC 2606 + resolver's
# own ".example" placeholder for brand-inferred domains).
RESERVED_TLDS = (".example", ".invalid", ".test", ".localhost")

# RFC 2142 role mailboxes worth guessing when nothing verified turns up. Ordered by
# how appropriate they are as a *contact* (not all are sales-appropriate — see flags).
ROLE_LOCALPARTS = ("abuse", "security", "postmaster", "hostmaster", "webmaster")

# DMARC policy → a coarse 0-100 score for display/sorting only. The SCORER keys off
# dmarc_policy text, not this number; this is purely a human-readable severity.
DMARC_POLICY_SCORE = {"reject": 100, "quarantine": 60, "none": 20, "missing": 0}

# Which role local-parts are abuse/security intake inboxes (report-only, not sales).
_INTAKE_LOCALPARTS = {"abuse", "security"}


# ---------------------------------------------------------------------------
# data models
# ---------------------------------------------------------------------------
@dataclass
class Contact:
    """One discovered point of contact, with full provenance."""
    channel: str                 # abuse_inbox | security_inbox | email | contact_form
    address: str                 # an email address or a URL
    source: str                  # rdap | security_txt | role_guess
    verified: bool               # True only if actually published (RDAP/security.txt)
    report_only: bool = False    # True for abuse/security intake inboxes
    note: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "channel": self.channel, "address": self.address, "source": self.source,
            "verified": self.verified, "report_only": self.report_only, "note": self.note,
        }


@dataclass
class Enrichment:
    """Everything enrich_domain() could establish about a domain."""
    domain: str
    dmarc_policy: Optional[str] = None       # none|quarantine|reject|missing (None=unknown)
    dmarc_record: Optional[str] = None
    dmarc_score: Optional[int] = None
    spf_present: Optional[bool] = None
    spf_record: Optional[str] = None
    mx_hosts: list[str] = field(default_factory=list)
    contacts: list[Contact] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    fetched_live: bool = False

    def best_contact(self, *, allow_unverified: bool = False) -> Optional[Contact]:
        """
        Pick the single contact most appropriate to ACT on, preferring:
          verified over guessed, then sales-appropriate over report-only.
        Report-only intake inboxes are returned only as a last resort, and never
        a guessed one unless allow_unverified is set.
        """
        pool = [c for c in self.contacts if c.verified or allow_unverified]
        if not pool:
            return None
        pool.sort(key=lambda c: (
            0 if c.verified else 1,        # verified first
            0 if not c.report_only else 1,  # sales-appropriate before intake inbox
            0 if c.source == "rdap" else 1,
        ))
        return pool[0]

    def to_dict(self) -> dict[str, Any]:
        return {
            "domain": self.domain,
            "dmarc_policy": self.dmarc_policy,
            "dmarc_record": self.dmarc_record,
            "dmarc_score": self.dmarc_score,
            "spf_present": self.spf_present,
            "spf_record": self.spf_record,
            "mx_hosts": self.mx_hosts,
            "contacts": [c.to_dict() for c in self.contacts],
            "errors": self.errors,
            "fetched_live": self.fetched_live,
        }


# ---------------------------------------------------------------------------
# guards
# ---------------------------------------------------------------------------
def is_reserved(domain: Optional[str]) -> bool:
    """True for empty/synthetic domains we must never resolve or fetch."""
    if not domain:
        return True
    d = domain.strip().lower().rstrip(".")
    if not d or "." not in d:
        return True
    return d.endswith(RESERVED_TLDS)


# ---------------------------------------------------------------------------
# low-level network (only ever called when live=True)
# ---------------------------------------------------------------------------
def _http_get(url: str, *, accept: str = "application/json",
              timeout: int = HTTP_TIMEOUT) -> Optional[bytes]:
    req = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
        return None


def _doh_query(name: str, rrtype: str, *, timeout: int = HTTP_TIMEOUT) -> list[str]:
    """
    Resolve `name`/`rrtype` via DoH JSON. Returns the list of record data strings
    (RDATA), stripped of surrounding quotes for TXT. Empty list on any failure.
    """
    q = urllib.parse.urlencode({"name": name, "type": rrtype})
    for base in DOH_ENDPOINTS:
        raw = _http_get(f"{base}?{q}", accept="application/dns-json", timeout=timeout)
        if not raw:
            continue
        try:
            data = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            continue
        answers = data.get("Answer") or []
        out: list[str] = []
        for a in answers:
            val = str(a.get("data", "")).strip()
            if rrtype == "TXT":
                # TXT RDATA may be quoted and split into chunks: "v=DMARC1" "p=none"
                val = "".join(re.findall(r'"([^"]*)"', val)) or val.strip('"')
            if val:
                out.append(val)
        if out:
            return out
    return []


# ---------------------------------------------------------------------------
# parsers (PURE — no network; unit-tested in __main__)
# ---------------------------------------------------------------------------
def parse_dmarc_txt(txt_records: list[str]) -> tuple[Optional[str], Optional[str]]:
    """
    From a list of TXT records at _dmarc.<domain>, return (policy, record).
      policy ∈ {none, quarantine, reject} from the p= tag, else "missing" if there is
      a DMARC record with no/!valid p=, else None if there's no DMARC record at all.
    """
    for rec in txt_records:
        if rec.lower().replace(" ", "").startswith("v=dmarc1"):
            m = re.search(r"\bp\s*=\s*(none|quarantine|reject)\b", rec, re.I)
            policy = m.group(1).lower() if m else "missing"
            return policy, rec
    return None, None


def parse_spf_txt(txt_records: list[str]) -> tuple[Optional[bool], Optional[str]]:
    """From the apex TXT records, return (spf_present, spf_record)."""
    for rec in txt_records:
        if rec.lower().replace(" ", "").startswith("v=spf1"):
            return True, rec
    return (False if txt_records else None), None


def parse_security_txt(body: str, domain: str) -> list[Contact]:
    """
    Parse an RFC 9116 security.txt body for Contact: fields. mailto: → email/intake,
    https: → contact_form. Verified (it was actually published).
    """
    contacts: list[Contact] = []
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"(?i)^Contact:\s*(.+)$", line)
        if not m:
            continue
        value = m.group(1).strip()
        if value.lower().startswith("mailto:"):
            addr = value[7:].strip()
            local = addr.split("@", 1)[0].lower()
            report = local in _INTAKE_LOCALPARTS or local == "postmaster"
            contacts.append(Contact(
                channel="security_inbox" if report else "email",
                address=addr, source="security_txt", verified=True,
                report_only=report, note="published in security.txt"))
        elif value.lower().startswith(("http://", "https://")):
            contacts.append(Contact(
                channel="contact_form", address=value, source="security_txt",
                verified=True, report_only=True,
                note="security.txt reporting form"))
    return contacts


def parse_rdap_abuse(rdap_json: dict[str, Any]) -> list[Contact]:
    """
    Walk an RDAP domain response for abuse/registrar entities and pull email vCard
    addresses. These are abuse intake inboxes → report_only.
    """
    out: list[Contact] = []
    seen: set[str] = set()

    def _emails_from_vcard(vcard: Any) -> list[str]:
        emails: list[str] = []
        if not (isinstance(vcard, list) and len(vcard) == 2):
            return emails
        for entry in vcard[1]:
            if isinstance(entry, list) and len(entry) >= 4 and entry[0] == "email":
                val = entry[3]
                if isinstance(val, str) and "@" in val:
                    emails.append(val.strip())
        return emails

    def _walk(entities: Any) -> None:
        if not isinstance(entities, list):
            return
        for ent in entities:
            if not isinstance(ent, dict):
                continue
            roles = [str(r).lower() for r in (ent.get("roles") or [])]
            for addr in _emails_from_vcard(ent.get("vcardArray")):
                key = addr.lower()
                if key in seen:
                    continue
                seen.add(key)
                is_abuse = "abuse" in roles or addr.split("@", 1)[0].lower() == "abuse"
                out.append(Contact(
                    channel="abuse_inbox" if is_abuse else "email",
                    address=addr, source="rdap", verified=True,
                    report_only=is_abuse,
                    note=f"RDAP entity roles={roles or 'n/a'}"))
            _walk(ent.get("entities"))   # registrar abuse contacts nest one level down

    _walk(rdap_json.get("entities"))
    return out


def role_address_candidates(domain: str) -> list[Contact]:
    """
    RFC 2142 role mailboxes as UNVERIFIED guesses. Derived purely from the domain
    string — no lookup, no confirmation they exist. Always report_only for intake
    local-parts; flagged verified=False so callers can gate them.
    """
    out: list[Contact] = []
    for local in ROLE_LOCALPARTS:
        report = local in _INTAKE_LOCALPARTS or local in ("postmaster", "hostmaster")
        out.append(Contact(
            channel=("abuse_inbox" if local == "abuse"
                     else "security_inbox" if local == "security"
                     else "email"),
            address=f"{local}@{domain}", source="role_guess",
            verified=False, report_only=report,
            note="RFC 2142 role address (guess — not confirmed to exist)"))
    return out


# ---------------------------------------------------------------------------
# live lookups (network) — each returns partial data and never raises
# ---------------------------------------------------------------------------
def lookup_dmarc(domain: str, *, timeout: int = HTTP_TIMEOUT
                 ) -> tuple[Optional[str], Optional[str]]:
    txt = _doh_query(f"_dmarc.{domain}", "TXT", timeout=timeout)
    return parse_dmarc_txt(txt)


def lookup_spf(domain: str, *, timeout: int = HTTP_TIMEOUT
               ) -> tuple[Optional[bool], Optional[str]]:
    txt = _doh_query(domain, "TXT", timeout=timeout)
    return parse_spf_txt(txt)


def lookup_mx(domain: str, *, timeout: int = HTTP_TIMEOUT) -> list[str]:
    hosts: list[str] = []
    for rec in _doh_query(domain, "MX", timeout=timeout):
        # MX RDATA looks like "10 aspmx.l.google.com." → keep the host.
        parts = rec.split()
        host = (parts[-1] if parts else rec).rstrip(".").lower()
        if host and host not in hosts:
            hosts.append(host)
    return hosts


def fetch_security_txt(domain: str, *, timeout: int = HTTP_TIMEOUT) -> list[Contact]:
    for url in (f"https://{domain}/.well-known/security.txt",
                f"https://{domain}/security.txt"):
        raw = _http_get(url, accept="text/plain", timeout=timeout)
        if raw:
            try:
                body = raw.decode("utf-8", errors="replace")
            except Exception:
                continue
            if "contact:" in body.lower():
                return parse_security_txt(body, domain)
    return []


def lookup_rdap_abuse(domain: str, *, timeout: int = HTTP_TIMEOUT) -> list[Contact]:
    raw = _http_get(f"https://rdap.org/domain/{urllib.parse.quote(domain)}",
                    accept="application/rdap+json", timeout=timeout)
    if not raw:
        return []
    try:
        return parse_rdap_abuse(json.loads(raw.decode("utf-8")))
    except (ValueError, UnicodeDecodeError):
        return []


# ---------------------------------------------------------------------------
# orchestrator
# ---------------------------------------------------------------------------
DEFAULT_SOURCES = ("dmarc", "spf", "mx", "rdap", "security_txt", "role")


def enrich_domain(domain: str, *, live: bool = False,
                  sources: tuple[str, ...] = DEFAULT_SOURCES,
                  allow_unverified: bool = False,
                  timeout: int = HTTP_TIMEOUT) -> Enrichment:
    """
    Build an Enrichment for `domain`.

    live=False (default): NO network. DMARC/SPF/MX stay unknown (None/empty). Role
      address guesses are included only if allow_unverified=True (they need no lookup).
    live=True: passive public lookups for the requested `sources`. Reserved/synthetic
      domains short-circuit to an empty Enrichment with a note (never resolved).

    `sources` subset of {dmarc, spf, mx, rdap, security_txt, role}.
    """
    enr = Enrichment(domain=domain)

    if is_reserved(domain):
        enr.errors.append(f"skipped: reserved/synthetic domain ({domain!r})")
        if allow_unverified and "role" in sources and not is_reserved(domain):
            enr.contacts.extend(role_address_candidates(domain))
        return enr

    if not live:
        enr.errors.append("offline: live=False, no DNS/HTTP performed")
        if allow_unverified and "role" in sources:
            enr.contacts.extend(role_address_candidates(domain))
        return enr

    enr.fetched_live = True

    if "dmarc" in sources:
        enr.dmarc_policy, enr.dmarc_record = lookup_dmarc(domain, timeout=timeout)
        if enr.dmarc_policy is not None:
            enr.dmarc_score = DMARC_POLICY_SCORE.get(enr.dmarc_policy)
    if "spf" in sources:
        enr.spf_present, enr.spf_record = lookup_spf(domain, timeout=timeout)
    if "mx" in sources:
        enr.mx_hosts = lookup_mx(domain, timeout=timeout)

    if "rdap" in sources:
        enr.contacts.extend(lookup_rdap_abuse(domain, timeout=timeout))
    if "security_txt" in sources:
        enr.contacts.extend(fetch_security_txt(domain, timeout=timeout))

    # role guesses only as a backstop, and only if explicitly allowed
    if "role" in sources and allow_unverified and not any(c.verified for c in enr.contacts):
        enr.contacts.extend(role_address_candidates(domain))

    return enr


# ---------------------------------------------------------------------------
# apply: write enrichment onto a Prospect (fills empties, never clobbers/invents)
# ---------------------------------------------------------------------------
# Contact.channel → Prospect.contact_channel value the router understands.
_CHANNEL_MAP = {
    "abuse_inbox": "abuse_inbox",
    "security_inbox": "security_inbox",
    "contact_form": "contact_form",
    "email": "email",
}


def apply_enrichment(prospect: "Prospect", enr: Enrichment, *,
                     allow_unverified: bool = False) -> dict[str, Any]:
    """
    Merge an Enrichment into a Prospect. Rules:
      * Only FILL empty fields — never overwrite a value a collector already set.
      * Set dmarc_policy/dmarc_score from enrichment if the prospect has none.
      * Pick best_contact() and, if the prospect has no contact_channel yet, set
        contact_channel (+ contact_email for mailable channels). NEVER set a named
        person/title here (decision_maker_found must stay earned, not guessed).
      * Stash full provenance on prospect._enrichment for the Drafts reviewer.
    Returns a dict describing exactly what changed.
    """
    changed: dict[str, Any] = {}

    if enr.dmarc_policy and not getattr(prospect, "dmarc_policy", None):
        prospect.dmarc_policy = enr.dmarc_policy
        prospect.dmarc_score = enr.dmarc_score
        changed["dmarc_policy"] = enr.dmarc_policy

    if enr.mx_hosts and not getattr(prospect, "_mx_hosts", None):
        setattr(prospect, "_mx_hosts", enr.mx_hosts)
        changed["mx_hosts"] = enr.mx_hosts

    best = enr.best_contact(allow_unverified=allow_unverified)
    if best and not getattr(prospect, "contact_channel", None):
        prospect.contact_channel = _CHANNEL_MAP.get(best.channel, "email")
        if "@" in best.address and best.channel != "contact_form":
            if not getattr(prospect, "contact_email", None):
                prospect.contact_email = best.address
                changed["contact_email"] = best.address
        changed["contact_channel"] = prospect.contact_channel
        changed["contact_source"] = best.source
        changed["contact_report_only"] = best.report_only

    # provenance for the human reviewer (mirrors resolver's dynamic-attr convention)
    setattr(prospect, "_enrichment", enr.to_dict())
    return changed


# ---------------------------------------------------------------------------
# offline self-test — `python -m collectors.enrich`  (NO network)
# ---------------------------------------------------------------------------
def _selftest() -> int:
    print("== enrich.py offline self-test (parsers only, no network) ==")

    # 1) DMARC parsing across the policy ladder + missing + absent
    cases = {
        "reject": ["v=DMARC1; p=reject; rua=mailto:dmarc@x.com"],
        "quarantine": ['v=DMARC1; p=quarantine'],
        "none": ["v=DMARC1;p=none"],
        "missing": ["v=DMARC1; rua=mailto:dmarc@x.com"],   # record but no p=
    }
    for expected, recs in cases.items():
        pol, _ = parse_dmarc_txt(recs)
        assert pol == expected, f"DMARC {recs} → {pol}, expected {expected}"
    assert parse_dmarc_txt(["some unrelated txt"]) == (None, None), "no DMARC → None"
    assert parse_dmarc_txt([]) == (None, None)
    print("  [ok] DMARC: reject/quarantine/none/missing/absent")

    # dmarc score mapping
    assert DMARC_POLICY_SCORE["reject"] == 100 and DMARC_POLICY_SCORE["none"] == 20
    print("  [ok] DMARC severity score map")

    # 2) SPF
    assert parse_spf_txt(["v=spf1 include:_spf.google.com ~all"])[0] is True
    assert parse_spf_txt(["v=DMARC1; p=none"]) == (False, None)
    assert parse_spf_txt([]) == (None, None)
    print("  [ok] SPF present/absent/unknown")

    # 3) security.txt
    sec = parse_security_txt(
        "# our policy\nContact: mailto:security@acme.com\n"
        "Contact: https://acme.com/report\nContact: mailto:ciso@acme.com\n",
        "acme.com")
    by_addr = {c.address: c for c in sec}
    assert by_addr["security@acme.com"].report_only is True
    assert by_addr["security@acme.com"].verified is True
    assert by_addr["https://acme.com/report"].channel == "contact_form"
    assert by_addr["ciso@acme.com"].report_only is False  # non-intake mailbox
    print("  [ok] security.txt: mailto/url, intake vs non-intake")

    # 4) RDAP abuse extraction (nested registrar entity with vCard email)
    rdap = {"entities": [{"roles": ["registrar"], "entities": [{
        "roles": ["abuse"],
        "vcardArray": ["vcard", [
            ["version", {}, "text", "4.0"],
            ["email", {}, "text", "abuse@registrar.net"]]]}]}]}
    rc = parse_rdap_abuse(rdap)
    assert len(rc) == 1 and rc[0].address == "abuse@registrar.net"
    assert rc[0].channel == "abuse_inbox" and rc[0].report_only and rc[0].verified
    print("  [ok] RDAP abuse contact (nested, vCard email)")

    # 5) role guesses are unverified + correctly flagged
    roles = role_address_candidates("acme.com")
    rg = {c.address: c for c in roles}
    assert rg["abuse@acme.com"].verified is False
    assert rg["abuse@acme.com"].report_only is True
    assert "webmaster@acme.com" in rg
    print("  [ok] RFC 2142 role candidates (unverified, flagged)")

    # 6) reserved/synthetic domains never resolve, even live=True
    enr = enrich_domain("northwindcoffee.example", live=True)
    assert enr.fetched_live is False and enr.dmarc_policy is None
    assert any("reserved" in e for e in enr.errors)
    print("  [ok] reserved-domain guard (.example) blocks live lookups")

    # 7) offline default = no contacts unless allow_unverified
    assert enrich_domain("acme.com", live=False).contacts == []
    off = enrich_domain("acme.com", live=False, allow_unverified=True)
    assert off.contacts and all(not c.verified for c in off.contacts)
    print("  [ok] offline default empty; allow_unverified yields role guesses")

    # 8) best_contact ranking: verified non-intake > verified intake > guess
    enr = Enrichment(domain="acme.com", contacts=[
        Contact("abuse_inbox", "abuse@acme.com", "role_guess", False, True),
        Contact("security_inbox", "security@acme.com", "security_txt", True, True),
        Contact("email", "press@acme.com", "security_txt", True, False),
    ])
    assert enr.best_contact().address == "press@acme.com"
    print("  [ok] best_contact prefers verified, sales-appropriate")

    # 9) apply_enrichment: fills empties, never clobbers, never invents a person
    if Prospect is not None:
        p = Prospect(company_name="Acme", primary_domain="acme.com")
        enr = Enrichment(domain="acme.com", dmarc_policy="none", dmarc_score=20,
                         contacts=[Contact("email", "hello@acme.com",
                                           "security_txt", True, False)])
        ch = apply_enrichment(p, enr)
        assert p.dmarc_policy == "none" and ch["dmarc_policy"] == "none"
        assert p.contact_channel == "email" and p.contact_email == "hello@acme.com"
        assert p.contact_name is None and p.contact_title is None, "must not invent a person"
        # don't clobber: a prospect that already has a contact keeps it
        p2 = Prospect(company_name="Acme2", primary_domain="acme2.com",
                      contact_channel="public_reply")
        apply_enrichment(p2, Enrichment(domain="acme2.com",
                         contacts=[Contact("abuse_inbox", "abuse@acme2.com",
                                           "rdap", True, True)]))
        assert p2.contact_channel == "public_reply", "existing channel preserved"
        print("  [ok] apply_enrichment fills empties, preserves existing, no invented person")
    else:
        print("  [skip] apply_enrichment (run as module for Prospect import)")

    print("\nALL ENRICH SELFTEST CHECKS PASSED ✓")
    return 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] not in ("-t", "--selftest"):
        # ad-hoc live probe: python -m collectors.enrich <domain>  (network on)
        dom = sys.argv[1]
        result = enrich_domain(dom, live=True, allow_unverified=True)
        print(json.dumps(result.to_dict(), indent=2, default=str))
        sys.exit(0)
    raise SystemExit(_selftest())
