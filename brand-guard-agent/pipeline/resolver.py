"""
Resolver — turn a flat list of collector RawSignals into deduped, enriched Prospects,
then (optionally) run them through score → route → draft and persist the unreviewed
drafts into the approval queue.

This is the missing seam between *collection* (collectors/*.py emit RawSignals) and
*review* (the Drafts approval tab reads queued, unreviewed drafts). It is deterministic
and offline: same signals in → same prospects out, no network, no LLM. The only
side-effects happen in `enqueue()`, and only through the injected `store`.

Two entry points:
  * resolve_signals(signals)            → list[Prospect]   (pure; group + attach + enrich-stub)
  * enqueue(signals, store, sender=...) → summary dict     (resolve → score → route → draft → persist)

Design rules kept consistent with the rest of the pipeline:
  * Deterministic code owns grouping/dedupe/enrichment. The LLM does none of this.
  * We never fabricate evidence. Enrichment that we can't derive offline is left
    None and clearly marked as a stub (see `_enrich`), so the Drafts tab shows the
    truth (e.g. "no contact email") rather than an invented value.
  * Nothing is sent here. enqueue() persists drafts as approval='unreviewed' only —
    the human Drafts gate + the send worker remain the only path to an actual send.
"""
from __future__ import annotations

import re
from typing import Any, Optional
from urllib.parse import urlparse

from common.models import (
    Prospect,
    RawSignal,
    ImpersonationType,
    ROUTE_THRESHOLD,
)

# Pipeline stages (pure decision functions — they mutate the prospect they're given).
from pipeline.scorer import score_prospect
from pipeline.router import route
from pipeline.drafter import draft_for_prospect


# ---------------------------------------------------------------------------
# grouping keys
# ---------------------------------------------------------------------------
_NON_DOMAIN = re.compile(r"[^a-z0-9.-]")


def _host_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        host = urlparse(url if "://" in url else f"http://{url}").netloc.lower()
    except Exception:
        return None
    return host or None


def _normalize_brand(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    return re.sub(r"\s+", " ", name).strip().lower() or None


def _domain_from_extra(sig: RawSignal) -> Optional[str]:
    """A collector may already know the victim's real domain — prefer that."""
    extra = sig.extra or {}
    for key in ("brand_domain", "primary_domain", "victim_domain", "company_domain"):
        val = extra.get(key)
        if val:
            return str(val).lower()
    return None


def _infer_domain(brand: Optional[str], sig: RawSignal) -> tuple[Optional[str], bool]:
    """
    Best-effort primary domain for grouping/dedupe.

    Returns (domain, inferred). `inferred=True` means we slugged it from the brand
    name and it should NOT be trusted as a real, mailable domain — it exists only so
    distinct prospects don't collide on an empty key. The Drafts tab surfaces this.
    """
    explicit = _domain_from_extra(sig)
    if explicit:
        return explicit, False
    if brand:
        slug = _NON_DOMAIN.sub("", brand.replace(" ", ""))
        if slug:
            return f"{slug}.example", True   # .example is reserved → never a real send target
    host = _host_from_url(sig.signal_url)
    if host:
        return host, True
    return None, False


def _group_key(sig: RawSignal) -> str:
    """Stable key to collapse many signals about the same victim into one prospect."""
    brand = _normalize_brand(sig.impersonated_brand)
    if brand:
        return f"brand:{brand}"
    dom = _domain_from_extra(sig) or _host_from_url(sig.signal_url)
    if dom:
        return f"dom:{dom}"
    # Last resort: keep it separate rather than merging unrelated evidence.
    return f"sig:{sig.source}:{sig.signal_url or sig.snippet or id(sig)}"


# ---------------------------------------------------------------------------
# enrichment
# ---------------------------------------------------------------------------
def _enrich(prospect: Prospect, *,
            enrich_live: bool = False,
            allow_unverified: bool = False) -> None:
    """
    Fill in what we can derive about the victim.

    Two layers:
      1. ALWAYS (deterministic, offline, from in-hand evidence):
           * crt_lookalikes ← domains from lookalike_domain signals' extra["domain"]
      2. OPTIONAL (collectors.enrich, gated behind enrich_live):
           * dmarc_policy + a reachable intake contact, via passive public OSINT
             (DNS DMARC/SPF/MX, RDAP abuse, security.txt). Offline by default —
             when enrich_live=False this performs NO network I/O.

    We never invent a named person or a title; decision-maker discovery stays the
    job of a dedicated contact collector, so the scorer's "decision_maker_found"
    only fires on evidence we actually have. Synthetic ".example" domains (brand-
    inferred placeholders) are never resolved — the enricher's own reserved-domain
    guard short-circuits them.
    """
    lookalikes: list[str] = []
    for sig in prospect.signals:
        if sig.signal_type == "lookalike_domain":
            dom = (sig.extra or {}).get("domain")
            if dom and dom not in lookalikes:
                lookalikes.append(str(dom))
    if lookalikes:
        prospect.crt_lookalikes = lookalikes

    # Layer 2: DMARC + contact enrichment. Lazy-imported so resolve_signals stays
    # usable with no network and no extra coupling when enrichment is off.
    if not prospect.primary_domain:
        return
    try:
        from collectors.enrich import enrich_domain, apply_enrichment, is_reserved
    except ImportError:
        return
    if is_reserved(prospect.primary_domain):
        return  # never resolve synthetic/brand-inferred ".example" placeholders
    enr = enrich_domain(prospect.primary_domain,
                        live=enrich_live, allow_unverified=allow_unverified)
    apply_enrichment(prospect, enr, allow_unverified=allow_unverified)


# ---------------------------------------------------------------------------
# resolve: signals -> prospects  (pure)
# ---------------------------------------------------------------------------
def resolve_signals(signals: list[RawSignal], *,
                    enrich_live: bool = False,
                    allow_unverified: bool = False) -> list[Prospect]:
    """
    Collapse RawSignals into one Prospect per victim brand/domain, attach every
    signal as evidence, and run enrichment. Deterministic and ordered by first-seen
    so output is stable across runs.

    enrich_live=False (default) keeps this fully offline (no DNS/HTTP). Pass
    enrich_live=True to let collectors.enrich do passive public lookups (DMARC +
    intake contact). allow_unverified additionally permits RFC-2142 role-address
    guesses when nothing verified is found.
    """
    groups: dict[str, Prospect] = {}
    order: list[str] = []

    for sig in signals:
        key = _group_key(sig)
        prospect = groups.get(key)
        if prospect is None:
            brand = sig.impersonated_brand
            domain, inferred = _infer_domain(_normalize_brand(brand), sig)
            prospect = Prospect(
                company_name=brand,
                primary_domain=domain,
            )
            if inferred:
                # mark the guess so the review UI can flag "domain inferred"
                prospect.draft_status = None  # (left for clarity; flag lives on signals/extra)
            groups[key] = prospect
            order.append(key)

        prospect.signals.append(sig)

        # carry an impersonation hint up to the prospect if it's still unknown
        if (sig.impersonation_type
                and sig.impersonation_type != ImpersonationType.UNKNOWN
                and not getattr(prospect, "_impersonation_hint", None)):
            setattr(prospect, "_impersonation_hint", sig.impersonation_type.value)

    resolved = [groups[k] for k in order]
    for p in resolved:
        _enrich(p, enrich_live=enrich_live, allow_unverified=allow_unverified)
    return resolved


# ---------------------------------------------------------------------------
# enqueue: resolve -> score -> route -> draft -> persist (unreviewed)
# ---------------------------------------------------------------------------
def enqueue(signals: list[RawSignal], store: Any, *,
            sender: Optional[dict[str, Any]] = None,
            use_llm: bool = False,
            enrich_live: bool = False,
            allow_unverified: bool = False) -> dict[str, Any]:
    """
    Full discovery→queue pass for a batch of signals.

    For each resolved prospect:
      1. score_prospect  → victim_score + breakdown (+ BANT)
      2. route           → channel / compliance_ok / reason / stop
      3. draft_for_prospect → a channel-correct draft (or None)
      4. persist via the store: save_prospect(...) then queue_draft(...) as UNREVIEWED

    Nothing is approved or sent. Returns a summary the caller (run.py / a cron worker)
    can print. The store does all the writing, so this works against InMemoryStore
    (offline tests) or SupabaseStore (server-side) without change.

    enrich_live / allow_unverified are passed straight to resolve_signals (default
    off → fully offline). Set enrich_live=True in the real cron worker to populate
    dmarc_policy + an intake contact via passive public lookups before routing.
    """
    return enqueue_prospects(
        resolve_signals(signals, enrich_live=enrich_live,
                        allow_unverified=allow_unverified),
        store, sender=sender, use_llm=use_llm)


def enqueue_prospects(prospects: list[Prospect], store: Any, *,
                      sender: Optional[dict[str, Any]] = None,
                      use_llm: bool = False) -> dict[str, Any]:
    """
    The score→route→draft→persist loop, split out so callers that enrich prospects
    between resolve and persist (e.g. after a DMARC / contact-discovery collector)
    can reuse exactly the same path. `enqueue()` is just `resolve_signals` + this.
    """
    summary: dict[str, Any] = {
        "resolved": len(prospects),
        "queued": 0,
        "below_threshold": 0,
        "stopped": 0,
        "no_draft": 0,
        "draft_ids": [],
        "rows": [],
    }

    for p in prospects:
        score = score_prospect(p)
        breakdown = score.get("breakdown", {})

        decision = route(p)
        row = {
            "company": p.company_name,
            "domain": p.primary_domain,
            "victim_score": p.victim_score,
            "channel": p.routed_channel,
            "reason": decision.get("reason"),
        }

        if p.victim_score < ROUTE_THRESHOLD:
            summary["below_threshold"] += 1
        if decision.get("stop"):
            summary["stopped"] += 1
            row["queued"] = False
            summary["rows"].append(row)
            continue

        draft = draft_for_prospect(p, sender=sender, use_llm=use_llm)
        if not draft:
            summary["no_draft"] += 1
            row["queued"] = False
            summary["rows"].append(row)
            continue

        # carry the router's one-line reason onto the draft for the Drafts tab
        draft["routing_reason"] = decision.get("reason")

        # persist: prospect first (so the draft can FK to it), then the unreviewed draft
        store.save_prospect(p, score_breakdown=breakdown)
        draft_id = store.queue_draft(p, draft)

        summary["queued"] += 1
        summary["draft_ids"].append(draft_id)
        row["queued"] = True
        row["draft_id"] = draft_id
        summary["rows"].append(row)

    return summary


# ---------------------------------------------------------------------------
# self-test (offline, InMemoryStore) — `python -m pipeline.resolver`
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    from datetime import date
    from common.models import SignalTier
    from db.store import InMemoryStore

    # Three signals about two victims (two are the same brand → must merge to one).
    sigs = [
        RawSignal(
            source="udrp_wipo", tier=SignalTier.PUBLIC_VICTIM,
            signal_type="udrp_filing", impersonation_type=ImpersonationType.DOMAIN,
            impersonated_brand="Northwind Coffee", incident_date=date(2026, 5, 1),
            signal_url="https://www.wipo.int/decisions/D2026-0001",
            snippet="Complainant Northwind Coffee Roasters; respondent registered northwind-coffee.shop",
            extra={"brand_domain": "northwindcoffee.com", "company_name": "Northwind Coffee"},
        ),
        RawSignal(
            source="crt.sh", tier=SignalTier.EXPOSURE,
            signal_type="lookalike_domain", impersonation_type=ImpersonationType.DOMAIN,
            impersonated_brand="Northwind Coffee",
            signal_url="https://crt.sh/?q=northwind-coffee.shop",
            snippet="northwind-coffee.shop issued a cert",
            extra={"domain": "northwind-coffee.shop", "recent": True, "issuer": "R3"},
        ),
        RawSignal(
            source="x_profile", tier=SignalTier.PUBLIC_VICTIM,
            signal_type="public_scam_warning", impersonation_type=ImpersonationType.SOCIAL,
            impersonated_brand="Lakeside Studio",
            signal_url="https://x.com/lakeside/status/123",
            snippet="PSA: a fake @lakeside_support account is DMing our customers. We will never DM you.",
            extra={},
        ),
    ]

    store = InMemoryStore()
    print("=" * 72)
    print("RESOLVE — collapse 3 signals → prospects")
    prospects = resolve_signals(sigs)
    for p in prospects:
        print(f"  {p.company_name:18} domain={p.primary_domain:24} "
              f"signals={len(p.signals)} lookalikes={p.crt_lookalikes}")
    assert len(prospects) == 2, "two Northwind signals should merge into one prospect"

    print("\n" + "=" * 72)
    print("ENQUEUE (signals only) — safe default: thin evidence + no contact → no queue")
    dry = enqueue(sigs, InMemoryStore())
    for r in dry["rows"]:
        print(f"  {r['company']:18} score={r['victim_score']:3}  "
              f"channel={str(r['channel']):4}  ({r['reason']})")
    print(f"  → queued={dry['queued']} below_threshold={dry['below_threshold']} "
          f"stopped={dry['stopped']}  (correct: nothing routable yet)")

    print("\n" + "=" * 72)
    print("ENRICH (simulated downstream collectors) → enqueue → queue a real draft")
    northwind = next(p for p in prospects if p.company_name == "Northwind Coffee")
    # what a DMARC + contact-discovery collector would add (NOT invented by the resolver):
    northwind.company_size_band = "smb"
    northwind.dmarc_policy = "none"
    northwind.contact_name = "Dana Reyes"
    northwind.contact_title = "Founder"
    northwind.contact_channel = "email"
    northwind.contact_email = "dana@northwindcoffee.com"
    summary = enqueue_prospects(prospects, store)
    for r in summary["rows"]:
        flag = "queued" if r.get("queued") else "—"
        print(f"  {r['company']:18} score={r['victim_score']:3}  "
              f"channel={str(r['channel']):4}  {flag:6}  ({r['reason']})")
    print(f"\n  resolved={summary['resolved']} queued={summary['queued']} "
          f"below_threshold={summary['below_threshold']} stopped={summary['stopped']}")
    assert summary["queued"] == 1, "Northwind should now route + queue exactly one draft"

    print("\n" + "=" * 72)
    print("REVIEW QUEUE — what the Drafts tab reads (unreviewed only)")
    queue = store.load_review_queue()
    for item in queue:
        chips = ", ".join(f"{k} +{v}" for k, v in item["score_breakdown"].items())
        print(f"  • {item['company_name']} [{item['channel']}] score={item['victim_score']} "
              f"approval={item['approval']} suppressed={item['suppressed']}")
        print(f"      why: {chips}")
        print(f"      evidence: {len(item['signals'])} signal(s); subject={item['subject']!r}")
    assert all(d['approval'] == 'unreviewed' for d in store.drafts), "queue starts unreviewed"

    print("\n" + "=" * 72)
    print("APPLY APPROVALS — the server-side applier (what approvals.json triggers)")
    target = queue[0]["draft_id"]
    log = store.apply_approvals([
        {"draft_id": target, "decision": "approve",
         "edited_body": "Hi Dana — quick note about northwind-coffee.shop. (human-edited)",
         "approved_by": "admin-uuid"},
    ], approved_by="admin-uuid")
    for line in log:
        print(f"  • {line}")
    after = next(d for d in store.drafts if d["draft_id"] == target)
    print(f"\n  draft approval   : {after['approval']}  (edited_body set: {bool(after['edited_body'])})")
    print(f"  prospect approval: {store.prospects[after['prospect_domain']].approval_status}")
    print(f"  review queue now : {len(store.load_review_queue())} unreviewed left")
    assert after["approval"] == "approved"
    assert store.load_review_queue() == [], "approved draft leaves the unreviewed queue"
    print("=" * 72)
    print("InMemoryStore only — no network, no Supabase, nothing sent.")
