#!/usr/bin/env python3
"""
crm/queue_cli.py — the server-side bridge between the draft queue and the
browser approval console (crm/drafts.html).

It closes the loop WITHOUT ever handing DB credentials to the browser:

    [ store ] --export--> queue.json --(load in)--> crm/drafts.html
                                                         |
                                              you approve / reject / edit
                                                         |
    [ store ] <--apply-- approvals.json <--(download)----+

Three subcommands:

    export    Read the unreviewed-draft review queue from the store and write it
              to queue.json. That file is what you load into crm/drafts.html
              ("Load queue JSON…"). It is plain data — no keys, no PII beyond the
              prospect facts you already collected.

    apply     Read an approvals.json batch (downloaded from the console) and apply
              it server-side via store.apply_approvals(). This is the ONLY place
              approval state changes. Nothing here sends mail — approved drafts are
              just unlocked for the existing send_worker (which is still dry-run by
              default and honors the suppression list).

    selftest  Full offline round-trip in one process: seed a demo prospect, queue a
              draft, export the queue, simulate an approvals.json, apply it, and show
              the state flip. Proves the wiring with no network and no real data.

Store selection (export / apply):
    --demo    in-memory store (offline; ephemeral — only meaningful for `export`
              and `selftest`, since each process starts empty)
    --live    real Supabase store via db.store.connect() (service key from
              ~/agenticbro/.env.local). Use this for the real export/apply loop.

Run from the project root:

    python3 -m crm.queue_cli selftest
    python3 -m crm.queue_cli export --live -o queue.json
    python3 -m crm.queue_cli apply approvals.json --live

Nothing in this file is automatic. You run it, you read the log it prints, and a
human has already made every approve/reject call in the console before `apply`
ever sees it.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
from datetime import date
from typing import Any, Optional

# --- package imports (run as `python -m crm.queue_cli` from the project root) ---
from db.store import InMemoryStore, BaseStore
from common.models import RawSignal, SignalTier, ImpersonationType
from pipeline.resolver import resolve_signals, enqueue_prospects


# ---------------------------------------------------------------------------
# store selection
# ---------------------------------------------------------------------------
def _open_store(live: bool) -> BaseStore:
    """Return a live Supabase store or an offline in-memory one."""
    if live:
        # imported lazily so `--demo`/`selftest` never need supabase installed
        from db.store import connect
        print("⚠  --live: connecting to the real Supabase store (service key).")
        return connect()
    return InMemoryStore()


# ---------------------------------------------------------------------------
# demo seed — the same shape the real collectors emit, but obviously fake data
# ---------------------------------------------------------------------------
def _seed_demo(store: BaseStore) -> int:
    """
    Put one realistic, clearly-fake prospect into `store` as an UNREVIEWED draft so
    `export`/`selftest` have something to show. Mirrors resolver's own self-test:
    a recent UDRP filing + a live lookalike domain for a small coffee roaster, plus
    simulated downstream enrichment (size band + DMARC + a verified contact) so it
    actually clears the route threshold and produces a draft.
    """
    signals = [
        RawSignal(
            source="udrp_wipo",
            tier=SignalTier.PUBLIC_VICTIM,
            signal_type="udrp_filing",
            impersonation_type=ImpersonationType.DOMAIN,
            impersonated_brand="Northwind Coffee",
            signal_url="https://www.wipo.int/amc/en/domains/decisions/EXAMPLE-northwind",
            snippet="Complainant Northwind Coffee Roasters; respondent registered northwind-coffee.shop.",
            incident_date=date(2026, 6, 1),
            extra={"brand_domain": "northwindcoffee.com", "company_name": "Northwind Coffee"},
        ),
        RawSignal(
            source="crt.sh",
            tier=SignalTier.EXPOSURE,
            signal_type="lookalike_domain",
            impersonation_type=ImpersonationType.DOMAIN,
            impersonated_brand="Northwind Coffee",
            signal_url="https://crt.sh/?q=northwind-coffee.shop",
            snippet="northwind-coffee.shop issued a cert (lookalike).",
            incident_date=date(2026, 6, 8),
            extra={"domain": "northwind-coffee.shop", "recent": True, "issuer": "R3"},
        ),
    ]

    prospects = resolve_signals(signals)
    # simulated downstream enrichment (what a DMARC + contact-discovery collector
    # would add). We never invent this in the resolver itself.
    for p in prospects:
        p.company_size_band = "smb"
        p.dmarc_policy = "none"
        p.contact_name = "Dana Reyes"
        p.contact_title = "Founder"
        p.contact_channel = "email"
        p.contact_email = "dana@northwindcoffee.com"

    summary = enqueue_prospects(prospects, store)
    print(f"   seeded: resolved={summary['resolved']} queued={summary['queued']} "
          f"below_threshold={summary['below_threshold']} "
          f"stopped={summary['stopped']} no_draft={summary['no_draft']}")
    return summary["queued"]


# ---------------------------------------------------------------------------
# export: store review queue -> queue.json (for the browser console)
# ---------------------------------------------------------------------------
def cmd_export(args: argparse.Namespace) -> int:
    store = _open_store(args.live)
    if args.demo:
        print("Seeding demo data into the in-memory store…")
        _seed_demo(store)

    queue = store.load_review_queue(limit=args.limit)
    payload = {
        "generated_at": _utcnow_iso(),
        "source": "live" if args.live else "demo",
        "count": len(queue),
        "drafts": queue,
        # the console also accepts triage/replies arrays; empty here on purpose.
        "triage": [],
        "replies": [],
    }
    _write_json(args.out, payload)
    print(f"Wrote {len(queue)} draft(s) to {args.out}")
    print("Next: open crm/drafts.html → 'Load queue JSON…' → choose this file.")
    if not queue:
        print("  (queue is empty — nothing is waiting for review.)")
    return 0


# ---------------------------------------------------------------------------
# apply: approvals.json -> store.apply_approvals (server-side, the only writer)
# ---------------------------------------------------------------------------
def cmd_apply(args: argparse.Namespace) -> int:
    batch = _read_json(args.approvals)
    decisions = batch.get("decisions") if isinstance(batch, dict) else batch
    if not isinstance(decisions, list):
        print("ERROR: approvals file must be {\"decisions\": [...]} or a bare list.",
              file=sys.stderr)
        return 2

    if not decisions:
        print("No decisions in the file — nothing to apply.")
        return 0

    store = _open_store(args.live)
    print(f"Applying {len(decisions)} decision(s) "
          f"({'LIVE Supabase' if args.live else 'in-memory'})…")
    log = store.apply_approvals(decisions, approved_by=args.approved_by)
    for line in log:
        print("   " + line)

    skipped = [l for l in log if l.startswith(("SKIP", "UNKNOWN"))]
    print(f"Done. applied={len(log) - len(skipped)} skipped={len(skipped)}")
    if args.demo and not args.live:
        print("  NOTE: --demo uses a fresh in-memory store, so the draft ids from a "
              "separate `export --demo` won't exist here. Use `selftest` for an "
              "offline round-trip, or `--live` for the real loop.")
    return 1 if skipped else 0


# ---------------------------------------------------------------------------
# selftest: offline end-to-end round-trip in a single process
# ---------------------------------------------------------------------------
def cmd_selftest(args: argparse.Namespace) -> int:
    print("== queue_cli selftest (offline, in-memory) ==")
    store = InMemoryStore()

    print("1) seed demo prospect + queue an unreviewed draft")
    queued = _seed_demo(store)
    assert queued == 1, f"expected 1 queued draft, got {queued}"

    print("2) export the review queue")
    queue = store.load_review_queue()
    assert len(queue) == 1, f"expected 1 in review queue, got {len(queue)}"
    d0 = queue[0]
    print(f"   draft_id={d0['draft_id']} company={d0['company_name']!r} "
          f"channel={d0['channel']} score={d0['victim_score']} "
          f"approval={d0['approval']}")
    assert d0["approval"] == "unreviewed"

    print("3) simulate an approvals.json (approve with a small body edit)")
    approvals = {
        "generated_at": _utcnow_iso(),
        "source": "selftest",
        "decisions": [{
            "draft_id": d0["draft_id"],
            "decision": "approve",
            "edited_body": (d0.get("body") or "") + "\n\n— Dana, founder @ Northwind",
            "approved_by": "selftest@agenticbro.app",
        }],
    }

    print("4) apply server-side via store.apply_approvals()")
    log = store.apply_approvals(approvals["decisions"])
    for line in log:
        print("   " + line)
    assert any(l.startswith("approve:") for l in log), f"approve not applied: {log}"

    print("5) confirm the state flipped and it left the review queue")
    after = store.load_review_queue()
    assert len(after) == 0, f"approved draft should leave the unreviewed queue, got {len(after)}"
    print("   review queue now empty ✓")

    print("\nALL SELFTEST CHECKS PASSED ✓")
    return 0


# ---------------------------------------------------------------------------
# small io helpers
# ---------------------------------------------------------------------------
def _utcnow_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def _write_json(path: str, obj: Any) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False, default=str)


def _read_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


# ---------------------------------------------------------------------------
# argparse
# ---------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        prog="python3 -m crm.queue_cli",
        description="Bridge the draft approval queue and the browser review console.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    pe = sub.add_parser("export", help="store review queue -> queue.json")
    pe.add_argument("-o", "--out", default="queue.json", help="output file (default: queue.json)")
    pe.add_argument("--limit", type=int, default=50, help="max drafts to export")
    _store_flags(pe)
    pe.set_defaults(func=cmd_export)

    pa = sub.add_parser("apply", help="approvals.json -> store.apply_approvals()")
    pa.add_argument("approvals", help="path to the approvals.json downloaded from the console")
    pa.add_argument("--approved-by", default=None, help="fallback approver id for the batch")
    _store_flags(pa)
    pa.set_defaults(func=cmd_apply)

    ps = sub.add_parser("selftest", help="offline end-to-end round-trip")
    ps.set_defaults(func=cmd_selftest)

    return ap


def _store_flags(p: argparse.ArgumentParser) -> None:
    g = p.add_mutually_exclusive_group()
    g.add_argument("--live", action="store_true",
                   help="use the real Supabase store (service key from ~/agenticbro/.env.local)")
    g.add_argument("--demo", action="store_true",
                   help="use an in-memory store (offline; export seeds fake data)")


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
