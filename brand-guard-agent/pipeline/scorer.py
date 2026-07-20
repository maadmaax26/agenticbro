"""
Scorer  —  Victim Score (0-100) + BANT+ qualification  (deterministic, no LLM)

Turns the evidence collected by `collectors/*` into a single comparable number so
the Router can decide who is worth contacting. This is pure code on purpose: scoring
must be explainable and reproducible, and a 9B model should never be the thing that
decides who gets emailed.

Inputs:  a Prospect (with .signals already attached + dmarc/contact/size enriched)
Outputs: prospect.victim_score (int 0-100), prospect.bant_status ("pass"|"hold"),
         and a per-prospect score breakdown (returned, also stashed in .extra-style dict)

Weights live in common/models.py (VICTIM_SCORE_WEIGHTS) — the single source of truth.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

try:
    from common.models import (
        Prospect, RawSignal, VICTIM_SCORE_WEIGHTS, ROUTE_THRESHOLD,
    )
except ImportError:  # allow running the file directly
    Prospect = RawSignal = None  # type: ignore
    VICTIM_SCORE_WEIGHTS = {
        "public_scam_warning": 35, "udrp_recent": 35, "customer_complaint": 25,
        "live_phishing": 25, "news_incident": 20, "lookalike_live": 10,
        "dmarc_weak": 10, "decision_maker_found": 10, "smb_confirmed": 10,
    }
    ROUTE_THRESHOLD = 50

UDRP_HOT_DAYS = 180
LOOKALIKE_CAP = 20          # a pile of lookalike domains shouldn't dominate the score
SCORE_CAP = 100


# Collector signal_type  ->  weight key in VICTIM_SCORE_WEIGHTS.
# Collectors emit human-readable signal_types; this is the one place we translate
# them into scoring buckets, so adding a collector means adding one row here.
SIGNAL_TYPE_TO_WEIGHT = {
    "public_scam_warning": "public_scam_warning",   # x_profile
    "customer_complaint": "customer_complaint",      # (future) review/complaint collectors
    "live_phishing": "live_phishing",                # (future) phishing-feed collector
    "news_incident": "news_incident",                # (future) news collector
    "lookalike_domain": "lookalike_live",            # crt_sh
    # udrp_filing / udrp_filing_old are handled specially (recency-aware) below.
}


def _is_recent(d: date | None, days: int) -> bool:
    return bool(d and d >= date.today() - timedelta(days=days))


def compute_victim_score(prospect: "Prospect") -> dict[str, Any]:
    """
    Sum weighted evidence into a 0-100 Victim Score. Returns a breakdown dict and
    mutates prospect.victim_score. Deterministic: same input -> same output.
    """
    breakdown: dict[str, int] = {}
    lookalike_points = 0

    for sig in prospect.signals:
        stype = getattr(sig, "signal_type", None)
        if stype is None:
            continue

        # --- UDRP: recency decides whether it's the hot +35 or a faded credit ---
        if stype in ("udrp_filing", "udrp_filing_old"):
            recent = stype == "udrp_filing" or _is_recent(
                getattr(sig, "incident_date", None), UDRP_HOT_DAYS
            )
            if recent:
                breakdown["udrp_recent"] = VICTIM_SCORE_WEIGHTS["udrp_recent"]
            else:
                # old filing still proves intent, but at a discount (half, floored)
                breakdown["udrp_old"] = VICTIM_SCORE_WEIGHTS["udrp_recent"] // 2
            continue

        # --- lookalike domains: additive but capped so they can't run away ---
        if stype == "lookalike_domain":
            lookalike_points = min(
                lookalike_points + VICTIM_SCORE_WEIGHTS["lookalike_live"],
                LOOKALIKE_CAP,
            )
            continue

        # --- everything else: flat weight, counted once per distinct bucket ---
        wkey = SIGNAL_TYPE_TO_WEIGHT.get(stype)
        if wkey and wkey not in breakdown:
            breakdown[wkey] = VICTIM_SCORE_WEIGHTS[wkey]

    if lookalike_points:
        breakdown["lookalike_live"] = lookalike_points

    # --- enrichment-derived signals (not from collectors) ---
    if (prospect.dmarc_policy or "").lower() in ("none", "missing"):
        breakdown["dmarc_weak"] = VICTIM_SCORE_WEIGHTS["dmarc_weak"]

    if prospect.contact_name and prospect.contact_title:
        breakdown["decision_maker_found"] = VICTIM_SCORE_WEIGHTS["decision_maker_found"]

    if (prospect.company_size_band or "").lower() in ("solo", "smb"):
        breakdown["smb_confirmed"] = VICTIM_SCORE_WEIGHTS["smb_confirmed"]

    total = min(sum(breakdown.values()), SCORE_CAP)
    prospect.victim_score = total
    return {"victim_score": total, "breakdown": breakdown}


def qualify_bant(prospect: "Prospect") -> dict[str, Any]:
    """
    BANT+ lite for self-serve SaaS. We're not qualifying a big-ticket sale — we're
    deciding "is this a real, reachable SMB with a real problem worth a message?"

      Budget    : product is low-cost self-serve -> assume reachable unless enterprise
      Authority : a named contact with a title (owner/founder/marketing/security)
      Need      : at least one Tier-1/Tier-2 harm signal (not lookalike-only)
      Timing    : a recent harm signal (<180d) means the pain is current
      +Fit      : SMB-sized and in an ICP vertical

    Returns {"bant_status": "pass"|"hold", "reasons": {...}} and sets prospect.bant_status.
    """
    has_harm_signal = any(
        getattr(s, "signal_type", "") in (
            "public_scam_warning", "customer_complaint", "live_phishing",
            "news_incident", "udrp_filing", "udrp_filing_old",
        )
        for s in prospect.signals
    )
    timing_hot = any(
        _is_recent(getattr(s, "incident_date", None), UDRP_HOT_DAYS)
        for s in prospect.signals
    )

    reasons = {
        "budget_ok": (prospect.company_size_band or "").lower() != "enterprise",
        "authority": bool(prospect.contact_name),
        "need": has_harm_signal,
        "timing": timing_hot,
        "fit_smb": (prospect.company_size_band or "").lower() in ("solo", "smb", "mid"),
    }

    # Need is non-negotiable; require Need + at least 2 of the remaining four.
    others = sum(v for k, v in reasons.items() if k != "need")
    status = "pass" if reasons["need"] and others >= 2 else "hold"
    prospect.bant_status = status
    return {"bant_status": status, "reasons": reasons}


def score_prospect(prospect: "Prospect") -> dict[str, Any]:
    """Run both passes. Call this before the Router."""
    score = compute_victim_score(prospect)
    bant = qualify_bant(prospect)
    return {
        **score,
        **bant,
        "meets_threshold": prospect.victim_score >= ROUTE_THRESHOLD,
    }


if __name__ == "__main__":
    # Offline self-check with synthetic prospects (no Ollama, no network needed).
    import json
    from datetime import date

    if Prospect is None:
        print("Run as a module for the real models:  python -m pipeline.scorer")
        raise SystemExit(0)

    today = date.today()

    hot = Prospect(
        company_name="Northwind Coffee", primary_domain="northwindcoffee.com",
        vertical="ecommerce", company_size_band="smb",
        contact_name="Dana Lee", contact_title="Founder",
        dmarc_policy="none",
        signals=[
            RawSignal(source="x_profile", tier=__import__("common.models", fromlist=["SignalTier"]).SignalTier.PUBLIC_VICTIM,
                      signal_type="public_scam_warning", incident_date=today),
            RawSignal(source="udrp_wipo", tier=__import__("common.models", fromlist=["SignalTier"]).SignalTier.PUBLIC_VICTIM,
                      signal_type="udrp_filing", incident_date=today - timedelta(days=20)),
            RawSignal(source="crt.sh", tier=__import__("common.models", fromlist=["SignalTier"]).SignalTier.EXPOSURE,
                      signal_type="lookalike_domain", incident_date=today - timedelta(days=5)),
        ],
    )

    weak = Prospect(
        company_name="Quiet LLC", primary_domain="quiet.example",
        vertical="other", company_size_band="enterprise",
        dmarc_policy="reject",
        signals=[
            RawSignal(source="crt.sh", tier=__import__("common.models", fromlist=["SignalTier"]).SignalTier.EXPOSURE,
                      signal_type="lookalike_domain", incident_date=today - timedelta(days=400)),
        ],
    )

    for p in (hot, weak):
        result = score_prospect(p)
        print(f"\n{p.company_name}:")
        print(json.dumps(result, indent=2))
