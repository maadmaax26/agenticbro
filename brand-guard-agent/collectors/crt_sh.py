"""
crt.sh lookalike-domain collector  (Tier 3 — EXPOSURE qualifier)

Reuses Brand Guard's Domain Monitor idea: query Certificate Transparency logs for
certs issued to domains that resemble a brand, then score the resemblance in code
(edit distance + homoglyph/IDN detection + recency).

IMPORTANT: This is a Tier-3 *qualifier*, not a primary prospect source. A lookalike
domain means a company COULD be a target, not that anyone was harmed. Use the output
to strengthen a Tier-1/2 signal, not to cold-prospect on its own.

Public data only (crt.sh is a public CT-log mirror). No auth, no scraping behind logins.

Deps: stdlib only. (Swap urllib for requests if you prefer.)
Usage:  python crt_sh.py northwindcoffee
"""
from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta

# Local imports work when run from the project root: python -m collectors.crt_sh
try:
    from common.models import RawSignal, SignalTier, ImpersonationType
except ImportError:                          # allow running the file directly
    RawSignal = SignalTier = ImpersonationType = None  # type: ignore

CRT_SH = "https://crt.sh/?q=%25{brand}%25&output=json"
RECENT_DAYS = 60                             # "newly registered" window of interest

# Characters scammers swap to build convincing lookalikes.
HOMOGLYPHS = {
    "o": "0", "l": "1", "i": "1", "e": "3", "a": "@", "s": "5",
    "m": "rn", "w": "vv", "b": "d",
}


def _fetch(brand: str) -> list[dict]:
    url = CRT_SH.format(brand=urllib.parse.quote(brand))
    req = urllib.request.Request(url, headers={"User-Agent": "BrandGuard-Research/0.1"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def homoglyph_variants(brand: str) -> set[str]:
    """Generate common single-substitution homoglyph forms of the brand label."""
    out = {brand}
    for i, ch in enumerate(brand):
        if ch in HOMOGLYPHS:
            out.add(brand[:i] + HOMOGLYPHS[ch] + brand[i + 1:])
    return out


def is_lookalike(candidate_label: str, brand: str) -> bool:
    """True if candidate label resembles the brand but isn't the brand itself."""
    cand = candidate_label.lower()
    brand = brand.lower()
    if cand == brand:
        return False
    if brand in cand or cand in brand:                    # brand-coffee, brand-login, ...
        return True
    if levenshtein(cand, brand) <= max(1, len(brand) // 6):  # close typo
        return True
    if cand in homoglyph_variants(brand):                 # o->0, l->1, rn->m, ...
        return True
    return False


def collect(brand: str, official_domains: set[str] | None = None) -> list:
    """
    Return RawSignal records for lookalike domains found in CT logs.
    `official_domains` are the legitimate domains to exclude (e.g. {"northwindcoffee.com"}).
    """
    official_domains = {d.lower() for d in (official_domains or set())}
    cutoff = date.today() - timedelta(days=RECENT_DAYS)
    seen: dict[str, dict] = {}

    for row in _fetch(brand):
        # name_value can hold several SANs separated by newlines
        for name in str(row.get("name_value", "")).split("\n"):
            name = name.strip().lstrip("*.").lower()
            if not name or name in official_domains:
                continue
            label = name.split(".")[0]
            if not is_lookalike(label, brand):
                continue
            try:
                first_seen = datetime.strptime(
                    row.get("not_before", "")[:10], "%Y-%m-%d"
                ).date()
            except ValueError:
                first_seen = None
            # keep the earliest sighting per domain
            if name not in seen or (first_seen and first_seen < seen[name]["first_seen"]):
                seen[name] = {"first_seen": first_seen, "issuer": row.get("issuer_name")}

    signals = []
    for domain, meta in seen.items():
        recent = bool(meta["first_seen"] and meta["first_seen"] >= cutoff)
        if RawSignal is None:                              # running standalone
            signals.append({"domain": domain, "recent": recent,
                            "first_seen": str(meta["first_seen"])})
            continue
        signals.append(RawSignal(
            source="crt.sh",
            tier=SignalTier.EXPOSURE,
            signal_type="lookalike_domain",
            impersonation_type=ImpersonationType.DOMAIN,
            impersonated_brand=brand,
            signal_url=f"https://crt.sh/?q=%25{urllib.parse.quote(brand)}%25",
            snippet=f"Lookalike domain {domain} in CT logs (first seen {meta['first_seen']}).",
            incident_date=meta["first_seen"],
            extra={"domain": domain, "recent": recent, "issuer": meta["issuer"]},
        ))
    return signals


if __name__ == "__main__":
    brand = sys.argv[1] if len(sys.argv) > 1 else "northwindcoffee"
    results = collect(brand, official_domains={f"{brand}.com"})
    out = [r.to_dict() if hasattr(r, "to_dict") else r for r in results]
    print(json.dumps(out, indent=2, default=str))
    print(f"\n{len(out)} lookalike candidate(s) for '{brand}'", file=sys.stderr)
