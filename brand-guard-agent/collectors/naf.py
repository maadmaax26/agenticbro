"""
NAF / ADR Forum UDRP collector (sequential HTML walker)
"""

import re
import time
import requests
from datetime import datetime
from typing import Iterable

REQUEST_DELAY_S = 2.0
USER_AGENT = "BrandGuardResearch/1.0 (+https://agenticbro.app/brand-guard)"

NAF_BASE = "https://www.adrforum.com/DomainDecisions/{num}.htm"
NAF_CASE_RE = re.compile(r'Claim Number:\s*(FA\d+)')


def _harvest_naf_sequential(start: int = 2215000, max_cases: int = 25,
                            max_misses: int = 10) -> list[dict]:
    """
    Walk NAF decision numbers sequentially.
    Active range for 2026: ~2,210,000+
    """
    results = []
    misses = 0
    n = start

    while len(results) < max_cases and misses < max_misses:
        url = NAF_BASE.format(num=n)
        try:
            resp = requests.head(url, timeout=10,
                                 headers={"User-Agent": USER_AGENT})
            if resp.status_code == 200:
                results.append({
                    "provider": "naf",
                    "case_no": f"FA{n}",
                    "decision_url": url,
                })
                misses = 0
            else:
                misses += 1
        except Exception:
            misses += 1

        time.sleep(REQUEST_DELAY_S)
        n += 1

    return results


def _parse_naf_html(text: str, case_id: str) -> dict:
    """Extract structured fields from NAF HTML decision page."""
    domain = re.search(r'<([a-z0-9][a-z0-9\-\.]+\.[a-z]{2,})>', text)
    complainant = re.search(r'Complainant is (.+?)[,\.]', text)
    outcome_granted = bool(re.search(r'relief shall be GRANTED', text, re.I))
    date_match = re.search(r'Dated:\s+(\w+ \d+,\s+\d{4})', text)

    return {
        "case_id": case_id,
        "domain": domain.group(1) if domain else None,
        "complainant": complainant.group(1).strip() if complainant else None,
        "outcome": "transfer" if outcome_granted else "denied",
        "decided_at": date_match.group(1) if date_match else None,
        "source_url": NAF_BASE.format(num=case_id.replace("FA", "")),
        "provider": "naf",
    }