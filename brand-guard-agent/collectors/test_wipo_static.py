#!/usr/bin/env python3
"""Test promising static WIPO decision listing URLs."""

import sys
sys.path.insert(0, ".")

from collectors.udrp import _http_get, _abs_links, WIPO_CASE_RE

candidates = [
    "https://www.wipo.int/amc/en/domains/search/decisions/index.html",
    "https://www.wipo.int/amc/en/domains/search/decisions/",
    "https://www.wipo.int/amc/en/domains/decisions/",
    "https://www.wipo.int/amc/en/domains/search/decisions/index.html?year=2024",
    "https://www.wipo.int/amc/en/domains/search/decisions/index.html?year=2023",
]

for url in candidates:
    html = _http_get(url)
    if not html:
        print(f"FAIL: {url}")
        continue

    links = _abs_links(html, url)
    case_links = [u for u in links if WIPO_CASE_RE.search(u)]
    print(f"OK:   {url}")
    print(f"      total_links={len(links):4}  case_links={len(case_links)}")
    if case_links:
        print(f"      example: {case_links[0]}")
    print()