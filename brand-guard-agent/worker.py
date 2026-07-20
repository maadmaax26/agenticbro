#!/usr/bin/env python3
"""
worker.py — daily discovery → review-queue populator (for the OpenClaw cron).

What it does (and ONLY this):

    collect signals  →  resolve → score → route → draft  →  queue as UNREVIEWED

It calls the pipeline you already have (collectors.udrp + pipeline.resolver.enqueue)
and persists each resulting draft to the store with approval='unreviewed'. That is
exactly the row the Drafts approval console reads
(GET /api/brand-guard/admin/review-queue). A human still approves every draft in
that UI before anything is eligible to send.

This script adds NO scoring / routing / drafting / sending logic of its own, and it
NEVER transmits mail. It does not import any transport. The send_worker is a
separate, dry-run-by-default stage and is not touched here.

Safety posture (all on by default):
  * OFFLINE by default. With no flags it uses an in-memory store and the UDRP
    collector's OFFLINE fixtures — no network, nothing persisted anywhere durable.
  * --live is required to (a) talk to the network (live UDRP collect) and
    (b) write unreviewed drafts to the real Supabase store. Even then: nothing is
    approved and nothing is sent. It only fills the human review queue.

Usage:
    python3 worker.py                       # offline dry-run (fixtures, in-memory)
    python3 worker.py --days 30 --max-cases 25   # offline, just changes the knobs
    python3 worker.py --live                 # REAL collect + REAL enqueue (unreviewed)
    python3 worker.py --live --days 14 --max-cases 40

Exit code: 0 on a clean run, 1 if the pipeline raised.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import os
import sys
from typing import Any, Optional

# Make `python3 worker.py` work from anywhere.
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from common.models import RawSignal, SignalTier, ImpersonationType  # noqa: E402
from datetime import date as _date                          # noqa: E402


def _parse_date_safe(val):
    """Parse YYYY-MM-DD or ISO date string; return None on failure."""
    if not val:
        return None
    try:
        return _date.fromisoformat(str(val)[:10])
    except Exception:
        return None
from pipeline.resolver import enqueue               # noqa: E402
from db.store import InMemoryStore, connect          # noqa: E402

# The offline-fixture prospect seeding already lives in run.py; reuse it so the
# dry-run path needs no network and no duplicated fixture parsing.
try:
    from collectors import udrp                      # noqa: E402
    from collectors.naf import _harvest_naf_sequential, _parse_naf_html  # noqa: E402
    from collectors.cac import _harvest_cac, _fetch_cac_json  # noqa: E402
except Exception:                                    # noqa: BLE001
    udrp = None  # type: ignore
    _harvest_naf_sequential = _parse_naf_html = None  # type: ignore
    _harvest_cac = _fetch_cac_json = None  # type: ignore


def _ts() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def _line(char: str = "─", n: int = 74) -> str:
    return char * n


def _collect_signals(live: bool, *, days: int, max_cases: int,
                     providers: Optional[list[str]]) -> list[RawSignal]:
    """
    Live: call the real, robots-aware, rate-limited UDRP collector.
    Offline: reuse the collector's bundled fixtures via run.py's helper so the
    dry-run exercises the same resolve→enqueue path with zero network.
    """
    if udrp is None:
        print("  (collectors.udrp unavailable — no signals)")
        return []

    if live:
        print(f"  live collect: udrp.collect(lookback_days={days}, max_cases={max_cases})")
        signals = udrp.collect(providers=providers, lookback_days=days, max_cases=max_cases)

        # NAF integration (live only)
        if _harvest_naf_sequential is not None:
            print("  live collect: naf (start=2215000)")
            naf_cases = _harvest_naf_sequential(start=2215000, max_cases=max_cases)
            for case in naf_cases:
                # Convert NAF case to RawSignal (minimal fields for now)
                signals.append(RawSignal(
                    source="naf",
                    tier=None,
                    signal_type="udrp_filing",
                    impersonation_type=None,
                    impersonated_brand=case.get("complainant"),
                    signal_url=case.get("decision_url"),
                    snippet=f"NAF case {case.get('case_no')} - {case.get('domain')}",
                ))

        # CAC integration (live only — JSON API, no HTML parsing)
        if _harvest_cac is not None and (providers is None or "cac" in (providers or [])):
            print(f"  live collect: cac (udrp.adr.eu, max_cases={max_cases})")
            pages = max(1, (max_cases + 9) // 10)
            hex_ids = _harvest_cac(pages=pages)
            for hex_id in hex_ids[:max_cases]:
                data = _fetch_cac_json(hex_id)
                if not data:
                    continue
                signals.append(RawSignal(
                    source="cac",
                    tier=SignalTier.PUBLIC_VICTIM if RawSignal else None,
                    signal_type="udrp_filing",
                    impersonation_type=ImpersonationType.DOMAIN if ImpersonationType else None,
                    impersonated_brand=data.get("complainant"),
                    signal_url=data.get("source_url"),
                    snippet=f"CAC case {data.get('case_id')} - {data.get('domain')} ({data.get('outcome')})",
                    incident_date=_parse_date_safe(data.get("decided_at")),
                    extra={"provider": "cac", "outcome": data.get("outcome"),
                           "case_id": data.get("case_id"), "domain": data.get("domain")},
                ))
        return signals

    # Offline: derive RawSignals from run.py's offline-fixture prospects.
    print("  offline: deriving signals from bundled UDRP fixtures (no network)")
    try:
        from run import prospects_from_udrp           # noqa: E402
    except Exception as e:                            # noqa: BLE001
        print(f"  (could not import offline fixtures from run.py: {e})")
        return []
    signals: list[RawSignal] = []
    for p in prospects_from_udrp(max_cases=max_cases):
        signals.extend(p.signals or [])
    return signals


def main(argv: Optional[list[str]] = None) -> int:
    ap = argparse.ArgumentParser(
        description="Daily discovery → review-queue populator (no send, human-gated).")
    ap.add_argument("--live", action="store_true",
                    help="REAL run: network collect + write unreviewed drafts to Supabase. "
                         "Without this flag everything is offline + in-memory.")
    ap.add_argument("--days", type=int, default=30,
                    help="UDRP lookback window in days (live collect only; default 30)")
    ap.add_argument("--max-cases", type=int, default=25,
                    help="cap collected cases (default 25)")
    ap.add_argument("--providers", default=None,
                    help="comma-separated UDRP providers (e.g. 'wipo,adrforum'); default all")
    ap.add_argument("--use-llm", action="store_true",
                    help="let the drafter use the local LLM for the narrow draft step "
                         "(default off → deterministic template drafts)")
    ap.add_argument("--allow-unverified", action="store_true",
                    help="allow prospects without a verified contact through resolve "
                         "(default off)")
    ap.add_argument("--enrich-live", dest="enrich_live", action="store_true",
                    help="passive public enrichment (DMARC + intake contact) before routing; "
                         "implied by --live, ignored offline")
    args = ap.parse_args(argv)

    providers = [s.strip() for s in args.providers.split(",")] if args.providers else None
    live = args.live
    enrich_live = bool(args.enrich_live or live)

    print(_line("═"))
    print("BRAND GUARD — daily review-queue populator   collect → resolve → score → route → draft → QUEUE")
    print(f"mode: {'LIVE (network + Supabase write)' if live else 'OFFLINE (fixtures + in-memory)'}   started_at={_ts()}")
    print("This NEVER sends mail. It only queues UNREVIEWED drafts for human approval.")
    print(_line("═"))

    # --- store ----------------------------------------------------------------
    if live:
        print("⚠  --live: connecting to the real Supabase store (service key from ~/agenticbro/.env.local).")
        print("   Drafts will be written as approval='unreviewed'. Nothing is approved or sent.")
        store = connect()
    else:
        store = InMemoryStore()

    # --- collect --------------------------------------------------------------
    failed = False
    try:
        signals = _collect_signals(live, days=args.days, max_cases=args.max_cases,
                                   providers=providers)
        print(f"  collected: {len(signals)} signal(s)")
    except Exception as e:                            # noqa: BLE001
        print(f"  !! collect error: {type(e).__name__}: {e}")
        return 1

    if not signals:
        print(_line("═"))
        print("No signals collected — nothing to queue. Done.")
        return 0

    # --- enqueue (resolve → score → route → draft → persist as UNREVIEWED) ----
    try:
        summary = enqueue(
            signals, store,
            use_llm=args.use_llm,
            enrich_live=enrich_live,
            allow_unverified=args.allow_unverified,
        )
    except Exception as e:                            # noqa: BLE001
        failed = True
        print(f"  !! enqueue error: {type(e).__name__}: {e}")
        summary = {}

    # --- summary --------------------------------------------------------------
    print(_line("═"))
    print("SUMMARY")
    for row in (summary.get("rows") or []):
        print(f"  {str(row.get('company'))[:30]:<30}  score={row.get('victim_score')}  "
              f"channel={row.get('channel') or '∅'}")
    print(f"  resolved={summary.get('resolved', 0)}  "
          f"queued(unreviewed)={summary.get('queued', 0)}  "
          f"below_threshold={summary.get('below_threshold', 0)}  "
          f"stopped={summary.get('stopped', 0)}  "
          f"no_draft={summary.get('no_draft', 0)}")
    if isinstance(store, InMemoryStore):
        try:
            print(f"  (in-memory) review queue now holds {len(store.load_review_queue())} draft(s)")
        except Exception:                             # noqa: BLE001
            pass
    print(_line("═"))
    print("Next: open agenticbro.app/brand-guard/admin → Outreach tab to review & approve.")
    print("Nothing was sent. Approval happens only in that console.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
