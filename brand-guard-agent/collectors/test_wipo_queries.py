#!/usr/bin/env python3
"""Quick diagnostic: test different query values on WIPO search URL."""

import sys
sys.path.insert(0, ".")

from collectors.udrp import _http_get, _abs_links, WIPO_CASE_RE, WIPO_INDEX_URL

queries = [None, "", "domain", "udrp", "2025", "wipo", "dispute"]

for q in queries:
    url = WIPO_INDEX_URL + (f"?q={q}" if q else "")
    html = _http_get(url)
    if not html:
        print(f"query={q!r:8} -> fetch failed")
        continue

    links = _abs_links(html, WIPO_INDEX_URL)
    case_links = [u for u in links if WIPO_CASE_RE.search(u)]
    print(f"query={q!r:8} -> total_links={len(links):4}  case_links={len(case_links)}")

print("\nDone.")