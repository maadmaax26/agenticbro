#!/usr/bin/env python3
"""
discover_contacts.py — Discover and qualify contact emails for a company domain.

Finds the best contact email by:
  1. Checking published contacts (security.txt, RDAP abuse, website contact page)
  2. Testing common email patterns (first@, first.last@, firstlast@, etc.)
  3. SMTP-verifying each candidate (RCPT TO check)
  4. Scoring confidence: HIGH (SMTP OK) | MEDIUM (MX OK) | LOW (rejected)

Also discovers LinkedIn company URL and key personnel when possible.

Usage:
  python3 discover_contacts.py --domain example.com --company "Company Name"
  python3 discover_contacts.py --domain example.com --company "Company Name" --person "John Smith"
  python3 discover_contacts.py --domain example.com --company "Company Name" --json

Output:
  - JSON with ranked contact candidates + LinkedIn URL + confidence scores
  - Exits 0 if at least one HIGH/MEDIUM candidate found, 1 otherwise
"""
import argparse
import json
import re
import socket
import smtplib
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

USER_AGENT = "BrandGuard-Research/0.1 (+https://agenticbro.app/brand-guard)"
HTTP_TIMEOUT = 15
WORKSPACE_DIR = Path("/Users/efinney/.openclaw/workspace")

GENERIC_LOCAL_PARTS = {
    "abuse", "admin", "billing", "contact", "hello", "help", "hi", "info",
    "legal", "office", "press", "privacy", "sales", "security", "support",
    "team", "webmaster"
}

# DNS-over-HTTPS for MX lookup
DOH_ENDPOINTS = (
    "https://dns.google/resolve",
    "https://cloudflare-dns.com/dns-query",
)


@dataclass
class ContactCandidate:
    email: str
    source: str          # security_txt | rdap | pattern | website
    person_name: Optional[str] = None
    person_title: Optional[str] = None
    linkedin_url: Optional[str] = None
    smtp_status: str = "unverified"  # ok | not_found | auth_required | temp_error | error
    smtp_detail: str = ""
    confidence: str = "LOW"  # HIGH | MEDIUM | LOW
    verified: bool = False

    def to_dict(self) -> dict:
        return {
            "email": self.email,
            "source": self.source,
            "person_name": self.person_name,
            "person_title": self.person_title,
            "linkedin_url": self.linkedin_url,
            "is_generic": is_generic_email(self.email),
            "smtp_status": self.smtp_status,
            "smtp_detail": self.smtp_detail,
            "confidence": self.confidence,
            "verified": self.verified,
        }


@dataclass
class ContactReport:
    domain: str
    company: str
    mx_found: bool = False
    mx_hosts: list[str] = field(default_factory=list)
    candidates: list[ContactCandidate] = field(default_factory=list)
    linkedin_url: Optional[str] = None
    website_contact_url: Optional[str] = None
    key_people: list[dict] = field(default_factory=list)
    best_email: Optional[str] = None
    best_person_name: Optional[str] = None
    best_person_title: Optional[str] = None
    best_linkedin_url: Optional[str] = None
    best_confidence: str = "NONE"
    recommendation: str = "no_verified_email"

    def to_dict(self) -> dict:
        return {
            "domain": self.domain,
            "company": self.company,
            "mx_found": self.mx_found,
            "mx_hosts": self.mx_hosts,
            "candidates": [c.to_dict() for c in self.candidates],
            "linkedin_url": self.linkedin_url,
            "website_contact_url": self.website_contact_url,
            "key_people": self.key_people,
            "best_email": self.best_email,
            "best_person_name": self.best_person_name,
            "best_person_title": self.best_person_title,
            "best_linkedin_url": self.best_linkedin_url,
            "best_confidence": self.best_confidence,
            "recommendation": self.recommendation,
        }


def normalize_domain(domain: str) -> str:
    domain = (domain or "").strip().lower()
    domain = re.sub(r"^https?://", "", domain)
    domain = domain.split("/")[0].removeprefix("www.")
    return domain


def is_generic_email(email: str) -> bool:
    local = (email or "").split("@", 1)[0].lower()
    return local in GENERIC_LOCAL_PARTS or local.startswith(("info.", "support.", "security."))


def _clean_person_name(name: str) -> str:
    name = re.sub(r"\([^)]*\)", "", name or "")
    name = re.sub(r"\b(name not publicly listed|not publicly confirmed|role appears vacant|ciso|head of security)\b", "", name, flags=re.I)
    name = re.sub(r"\s+", " ", name).strip(" -/")
    return name


def _looks_like_real_person(name: str) -> bool:
    cleaned = _clean_person_name(name)
    parts = cleaned.split()
    return len(parts) >= 2 and not any(token in cleaned.lower() for token in ("not publicly", "search ", "team"))


def load_key_people(domain: str, company: str) -> list[dict]:
    """Load locally researched decision makers from data/ before generic inboxes."""
    domain = normalize_domain(domain)
    people: list[dict] = []
    seen = set()

    keyed_path = WORKSPACE_DIR / "data" / "brand-guard-key-people.json"
    if keyed_path.exists():
        try:
            keyed = json.loads(keyed_path.read_text())
            for p in keyed.get(domain, []):
                name = _clean_person_name(str(p.get("name") or ""))
                if _looks_like_real_person(name):
                    row = {**p, "name": name, "source": p.get("source") or str(keyed_path)}
                    seen.add(name.lower())
                    people.append(row)
        except Exception:
            pass

    top10_path = WORKSPACE_DIR / "data" / "outreach-contacts-top10.json"
    if top10_path.exists():
        try:
            for row in json.loads(top10_path.read_text()):
                if (row.get("company") or "").lower() != (company or "").lower():
                    continue
                name = _clean_person_name(str(row.get("contact_name") or ""))
                if _looks_like_real_person(name) and name.lower() not in seen:
                    people.append({
                        "name": name,
                        "title": row.get("title"),
                        "linkedin": row.get("linkedin") if str(row.get("linkedin", "")).startswith("http") else None,
                        "x_handle": row.get("x_handle"),
                        "priority": 80,
                        "source": str(top10_path),
                    })
        except Exception:
            pass

    return sorted(people, key=lambda p: int(p.get("priority") or 0), reverse=True)


# ---------------------------------------------------------------------------
# DNS helpers (DoH)
# ---------------------------------------------------------------------------
def doh_query(name: str, rrtype: str) -> list[str]:
    q = urllib.parse.urlencode({"name": name, "type": rrtype})
    for base in DOH_ENDPOINTS:
        try:
            req = urllib.request.Request(
                f"{base}?{q}",
                headers={"User-Agent": USER_AGENT, "Accept": "application/dns-json"},
            )
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            answers = data.get("Answer") or []
            out = []
            for a in answers:
                val = str(a.get("data", "")).strip()
                if rrtype == "TXT":
                    val = "".join(re.findall(r'"([^"]*)"', val)) or val.strip('"')
                if val:
                    out.append(val)
            if out:
                return out
        except Exception:
            continue
    return []


def lookup_mx(domain: str) -> list[str]:
    hosts = []
    for rec in doh_query(domain, "MX"):
        parts = rec.split()
        host = (parts[-1] if parts else rec).rstrip(".").lower()
        if host and host not in hosts:
            hosts.append(host)
    return hosts


# ---------------------------------------------------------------------------
# Published contact discovery
# ---------------------------------------------------------------------------
def fetch_security_txt(domain: str) -> list[str]:
    """Return email addresses found in security.txt."""
    emails = []
    for url in (f"https://{domain}/.well-known/security.txt",
                f"https://{domain}/security.txt"):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": USER_AGENT, "Accept": "text/plain"})
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
                body = resp.read().decode("utf-8", errors="replace")
        except Exception:
            continue
        if "contact:" not in body.lower():
            continue
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
                if "@" in addr:
                    emails.append(addr)
            elif "@" in value:
                emails.append(value)
        if emails:
            break
    return emails


def lookup_rdap_abuse(domain: str) -> list[str]:
    """Return abuse email addresses from RDAP."""
    try:
        req = urllib.request.Request(
            f"https://rdap.org/domain/{urllib.parse.quote(domain)}",
            headers={"User-Agent": USER_AGENT, "Accept": "application/rdap+json"})
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return []

    emails = []
    seen = set()

    def _walk(entities):
        if not isinstance(entities, list):
            return
        for ent in entities:
            if not isinstance(ent, dict):
                continue
            vcard = ent.get("vcardArray")
            if isinstance(vcard, list) and len(vcard) == 2:
                for entry in vcard[1]:
                    if isinstance(entry, list) and len(entry) >= 4 and entry[0] == "email":
                        addr = entry[3]
                        if isinstance(addr, str) and "@" in addr:
                            key = addr.lower()
                            if key not in seen:
                                seen.add(key)
                                emails.append(addr.strip())
            _walk(ent.get("entities"))

    _walk(data.get("entities"))
    return emails


def find_website_contact_page(domain: str) -> Optional[str]:
    """Try to find a contact page on the website."""
    for path in ("/contact", "/contact-us", "/about", "/about-us", "/"):
        url = f"https://{domain}{path}"
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
                body = resp.read().decode("utf-8", errors="replace")[:50000]
        except Exception:
            continue

        # Look for mailto: links
        mailtos = re.findall(r'mailto:([^"\'\s<>]+@[^"\'\s<>]+)', body, re.I)
        if mailtos:
            return url

        # Look for linkedin company URL
        linkedin_match = re.search(
            r'https?://(?:www\.)?linkedin\.com/(?:company|in)/[a-z0-9_-]+',
            body, re.I)
        if linkedin_match:
            return url

    return None


def find_linkedin(domain: str, company: str) -> Optional[str]:
    """Try to find a LinkedIn company URL from the website."""
    for path in ("/", "/about", "/about-us"):
        url = f"https://{domain}{path}"
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
                body = resp.read().decode("utf-8", errors="replace")[:50000]
        except Exception:
            continue

        matches = re.findall(
            r'https?://(?:www\.)?linkedin\.com/company/([a-z0-9_-]+)',
            body, re.I)
        if matches:
            slug = matches[0].rstrip("/").strip('"\'')
            # Filter out generic slugs
            if slug.lower() not in ("company", "linkedin"):
                return f"https://linkedin.com/company/{slug}"

        # Also check for linkedin.com/in/ profiles
        in_matches = re.findall(
            r'https?://(?:www\.)?linkedin\.com/in/([a-z0-9_-]+)',
            body, re.I)
        if in_matches:
            return f"https://linkedin.com/in/{in_matches[0].rstrip('/').strip(chr(34) + chr(39))}"

    return None


def extract_emails_from_page(domain: str) -> list[str]:
    """Extract email addresses from the website's main pages."""
    found = []
    seen = set()

    for path in ("/", "/contact", "/contact-us", "/about", "/about-us"):
        url = f"https://{domain}{path}"
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
                body = resp.read().decode("utf-8", errors="replace")[:50000]
        except Exception:
            continue

        # Find mailto: links
        mailtos = re.findall(r'mailto:([^"\'\s<>]+@[^"\'\s<>]+\.[a-z]{2,})', body, re.I)
        for addr in mailtos:
            clean = addr.strip().lower()
            if clean not in seen and not clean.startswith(("noreply", "no-reply", "donotreply")):
                seen.add(clean)
                found.append(clean)

        # Find plain text emails
        plain = re.findall(
            r'\b([a-z0-9._%+-]+@' + re.escape(domain) + r')\b',
            body, re.I)
        for addr in plain:
            clean = addr.strip().lower()
            if clean not in seen and not clean.startswith(("noreply", "no-reply", "donotreply")):
                seen.add(clean)
                found.append(clean)

    return found


# ---------------------------------------------------------------------------
# Email pattern generation
# ---------------------------------------------------------------------------
def generate_patterns(person_name: Optional[str], domain: str) -> list[tuple[str, str]]:
    """Generate common email patterns for a person. Returns [(email, pattern_desc), ...]"""
    if not person_name:
        return []

    name = person_name.strip().lower()
    # Remove titles
    name = re.sub(r'\b(ceo|cto|cfo|coo|cmo|founder|co-founder|director|vp|president|chief|head|lead|manager|mr|mrs|ms|dr)\b', '', name).strip()
    # Remove punctuation except spaces and hyphens
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()

    if not name:
        return []

    parts = name.split()
    if len(parts) == 1:
        first = parts[0]
        return [
            (f"{first}@{domain}", "first@"),
        ]

    first = parts[0]
    last = parts[-1]
    first_initial = first[0]
    last_initial = last[0]

    patterns = [
        (f"{first}.{last}@{domain}", "first.last@"),
        (f"{first}{last}@{domain}", "firstlast@"),
        (f"{first}@{domain}", "first@"),
        (f"{first_initial}{last}@{domain}", "flast@"),
        (f"{first}{last_initial}@{domain}", "firstl@"),
        (f"{first}_{last}@{domain}", "first_last@"),
        (f"{first}-{last}@{domain}", "first-last@"),
        (f"{last}@{domain}", "last@"),
        (f"{last}.{first}@{domain}", "last.first@"),
        (f"{first_initial}.{last}@{domain}", "f.last@"),
    ]

    return patterns


def generate_generic_patterns(domain: str) -> list[tuple[str, str]]:
    """Generate generic role-based email patterns when no person name is known."""
    return [
        (f"info@{domain}", "info@"),
        (f"contact@{domain}", "contact@"),
        (f"hello@{domain}", "hello@"),
        (f"support@{domain}", "support@"),
        (f"admin@{domain}", "admin@"),
        (f"office@{domain}", "office@"),
        (f"team@{domain}", "team@"),
        (f"sales@{domain}", "sales@"),
        (f"press@{domain}", "press@"),
        (f"security@{domain}", "security@"),
        (f"abuse@{domain}", "abuse@"),
    ]


# ---------------------------------------------------------------------------
# SMTP verification
# ---------------------------------------------------------------------------
def smtp_verify(email: str, mx_host: str) -> tuple[str, str]:
    """
    Verify an email via SMTP RCPT TO.
    Returns (status, detail).
    status ∈ {ok, not_found, auth_required, temp_error, rejected, connect_failed, timeout, error}
    """
    try:
        socket.setdefaulttimeout(10)
        s = smtplib.SMTP(timeout=10)
        s.connect(mx_host, 25)
        s.ehlo("brandguard.check")

        code, msg = s.mail("verify@agenticbro.app")
        if code != 250:
            s.quit()
            return ("mail_from_blocked", f"MAIL FROM returned {code}")

        code, msg = s.rcpt(email)
        msg_str = msg.decode("utf-8", errors="replace") if isinstance(msg, bytes) else str(msg)
        # Collapse multi-line SMTP responses to single line
        msg_str = " ".join(msg_str.split())

        if code in (250, 251):
            s.quit()
            return ("ok", f"{code} {msg_str}")
        elif code in (550, 551, 552, 553):
            s.quit()
            return ("not_found", f"{code} {msg_str}")
        elif code in (450, 451, 452):
            s.quit()
            return ("temp_error", f"{code} {msg_str}")
        elif code == 530:
            s.quit()
            return ("auth_required", f"{code} {msg_str}")
        elif code == 554:
            s.quit()
            return ("rejected", f"{code} {msg_str}")
        else:
            s.quit()
            return ("unknown", f"{code} {msg_str}")

    except smtplib.SMTPConnectError as e:
        return ("connect_failed", str(e))
    except smtplib.SMTPServerDisconnected as e:
        return ("disconnected", str(e))
    except socket.timeout:
        return ("timeout", "Connection timed out")
    except Exception as e:
        return ("error", str(e))


def confidence_from_smtp(status: str) -> tuple[str, bool]:
    """Map SMTP status to confidence level."""
    if status == "ok":
        return ("HIGH", True)
    elif status in ("auth_required", "temp_error", "connect_failed",
                    "disconnected", "timeout", "mail_from_blocked", "unknown"):
        return ("MEDIUM", False)
    elif status in ("not_found", "rejected"):
        return ("LOW", False)
    return ("MEDIUM", False)


# ---------------------------------------------------------------------------
# Main discovery + qualification
# ---------------------------------------------------------------------------
def discover_contacts(domain: str, company: str,
                      person_name: Optional[str] = None,
                      max_smtp_checks: int = 15,
                      skip_smtp: bool = False) -> ContactReport:
    """
    Discover and qualify contact emails for a domain.
    Returns a ContactReport with ranked candidates.
    When skip_smtp=True, only checks MX + published contacts (no SMTP probes).
    """
    domain = normalize_domain(domain)
    report = ContactReport(domain=domain, company=company)
    report.key_people = load_key_people(domain, company)

    # 1. MX lookup
    mx_hosts = lookup_mx(domain)
    report.mx_found = len(mx_hosts) > 0
    report.mx_hosts = mx_hosts

    if not mx_hosts:
        report.recommendation = "no_mx_records"
        return report

    mx_host = mx_hosts[0]

    # 2. Collect published contacts
    published_emails: list[tuple[str, str]] = []  # (email, source)

    # security.txt
    sec_emails = fetch_security_txt(domain)
    for e in sec_emails:
        published_emails.append((e, "security_txt"))

    # RDAP abuse
    rdap_emails = lookup_rdap_abuse(domain)
    for e in rdap_emails:
        published_emails.append((e, "rdap"))

    # Website scrape
    web_emails = extract_emails_from_page(domain)
    for e in web_emails:
        published_emails.append((e, "website"))

    # 3. Generate pattern-based candidates
    pattern_emails: list[tuple[str, str, Optional[dict]]] = []
    if person_name:
        pattern_emails = [(email, desc, {"name": person_name}) for email, desc in generate_patterns(person_name, domain)]
    elif report.key_people:
        for person in report.key_people[:3]:
            for email, desc in generate_patterns(person.get("name"), domain):
                pattern_emails.append((email, desc, person))
    else:
        pattern_emails = [(email, desc, None) for email, desc in generate_generic_patterns(domain)]

    # 4. Combine, dedupe, and prioritize
    all_candidates: list[tuple[str, str, Optional[dict]]] = []
    seen = set()

    # Published first (highest priority)
    for email, source in published_emails:
        key = email.lower()
        if key not in seen:
            seen.add(key)
            all_candidates.append((email, source, None))

    # Then named-person patterns, then generic role addresses.
    for email, pattern_desc, person in pattern_emails:
        key = email.lower()
        if key not in seen:
            seen.add(key)
            prefix = "person_pattern" if person else "pattern"
            all_candidates.append((email, f"{prefix}:{pattern_desc}", person))

    # 5. SMTP verify (limited to max_smtp_checks), unless skip_smtp
    checks_done = 0
    for email, source, person in all_candidates:
        if checks_done >= max_smtp_checks:
            break

        candidate = ContactCandidate(email=email, source=source)
        if person:
            candidate.person_name = person.get("name")
            candidate.person_title = person.get("title")
            candidate.linkedin_url = person.get("linkedin")

        if skip_smtp:
            # MX exists but we're not probing SMTP — mark as MEDIUM
            candidate.confidence = "MEDIUM"
            candidate.smtp_status = "skipped"
            candidate.verified = False
        elif report.mx_found:
            status, detail = smtp_verify(email, mx_host)
            candidate.smtp_status = status
            candidate.smtp_detail = detail
            confidence, verified = confidence_from_smtp(status)
            candidate.confidence = confidence
            candidate.verified = verified
            checks_done += 1
        else:
            candidate.confidence = "LOW"
            candidate.smtp_status = "no_mx"

        report.candidates.append(candidate)

    # 6. Find LinkedIn
    report.linkedin_url = find_linkedin(domain, company)

    # 7. Find contact page
    report.website_contact_url = find_website_contact_page(domain)

    # 8. Pick best
    best = None
    best_confidence_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2, "NONE": 3}

    def candidate_rank(c: ContactCandidate) -> tuple[int, int]:
        confidence_rank = best_confidence_order.get(c.confidence, 3)
        if c.person_name and not is_generic_email(c.email) and c.confidence in ("HIGH", "MEDIUM"):
            bucket = 0
        elif not is_generic_email(c.email) and c.confidence in ("HIGH", "MEDIUM"):
            bucket = 1
        elif is_generic_email(c.email) and c.confidence in ("HIGH", "MEDIUM"):
            bucket = 2
        elif c.person_name and not is_generic_email(c.email):
            bucket = 3
        else:
            bucket = 4
        return (
            bucket,
            confidence_rank,
        )

    for c in report.candidates:
        if best is None or candidate_rank(c) < candidate_rank(best):
            best = c

    if best:
        report.best_email = best.email
        report.best_confidence = best.confidence
        report.best_person_name = best.person_name
        report.best_person_title = best.person_title
        report.best_linkedin_url = best.linkedin_url

    # 9. Recommendation
    if skip_smtp and best and report.mx_found:
        # In skip-smtp mode, MEDIUM is the best we can do — MX exists, patterns match
        report.recommendation = "mx_verified_smtp_skipped"
    elif best and best.confidence == "HIGH":
        report.recommendation = "send_draft"
    elif best and best.confidence == "MEDIUM":
        report.recommendation = "review_before_sending"
    elif best and best.confidence == "LOW":
        report.recommendation = "use_linkedin_or_contact_form"
    else:
        report.recommendation = "no_verified_email_use_linkedin"

    return report


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Discover and qualify contact emails for a company domain.")
    parser.add_argument("--domain", required=True, help="Company domain (e.g. upgrow.com)")
    parser.add_argument("--company", required=True, help="Company name")
    parser.add_argument("--person", help="Person name (e.g. 'Danny Ng') to generate email patterns")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    parser.add_argument("--max-checks", type=int, default=15,
                        help="Max SMTP checks (default 15)")
    parser.add_argument("--skip-smtp", action="store_true",
                        help="Skip SMTP verification (MX + published contacts only)")
    args = parser.parse_args()

    report = discover_contacts(
        domain=args.domain,
        company=args.company,
        person_name=args.person,
        max_smtp_checks=args.max_checks,
        skip_smtp=args.skip_smtp,
    )

    if args.json:
        print(json.dumps(report.to_dict(), indent=2))
    else:
        print(f"\n{'='*60}")
        print(f"  Contact Discovery Report: {args.company}")
        print(f"  Domain: {args.domain}")
        print(f"{'='*60}")
        print(f"\n  MX Records: {'✅ Found' if report.mx_found else '❌ None'}")
        if report.mx_hosts:
            print(f"  MX Hosts: {', '.join(report.mx_hosts[:3])}")
        print(f"  LinkedIn: {report.linkedin_url or 'Not found'}")
        print(f"  Contact Page: {report.website_contact_url or 'Not found'}")

        print(f"\n  Email Candidates ({len(report.candidates)}):")
        print(f"  {'Email':<40} {'Source':<20} {'Confidence':<10} {'SMTP Status'}")
        print(f"  {'-'*40} {'-'*20} {'-'*10} {'-'*20}")
        for c in report.candidates:
            marker = "✅" if c.confidence == "HIGH" else "⚠️" if c.confidence == "MEDIUM" else "❌"
            print(f"  {marker} {c.email:<37} {c.source:<20} {c.confidence:<10} {c.smtp_status}")

        print(f"\n  Best Email: {report.best_email or 'None'}")
        print(f"  Best Confidence: {report.best_confidence}")
        print(f"  Recommendation: {report.recommendation}")

        if report.recommendation == "use_linkedin_or_contact_form":
            print(f"\n  ⚠️  No verified email found.")
            if report.linkedin_url:
                print(f"  → Use LinkedIn: {report.linkedin_url}")
            if report.website_contact_url:
                print(f"  → Use contact form: {report.website_contact_url}")
        print()

    # Exit code
    if report.best_confidence in ("HIGH", "MEDIUM"):
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
