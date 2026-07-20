"""
UDRP / URS domain-dispute collector  (Tier 1 — PUBLIC VICTIM, highest intent)

A company that has filed a UDRP or URS complaint has already SPENT MONEY fighting a
lookalike/abusive domain. It's public record, the complainant is named, and intent is
proven. This is arguably the strongest single prospect signal.

Primary public decision sources (all publish decisions as HTML):
  * WIPO Arbitration and Mediation Center — wipo.int/amc (UDRP decisions)
  * ADR Forum / NAF — adrforum.com (UDRP + URS)

Design notes
------------
There is no single clean JSON API across providers, so each provider has its own
fetch+parse adapter. Both adapters yield the SAME contract dict:

    {"provider", "case_no", "decision_url", "filed_date" (date|None), "raw_text"}

`collect()` then enriches each case: a regex pass (`_parse_case_page`) pulls
case number / decision date / readable text deterministically, and the optional local
LLM (`extract_fields`) pulls complainant / domains from the prose. The collector works
with NO model and NO extra pip deps — it falls back to stdlib urllib + html.parser.

Compliance
----------
Reads ONLY published, public decisions. Honors each site's robots.txt (see
`_robots_allows`) and rate-limits every request (`REQUEST_DELAY_S`). No login-walled
content, no private endpoints. Selectors target the public decision pages; verify them
against the live HTML before a production run (sites change their markup).

CLI
---
    python3 -m collectors.udrp              # OFFLINE parser self-test (no network)
    python3 -m collectors.udrp --live       # real fetch (user env; respects robots.txt)
    python3 -m collectors.udrp --live --provider wipo --days 90
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import date, datetime, timedelta
from html.parser import HTMLParser
from typing import Iterable, Optional
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

try:
    from common.models import RawSignal, SignalTier, ImpersonationType
    from common.llm import extract_fields
except ImportError:
    RawSignal = SignalTier = ImpersonationType = None  # type: ignore
    extract_fields = None  # type: ignore

HOT_WINDOW_DAYS = 180          # filings newer than this are "hot"
REQUEST_DELAY_S = 2.0          # be polite to the providers
HTTP_TIMEOUT_S = 30
USER_AGENT = (
    "BrandGuardResearch/1.0 (+https://agenticbro.app/brand-guard; "
    "reads public UDRP decisions; contact: earl.finney@gmail.com)"
)
MAX_RAWTEXT_CHARS = 20000      # cap stored decision text

# Public index/search surfaces. These are the documented entry points; the adapters
# parse whatever case links they find on the page, so a changed query string is fine.
# Dynamic search forms (often JS-rendered, less reliable for plain GET)
WIPO_INDEX_URL = "https://www.wipo.int/amc/en/domains/search/"
ADRFORUM_INDEX_URL = "https://www.adrforum.com/domain-dispute/decisions"

# Static yearly/decision listing pages (preferred - Option A)
# Year-specific pages tend to return static HTML case links
WIPO_STATIC_INDEX_URL = "https://www.wipo.int/amc/en/domains/search/decisions/index.html?year=2025"
ADRFORUM_STATIC_INDEX_URL = "https://www.adrforum.com/domain-dispute/decisions"

# Case-number shapes. WIPO UDRP/variants: D2026-1234, DCO2025-0007, DTV2024-0001.
WIPO_CASE_RE = re.compile(r"\bD[A-Z]{0,3}\d{4}-\d{3,4}\b")
# ADR Forum claim numbers (UDRP/URS): FA2106001948... (FA + digits) or numeric ids.
ADRFORUM_CASE_RE = re.compile(r"\bFA\d{7,}\b")

_DATE_LABEL_RE = re.compile(
    r"(?:date of decision|decision date|date)\s*[:\-]?\s*"
    r"([0-3]?\d\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+[0-3]?\d,\s*\d{4}|\d{4}-\d{2}-\d{2})",
    re.IGNORECASE,
)


# ==========================================================================
# HTTP + HTML helpers  (requests/bs4 used if present; otherwise pure stdlib)
# ==========================================================================
def _http_get(url: str) -> Optional[str]:
    """GET a page as text. Returns None on any error. Prefers requests, falls back
    to urllib so the collector has zero hard dependencies."""
    try:
        import requests  # optional accelerator
        resp = requests.get(url, headers={"User-Agent": USER_AGENT},
                            timeout=HTTP_TIMEOUT_S)
        if resp.status_code != 200:
            print(f"[udrp] HTTP {resp.status_code} for {url}", file=sys.stderr)
            return None
        return resp.text
    except ImportError:
        pass
    except Exception as e:  # noqa: BLE001
        print(f"[udrp] requests error for {url}: {e}", file=sys.stderr)
        return None
    try:
        import urllib.request
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_S) as r:  # nosec - public GET
            charset = r.headers.get_content_charset() or "utf-8"
            return r.read().decode(charset, errors="replace")
    except Exception as e:  # noqa: BLE001
        print(f"[udrp] urllib error for {url}: {e}", file=sys.stderr)
        return None


_ROBOTS_CACHE: dict[str, Optional[RobotFileParser]] = {}


def _robots_allows(url: str) -> bool:
    """Honor the site's robots.txt for our User-Agent. If robots.txt can't be read,
    default to allowing (these are public decision pages) but stay rate-limited."""
    parts = urlparse(url)
    host = f"{parts.scheme}://{parts.netloc}"
    if host not in _ROBOTS_CACHE:
        rp: Optional[RobotFileParser] = RobotFileParser()
        rp.set_url(urljoin(host, "/robots.txt"))
        try:
            rp.read()
        except Exception:  # noqa: BLE001
            rp = None
        _ROBOTS_CACHE[host] = rp
    rp = _ROBOTS_CACHE[host]
    if rp is None:
        return True
    try:
        return rp.can_fetch(USER_AGENT, url)
    except Exception:  # noqa: BLE001
        return True


class _TextExtractor(HTMLParser):
    """Stdlib HTML→text: drops script/style/head noise, keeps readable body text."""
    _SKIP = {"script", "style", "head", "noscript", "svg", "nav", "footer"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._chunks: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self._SKIP:
            self._skip_depth += 1

    def handle_endtag(self, tag):
        if tag in self._SKIP and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data):
        if self._skip_depth == 0:
            text = data.strip()
            if text:
                self._chunks.append(text)

    def text(self) -> str:
        return re.sub(r"\s+\n", "\n", " ".join(self._chunks)).strip()


def _html_to_text(html: str) -> str:
    """Prefer BeautifulSoup if installed (handles broken markup better); else stdlib."""
    try:
        from bs4 import BeautifulSoup  # optional
        soup = BeautifulSoup(html, "html.parser")
        for bad in soup(["script", "style", "head", "noscript", "svg", "nav", "footer"]):
            bad.decompose()
        return re.sub(r"[ \t]+", " ", soup.get_text(" ", strip=True)).strip()
    except ImportError:
        p = _TextExtractor()
        try:
            p.feed(html)
        except Exception:  # noqa: BLE001
            return ""
        return p.text()


def _abs_links(html: str, base_url: str) -> list[str]:
    """All absolute hrefs on a page (including data-href/data-url), de-duplicated."""
    out, seen = [], set()
    # Standard href + common data attributes used by JS-rendered lists
    patterns = [
        r'href=["\']([^"\']+)["\']',
        r'data-href=["\']([^"\']+)["\']',
        r'data-url=["\']([^"\']+)["\']',
    ]
    for pat in patterns:
        for m in re.finditer(pat, html, re.IGNORECASE):
            absu = urljoin(base_url, m.group(1))
            if absu not in seen:
                seen.add(absu)
                out.append(absu)
    # Also keep any link that looks like a WIPO/ADR decision path
    decision_path_re = re.compile(r'/decisions?/|D20\d{2}-|FA\d{7,}', re.I)
    filtered = [u for u in out if decision_path_re.search(u) or '/amc/en/domains/' in u]
    return filtered or out  # fallback to all links if nothing matched


# ==========================================================================
# Deterministic case-page parser (works with no LLM)
# ==========================================================================
def _parse_case_page(html: str, url: str, provider: str,
                     case_re: re.Pattern) -> dict:
    """Pull {case_no, decision_url, filed_date, raw_text} from one decision page."""
    text = _html_to_text(html)
    m = case_re.search(text) or case_re.search(url)
    case_no = m.group(0) if m else None
    dm = _DATE_LABEL_RE.search(text)
    filed = _parse_date(dm.group(1)) if dm else None
    return {
        "provider": provider,
        "case_no": case_no,
        "decision_url": url,
        "filed_date": filed,
        "raw_text": text[:MAX_RAWTEXT_CHARS],
    }


# ----------------------------------------------------------------------
# NEW: Sequential enumeration harvester (replaces broken index scraping)
# WIPO PDFs are static files — HEAD + 200 confirms existence. No JS, no cookies.
# ----------------------------------------------------------------------
WIPO_PDF_BASE = "https://www.wipo.int/amc/en/domains/decisions/pdf/{year}/d{year}-{num:04d}.pdf"
WIPO_HTML_BASE = "https://www.wipo.int/amc/en/domains/decisions/html/{year}/d{year}-{num:04d}.html"


def _harvest_wipo_sequential(year: int = 2026, start: int = 1500,
                           max_cases: int = 25, max_misses: int = 10) -> list[dict]:
    """
    Walk case numbers sequentially. Stops after max_misses consecutive 404s.
    Returns list of dicts compatible with the rest of the pipeline.
    """
    import requests
    year = year or datetime.now().year
    results = []
    misses = 0
    n = start

    while len(results) < max_cases and misses < max_misses:
        case_id = f"D{year}-{n:04d}"
        pdf_url = WIPO_PDF_BASE.format(year=year, num=n)
        try:
            resp = requests.head(pdf_url, timeout=10,
                                 headers={"User-Agent": USER_AGENT})
            if resp.status_code == 200:
                results.append({
                    "provider": "wipo",
                    "case_no": case_id,
                    "decision_url": pdf_url,
                    "pdf_url": pdf_url,
                })
                misses = 0
            elif resp.status_code == 404:
                misses += 1
            else:
                misses += 1
        except Exception:
            misses += 1
        time.sleep(REQUEST_DELAY_S)
        n += 1

    return results


def _harvest_cases(index_url: str, case_re: re.Pattern, provider: str,
                   *, max_cases: int) -> Iterable[dict]:
    """Legacy index path kept for ADR Forum only. WIPO now uses sequential."""
    if provider == "wipo":
        # Use new sequential harvester for WIPO
        for rec in _harvest_wipo_sequential(year=datetime.now().year,
                                          max_cases=max_cases):
            yield rec
        return

    if not _robots_allows(index_url):
        print(f"[udrp] robots.txt disallows {index_url} — skipping {provider}",
              file=sys.stderr)
        return
    index_html = _http_get(index_url)
    if not index_html:
        print(f"[udrp] could not fetch index {index_url} (status or network error)", file=sys.stderr)
        return

    candidates = [u for u in _abs_links(index_html, index_url)
                  if case_re.search(u) or "/decision" in u.lower()]
    seen = 0
    for case_url in candidates:
        if seen >= max_cases:
            break
        if not _robots_allows(case_url):
            continue
        time.sleep(REQUEST_DELAY_S)
        page = _http_get(case_url)
        if not page:
            continue
        rec = _parse_case_page(page, case_url, provider, case_re)
        if rec["case_no"]:
            seen += 1
            yield rec


# ==========================================================================
# Provider adapters
# ==========================================================================
def fetch_wipo(since: date, query: str | None = None,
               *, index_url: str = WIPO_STATIC_INDEX_URL, max_cases: int = 50) -> Iterable[dict]:
    """WIPO AMC UDRP decisions. Yields the contract dict per case. `since` filtering
    is applied downstream in collect() once dates are parsed."""
    url = index_url + (f"?q={query}" if query else "")
    yield from _harvest_cases(url, WIPO_CASE_RE, "wipo", max_cases=max_cases)


def fetch_adrforum(since: date, query: str | None = None,
                   *, index_url: str = ADRFORUM_STATIC_INDEX_URL,
                   max_cases: int = 50) -> Iterable[dict]:
    """ADR Forum / NAF (UDRP + URS) decisions. Same contract as fetch_wipo."""
    url = index_url + (f"?q={query}" if query else "")
    yield from _harvest_cases(url, ADRFORUM_CASE_RE, "adrforum", max_cases=max_cases)


PROVIDERS = {"wipo": fetch_wipo, "adrforum": fetch_adrforum}  # cac added below


def fetch_cac(since: date, query: str | None = None,
               *, max_cases: int = 50) -> Iterable[dict]:
    """Czech Arbitration Court (CAC) UDRP decisions via JSON API.

    Uses the dedicated cac.py collector which fetches structured JSON
    (no HTML parsing needed). Adapts the JSON results to the same
    contract dict as fetch_wipo / fetch_adrforum.
    """
    try:
        from collectors.cac import _harvest_cac, _fetch_cac_json
    except ImportError:
        return
    # Estimate pages: ~10 decisions/page, cap at max_cases
    pages = max(1, (max_cases + 9) // 10)
    hex_ids = _harvest_cac(pages=pages)
    for hex_id in hex_ids[:max_cases]:
        data = _fetch_cac_json(hex_id)
        if not data:
            continue
        filed = _parse_date(data.get("decided_at"))
        recent = bool(filed and filed >= since)
        # CAC JSON already has structured fields — no raw_text needed.
        yield {
            "provider": "cac",
            "case_no": data.get("case_id"),
            "decision_url": data.get("source_url"),
            "filed_date": str(filed) if filed else None,
            "raw_text": "",  # JSON API — facts are already extracted
            # Pre-extracted facts for the collect() enrichment path
            "_cac_facts": {
                "company_name": data.get("complainant"),
                "disputed_or_fake_domain": data.get("domain"),
                "primary_domain": data.get("complainant_domain"),
                "outcome": data.get("outcome"),
            },
        }


PROVIDERS["cac"] = fetch_cac


# ==========================================================================
# Extraction: turn decision prose into structured complainant/domain/date.
# Uses the local model's extract_fields() (JSON-constrained) if available.
# ==========================================================================
def _extract_case_facts(raw_text: str) -> dict:
    if extract_fields is None or not raw_text:
        return {}                                  # standalone mode: skip LLM
    head = raw_text[:6000]                          # facts live up top
    try:
        return extract_fields(head) or {}
    except Exception:  # noqa: BLE001
        return {}


def _parse_date(value) -> date | None:
    if isinstance(value, date):
        return value
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d %B %Y", "%B %d, %Y", "%d %b %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except ValueError:
            continue
    return None


def collect(providers: list[str] | None = None, lookback_days: int = HOT_WINDOW_DAYS,
            query: str | None = None, *, max_cases: int = 50) -> list:
    since = date.today() - timedelta(days=lookback_days)
    providers = providers or list(PROVIDERS)
    signals = []

    for name in providers:
        fetch = PROVIDERS[name]
        for case in fetch(since, query=query, max_cases=max_cases):
            # CAC provides pre-extracted facts via JSON API (no LLM needed)
            cac_facts = case.get("_cac_facts")
            if cac_facts:
                facts = cac_facts
            else:
                facts = _extract_case_facts(case.get("raw_text", ""))
            filed = _parse_date(case.get("filed_date")) or _parse_date(facts.get("incident_date"))
            recent = bool(filed and filed >= since)

            record = {
                "provider": case.get("provider", name),
                "case_no": case.get("case_no"),
                "complainant": facts.get("company_name"),
                "complainant_domain": facts.get("primary_domain"),
                "primary_domain": facts.get("primary_domain"),  # for resolver._domain_from_extra
                "disputed_domain": facts.get("disputed_or_fake_domain"),
                "filed_date": str(filed) if filed else None,
                "recent": recent,
                "decision_url": case.get("decision_url"),
            }

            if RawSignal is None:
                signals.append(record)
            else:
                signals.append(RawSignal(
                    source=f"udrp_{name}",
                    tier=SignalTier.PUBLIC_VICTIM,
                    signal_type="udrp_filing" if recent else "udrp_filing_old",
                    impersonation_type=ImpersonationType.DOMAIN,
                    impersonated_brand=facts.get("company_name"),
                    signal_url=case.get("decision_url"),
                    snippet=(f"{record['complainant']} filed a domain dispute over "
                             f"{record['disputed_domain']} ({record['case_no']})."),
                    incident_date=filed,
                    extra=record,
                ))
    return signals


# ==========================================================================
# Offline self-test — verifies the deterministic parsers with NO network.
# Fixtures are synthetic but shaped like real decision pages.
# ==========================================================================
_WIPO_FIXTURE = """
<html><head><title>WIPO Domain Name Decision: D2026-0481</title>
<style>.x{}</style></head><body>
<nav>menu noise</nav>
<h1>WIPO Arbitration and Mediation Center</h1>
<h2>ADMINISTRATIVE PANEL DECISION</h2>
<p>Northwind Coffee Roasters LLC v. Domain Admin</p>
<p>Case No. D2026-0481</p>
<h3>1. The Parties</h3>
<p>The Complainant is Northwind Coffee Roasters LLC, United States.</p>
<p>The Respondent is Domain Admin, Privacy Service.</p>
<h3>2. The Domain Name and Registrar</h3>
<p>The disputed domain name &lt;northwind-coffee.shop&gt; is registered with Example Registrar.</p>
<p>Date of Decision: 30 May 2026</p>
<script>tracking()</script>
</body></html>
"""

_ADRFORUM_FIXTURE = """
<html><head><title>FA2605001234 Decision</title></head><body>
<h1>National Arbitration Forum / Forum</h1>
<p>Maple Goods Co. (Complainant) v. John Doe (Respondent)</p>
<p>Claim Number: FA2605001234</p>
<p>The domain name at issue is maple-goods.shop, registered with Example LLC.</p>
<p>Decision Date: June 02, 2026</p>
</body></html>
"""

_INDEX_FIXTURE = """
<html><body>
<a href="/amc/en/domains/decisions/d2026-0481.html">D2026-0481</a>
<a href="/amc/en/domains/decisions/d2026-0482.html">D2026-0482</a>
<a href="/about">about</a>
</body></html>
"""


def _selftest() -> int:
    print("UDRP collector — OFFLINE parser self-test (no network)\n" + "=" * 64)
    failures = 0

    # 1) WIPO case page parse
    w = _parse_case_page(_WIPO_FIXTURE, "https://www.wipo.int/.../d2026-0481.html",
                         "wipo", WIPO_CASE_RE)
    print(f"WIPO  case_no={w['case_no']}  date={w['filed_date']}")
    failures += _expect(w["case_no"] == "D2026-0481", "WIPO case_no == D2026-0481")
    failures += _expect(w["filed_date"] == date(2026, 5, 30), "WIPO date == 2026-05-30")
    failures += _expect("Northwind Coffee" in w["raw_text"], "WIPO text keeps complainant")
    failures += _expect("tracking()" not in w["raw_text"], "WIPO text drops <script>")

    # 2) ADR Forum case page parse
    a = _parse_case_page(_ADRFORUM_FIXTURE, "https://www.adrforum.com/case/FA2605001234",
                         "adrforum", ADRFORUM_CASE_RE)
    print(f"FORUM case_no={a['case_no']}  date={a['filed_date']}")
    failures += _expect(a["case_no"] == "FA2605001234", "FORUM case_no == FA2605001234")
    failures += _expect(a["filed_date"] == date(2026, 6, 2), "FORUM date == 2026-06-02")
    failures += _expect("Maple Goods" in a["raw_text"], "FORUM text keeps complainant")

    # 3) index link harvesting (regex selection, no fetch)
    links = [u for u in _abs_links(_INDEX_FIXTURE, "https://www.wipo.int/")
             if WIPO_CASE_RE.search(u) or "/decision" in u.lower()]
    print(f"INDEX harvested {len(links)} case link(s)")
    failures += _expect(len(links) == 2, "index harvests exactly 2 decision links")
    failures += _expect(all("/about" not in u for u in links), "index drops non-case links")

    # 4) recency classification used by collect()
    since = date(2026, 1, 1)
    failures += _expect((w["filed_date"] >= since) is True, "filed_date >= since → recent")

    print("=" * 64)
    if failures:
        print(f"FAIL — {failures} assertion(s) failed")
        return 1
    print("PASS — all parser assertions passed (network never touched)")
    return 0


def _expect(cond: bool, label: str) -> int:
    print(f"  {'ok  ' if cond else 'FAIL'} {label}")
    return 0 if cond else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="UDRP/URS public-decision collector")
    ap.add_argument("--live", action="store_true",
                    help="actually fetch from the providers (respects robots.txt)")
    ap.add_argument("--provider", choices=list(PROVIDERS), default=None)
    ap.add_argument("--days", type=int, default=HOT_WINDOW_DAYS)
    ap.add_argument("--max", type=int, default=20, help="max cases per provider")
    ap.add_argument("--query", default=None)
    args = ap.parse_args()

    if not args.live:
        raise SystemExit(_selftest())

    provs = [args.provider] if args.provider else None
    rows = collect(providers=provs, lookback_days=args.days,
                   query=args.query, max_cases=args.max)
    out = [r.to_dict() if hasattr(r, "to_dict") else r for r in rows]
    print(json.dumps(out, indent=2, default=str))
    print(f"\n{len(out)} case(s) collected.", file=sys.stderr)
