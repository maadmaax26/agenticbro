"""CAC UDRP collector (JSON API)

Czech Arbitration Court publishes UDRP decisions with a native JSON download
endpoint. No PDF or HTML parsing required — each decision is fetched as
structured JSON. The decisions list page is static HTML and is scraped for
the hex IDs that key each JSON download.

Providers covered: CAC (udrp.adr.eu)
"""
import re
import time
import requests
from bs4 import BeautifulSoup

REQUEST_DELAY_S = 2.0
USER_AGENT = "BrandGuardResearch/1.0"

CAC_LIST = "https://udrp.adr.eu/decisions/list?grid-page={page}&grid-sort%5Bpublished%5D=DESC&do=grid-page"
CAC_JSON = "https://udrp.adr.eu/decisions/download-json?id={hex_id}"

# TLDs we recognize when extracting domains from prose
_TLD_RE = re.compile(r"\b([\w-]+\.(?:com|net|org|eu|de|fr|ai|io|co|uk|nl|it|es|se|pl|cz|at|ch|be|dk|fi|no|pt|ie|ro|hu|gr|sk|si|lt|lv|ee|bg|hr|lu|mt|cy|info|biz|store|shop|online|site|app|dev))\b", re.IGNORECASE)


def _extract_complainant_domain(factual_background: str, complainant: str) -> str:
    """Best-effort extraction of the complainant's legitimate domain from the
    factual_background HTML text. Falls back to empty string."""
    if not factual_background:
        return ""
    # Strip HTML tags
    text = BeautifulSoup(factual_background, "html.parser").get_text()
    # Look for URLs mentioned in the background
    urls = re.findall(r"https?://([\w.-]+)", text)
    # Filter out the disputed domains (they'll be in domain_names) and common non-brand domains
    exclude = {"wikipedia.org", "google.com", "facebook.com", "twitter.com", "x.com", "instagram.com"}
    for url in urls:
        host = url.lower().lstrip("www.")
        if host not in exclude and len(host) > 4:
            return host
    # Fallback: look for bare domain mentions
    domains = _TLD_RE.findall(text)
    for d in domains:
        d = d.lower()
        if d not in exclude and len(d) > 4:
            return d
    return ""


def _harvest_cac(pages=3):
    """Scrape the CAC decisions list for hex IDs (most-recent-first).

    Each list page holds 10 decisions by default. 3 pages = ~30 most recent.
    Returns a list of hex id strings to feed into _fetch_cac_json.
    """
    results = []
    for page in range(1, pages + 1):
        try:
            resp = requests.get(
                CAC_LIST.format(page=page),
                headers={"User-Agent": USER_AGENT},
                timeout=15,
            )
            soup = BeautifulSoup(resp.text, "html.parser")
            for a in soup.find_all("a", href=re.compile(r"download-json\?id=")):
                m = re.search(r"id=([a-f0-9]+)", a["href"])
                if m:
                    results.append(m.group(1))
            time.sleep(REQUEST_DELAY_S)
        except Exception:
            continue
    return results


def _fetch_cac_json(hex_id):
    """Fetch a single CAC decision as structured JSON.

    Maps the CAC `result` field to a standard outcome:
      Accepted -> transfer
      Rejected -> denied
      anything else (e.g. Terminated settlement) -> other
    Returns {} on any failure so the caller can skip cleanly.
    """
    try:
        resp = requests.get(
            CAC_JSON.format(hex_id=hex_id),
            headers={"User-Agent": USER_AGENT},
            timeout=15,
        )
        data = resp.json()
        result = data.get("decision", "") or data.get("result", "")
        if result == "Accepted":
            outcome = "transfer"
        elif result == "Rejected":
            outcome = "denied"
        else:
            outcome = "other"
        complainant_name = (data.get("complainant") or [""])[0]
        domain_names = data.get("domain_names") or []
        factual_bg = str(data.get("factual_background") or "")
        complainant_domain = _extract_complainant_domain(factual_bg, complainant_name)

        return {
            "case_id": data.get("case_number"),
            "domain": domain_names[0] if domain_names else "",
            "domains": domain_names,
            "complainant": complainant_name,
            "complainant_domain": complainant_domain,
            "respondent": (data.get("respondent") or [""])[0],
            "outcome": outcome,
            "decided_at": data.get("date_of_panel_decision") or data.get("published"),
            "source_url": f"https://udrp.adr.eu/decisions/detail?id={hex_id}",
            "provider": "cac",
        }
    except Exception:
        return {}