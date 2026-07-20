#!/usr/bin/env python3
"""
run.py — thin end-to-end runner for the Brand Guard discovery → outreach pipeline.

Chains the existing stages, in order, on a small set of prospects:

    collectors → scorer → router → drafter → send_worker

and prints a per-stage trace so you can watch the hand-offs line up before
anything is ever armed. This is GLUE ONLY: it adds no scoring, routing, or
drafting logic of its own — it just calls the modules you already have.

Safety posture (all on by default):
  * The send stage uses ConsoleTransport — it prints the message and returns a
    dry-run result. It never opens a socket. SmtpTransport is never imported
    or constructed in this file, so this script physically cannot transmit mail.
  * Persistence goes to an in-memory store by default (no Supabase, no network).
  * "Approval" is simulated and clearly labelled; real sends still require a
    human to approve a draft in the CRM.

Usage:
    python3 run.py                 # demo prospects, dry-run, in-memory store
    python3 run.py --from-udrp     # also seed prospects from the offline UDRP fixtures
    python3 run.py --no-approve    # skip the simulated approval → see the human-gate skip
    python3 run.py --live-store    # read suppression from / persist touches to real Supabase
                                   #   (send is STILL dry-run; requires creds via db.store.connect)
    python3 run.py --limit 3       # cap how many prospects to walk

Exit code is 0 on a clean walk, 1 if any stage raised.
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import date, timedelta
from typing import Any, Optional

# Make `python3 run.py` work from anywhere by putting the project root on the path.
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from common.models import (                       # noqa: E402
    Prospect, RawSignal, SignalTier, ImpersonationType,
)
from pipeline.scorer import score_prospect        # noqa: E402
from pipeline.router import route                 # noqa: E402
from pipeline.drafter import draft_for_prospect   # noqa: E402
from pipeline.send_worker import (                # noqa: E402
    send_touch, ConsoleTransport,
)
from db.store import InMemoryStore, connect       # noqa: E402

# Optional: seed extra prospects from the UDRP collector's offline fixtures.
try:
    from collectors import udrp                   # noqa: E402
except Exception:                                 # noqa: BLE001
    udrp = None  # type: ignore


# ---------------------------------------------------------------------------
# Demo prospects — synthetic, but shaped exactly like resolved/enriched rows.
# Each one is built to exercise a different branch of the router so the trace
# shows the variety (cold email, send-by-hand, hard stop, suppression).
# ---------------------------------------------------------------------------
def _recent(days: int) -> date:
    return date.today() - timedelta(days=days)


def demo_prospects() -> list[Prospect]:
    return [
        # 1) Clean Channel-D cold-email path → should end in a dry-run SEND.
        Prospect(
            company_name="Northwind Coffee Roasters",
            primary_domain="northwindcoffee.com",
            vertical="ecommerce", company_size_band="smb",
            contact_name="Dana Lee", contact_title="Founder",
            contact_channel="email", contact_email="dana@northwindcoffee.com",
            dmarc_policy="none",
            signals=[
                RawSignal(source="udrp_wipo", tier=SignalTier.PUBLIC_VICTIM,
                          signal_type="udrp_filing",
                          impersonation_type=ImpersonationType.DOMAIN,
                          impersonated_brand="Northwind Coffee Roasters",
                          signal_url="https://www.wipo.int/amc/en/domains/decisions/d2026-0481.html",
                          incident_date=_recent(20)),
                RawSignal(source="crt.sh", tier=SignalTier.EXPOSURE,
                          signal_type="lookalike_domain",
                          impersonation_type=ImpersonationType.DOMAIN,
                          extra={"domain": "northwind-coffee.shop"},
                          incident_date=_recent(5)),
            ],
        ),
        # 2) Security-sensitive vertical → Channel C (LinkedIn, send-by-hand) → SKIP.
        Prospect(
            company_name="Lakeside Payments",
            primary_domain="lakesidepay.com",
            vertical="fintech", company_size_band="smb",
            contact_name="Sam Ortiz", contact_title="CEO",
            contact_channel="email", contact_email="sam@lakesidepay.com",
            linkedin_url="https://www.linkedin.com/in/sam-ortiz",
            dmarc_policy="none",
            signals=[
                RawSignal(source="phish_feed", tier=SignalTier.DOCUMENTED_HARM,
                          signal_type="live_phishing",
                          impersonation_type=ImpersonationType.DOMAIN,
                          impersonated_brand="Lakeside Payments",
                          signal_url="https://example-feed/abc",
                          incident_date=_recent(10)),
            ],
        ),
        # 3) Below threshold → hard STOP at the router; drafter returns nothing.
        Prospect(
            company_name="Quiet Studio LLC",
            primary_domain="quietstudio.example",
            vertical="other", company_size_band="enterprise",
            dmarc_policy="reject",
            signals=[
                RawSignal(source="crt.sh", tier=SignalTier.EXPOSURE,
                          signal_type="lookalike_domain",
                          extra={"domain": "quiet-studio.net"},
                          incident_date=_recent(40)),
            ],
        ),
        # 4) Channel-D path but recipient is on the suppression list → SKIP.
        Prospect(
            company_name="Maple Goods Co",
            primary_domain="maplegoods.com",
            vertical="retail", company_size_band="smb",
            contact_name="Robin Vale", contact_title="Owner",
            contact_channel="email", contact_email="optout@maplegoods.com",
            dmarc_policy="missing",
            signals=[
                RawSignal(source="udrp_adrforum", tier=SignalTier.PUBLIC_VICTIM,
                          signal_type="udrp_filing",
                          impersonation_type=ImpersonationType.DOMAIN,
                          impersonated_brand="Maple Goods Co",
                          signal_url="https://www.adrforum.com/domain-dispute/decisions/fa2605001234",
                          incident_date=_recent(15)),
            ],
        ),
    ]


def prospects_from_udrp(max_cases: int = 5) -> list[Prospect]:
    """
    Build prospects from the UDRP collector's OFFLINE fixtures (no network).
    Each returned RawSignal becomes a one-signal prospect keyed on the
    impersonated brand. Demonstrates the collector → scorer hand-off on real
    collector output rather than hand-written signals.
    """
    if udrp is None:
        return []
    # The collector self-test path uses fixtures; calling collect() here would try
    # the network. Instead, reuse its public fixtures through the documented
    # offline entrypoint if present; otherwise skip gracefully.
    signals = []
    fixture_fn = getattr(udrp, "_offline_signals", None)
    if callable(fixture_fn):
        signals = fixture_fn()
    else:
        # Fall back to parsing the bundled fixtures deterministically.
        parse = getattr(udrp, "_parse_case_page", None)
        if callable(parse):
            import re as _re
            specs = [
                (getattr(udrp, "_WIPO_FIXTURE", ""), "wipo", getattr(udrp, "WIPO_CASE_RE", None),
                 "https://www.wipo.int/amc/en/domains/decisions/demo.html"),
                (getattr(udrp, "_ADRFORUM_FIXTURE", ""), "adrforum", getattr(udrp, "ADRFORUM_CASE_RE", None),
                 "https://www.adrforum.com/domain-dispute/decisions/demo"),
            ]
            for html, provider, case_re, url in specs:
                if not html or case_re is None:
                    continue
                rec = parse(html, url, provider, case_re)
                facts = udrp._extract_case_facts(rec.get("raw_text", "")) if hasattr(udrp, "_extract_case_facts") else {}
                brand = facts.get("company_name") or rec.get("case_no") or provider
                signals.append(RawSignal(
                    source=f"udrp_{provider}",
                    tier=SignalTier.PUBLIC_VICTIM,
                    signal_type="udrp_filing",
                    impersonation_type=ImpersonationType.DOMAIN,
                    impersonated_brand=brand,
                    signal_url=rec.get("decision_url") or url,
                    incident_date=date.today() - timedelta(days=10),
                    extra=rec,
                ))

    out: list[Prospect] = []
    for i, sig in enumerate(signals[:max_cases]):
        brand = getattr(sig, "impersonated_brand", None) or f"UDRP Case {i+1}"
        domain = (brand.lower().replace(" ", "").replace(",", "").replace(".", "") or f"case{i+1}") + ".example"
        out.append(Prospect(
            company_name=brand, primary_domain=domain,
            vertical="retail", company_size_band="smb",
            contact_name="Pat Doe", contact_title="Owner",
            contact_channel="email", contact_email=f"owner@{domain}",
            dmarc_policy="none", signals=[sig],
        ))
    return out


# ---------------------------------------------------------------------------
# The walk
# ---------------------------------------------------------------------------
def _line(char: str = "─", n: int = 74) -> str:
    return char * n


def walk_prospect(prospect: Prospect, *, store, suppression, transport,
                  approve: bool) -> dict[str, Any]:
    """Run one prospect through every stage and print a compact trace."""
    name = prospect.company_name or prospect.primary_domain or "?"
    print(_line())
    print(f"▶ {name}  <{prospect.primary_domain}>  [{prospect.vertical}/{prospect.company_size_band}]")

    # 1) SCORER ------------------------------------------------------------
    score = score_prospect(prospect)
    bd = ", ".join(f"{k}+{v}" for k, v in (score.get("breakdown") or {}).items()) or "—"
    print(f"  scorer  : victim_score={prospect.victim_score}  bant={prospect.bant_status}  "
          f"meets_threshold={score.get('meets_threshold')}")
    print(f"            breakdown: {bd}")

    # 2) ROUTER ------------------------------------------------------------
    routing = route(prospect)
    print(f"  router  : channel={routing.get('channel') or '∅'}  stop={routing.get('stop')}")
    print(f"            reason: {routing.get('reason')}")
    if routing.get("stop") or not routing.get("channel"):
        print("  drafter : (skipped — no outbound channel)")
        print("  send    : (skipped — nothing routed)")
        return {"company": name, "channel": None, "outcome": "no_route"}

    # 3) DRAFTER -----------------------------------------------------------
    draft = draft_for_prospect(prospect)
    if draft is None:
        print("  drafter : (no draft — channel is inbound-only or stopped)")
        print("  send    : (skipped)")
        return {"company": name, "channel": routing.get("channel"), "outcome": "no_draft"}

    subj = draft.get("subject") or "(no subject — body-only channel)"
    print(f"  drafter : channel={draft['channel']}  sendable={draft['sendable']}  "
          f"send_by_hand={draft.get('send_by_hand')}")
    print(f"            subject: {subj}")
    if draft.get("blockers"):
        print(f"            blockers: {draft['blockers']}")

    # Simulated human approval (clearly labelled). Real sends require a person
    # to approve the draft in the CRM; here we flip the flag so the dry-run can
    # demonstrate the send path end to end.
    if approve and draft.get("sendable") and not draft.get("send_by_hand"):
        draft["approval"] = "approved"
        draft["to"] = prospect.contact_email
        print("            [SIMULATED APPROVAL] draft marked approved for dry-run")

    # 4) SEND WORKER (dry-run via ConsoleTransport) ------------------------
    result = send_touch(prospect, draft, transport=transport, suppression=suppression)
    outcome = result.get("outcome")
    print(f"  send    : outcome={outcome}  to={result.get('to') or '—'}  "
          f"reason={result.get('reason') or '—'}")

    # 5) PERSIST the touch to the store (in-memory by default).
    try:
        store.record_send(prospect, draft, result)
    except Exception as e:                         # noqa: BLE001
        print(f"            (store.record_send note: {e})")

    return {"company": name, "channel": draft["channel"], "outcome": outcome}


def main(argv: Optional[list[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Brand Guard end-to-end pipeline runner (dry-run).")
    ap.add_argument("--from-udrp", action="store_true",
                    help="also seed prospects from the offline UDRP fixtures")
    ap.add_argument("--no-approve", action="store_true",
                    help="skip the simulated approval (shows the human-gate skip)")
    ap.add_argument("--live-store", action="store_true",
                    help="use the real Supabase store for suppression + touch persistence "
                         "(send is still dry-run)")
    ap.add_argument("--limit", type=int, default=0,
                    help="cap the number of prospects walked (0 = all)")
    args = ap.parse_args(argv)

    print(_line("═"))
    print("BRAND GUARD — end-to-end runner   collectors → scorer → router → drafter → send_worker")
    print("DRY-RUN: ConsoleTransport only (no mail is transmitted).")
    print(_line("═"))

    # --- store -----------------------------------------------------------
    if args.live_store:
        print("⚠  --live-store: connecting to the real Supabase store. Send is still a")
        print("   dry-run (ConsoleTransport), but successful touches WILL be written to")
        print("   your prospect/touch tables. Suppression is read from the live list.")
        store = connect()                          # auto-loads ~/agenticbro/.env.local
    else:
        store = InMemoryStore()

    suppression = store.load_suppression()
    # Seed an offline suppression entry so the runner can demonstrate the skip
    # path even with the in-memory store (no effect if already suppressed live).
    if isinstance(store, InMemoryStore):
        store.seed_suppression(emails={"optout@maplegoods.com"})
        suppression = store.load_suppression()

    transport = ConsoleTransport(verbose=True)     # prints; never opens a socket

    # --- prospects -------------------------------------------------------
    prospects = demo_prospects()
    if args.from_udrp:
        extra = prospects_from_udrp()
        print(f"(+{len(extra)} prospect(s) seeded from offline UDRP fixtures)")
        prospects += extra
    if args.limit and args.limit > 0:
        prospects = prospects[: args.limit]

    # --- walk ------------------------------------------------------------
    results: list[dict[str, Any]] = []
    failed = False
    for p in prospects:
        try:
            results.append(walk_prospect(
                p, store=store, suppression=suppression, transport=transport,
                approve=not args.no_approve,
            ))
        except Exception as e:                     # noqa: BLE001
            failed = True
            print(f"  !! stage error on {p.company_name}: {type(e).__name__}: {e}")

    # --- summary ---------------------------------------------------------
    print(_line("═"))
    print("SUMMARY")
    by_outcome: dict[str, int] = {}
    for r in results:
        by_outcome[r["outcome"]] = by_outcome.get(r["outcome"], 0) + 1
        print(f"  {r['company']:<28}  channel={r['channel'] or '∅':<3}  → {r['outcome']}")
    print(f"  totals: " + ", ".join(f"{k}={v}" for k, v in sorted(by_outcome.items())))
    if isinstance(store, InMemoryStore):
        print(f"  store : {len(store.touches)} touch row(s) persisted (in-memory), "
              f"{len(store.sup_emails)} suppressed email(s)")
    print(_line("═"))
    print("Nothing was transmitted. To send for real you would: (1) approve drafts in the")
    print("CRM, (2) construct an ARMED SmtpTransport, (3) pass it where ConsoleTransport is.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
