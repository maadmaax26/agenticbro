"""
Shared data models for the Brand Guard discovery/outreach agent.

These mirror the Supabase `prospects` schema in the implementation pack.
Keep this as the single source of truth so every collector emits the same shape.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import date, datetime
from enum import Enum
from typing import Any, Optional


class SignalTier(str, Enum):
    PUBLIC_VICTIM = "tier1"      # self-disclosed warning, complaint, UDRP/URS
    DOCUMENTED_HARM = "tier2"    # phishing feed, news
    EXPOSURE = "tier3"          # crt.sh lookalike, weak DMARC (qualifier only)


class ImpersonationType(str, Enum):
    DOMAIN = "domain"
    EMAIL = "email"
    SOCIAL = "social"
    MARKETPLACE = "marketplace"
    UNKNOWN = "unknown"


@dataclass
class RawSignal:
    """One piece of evidence from a single source, pre-resolution."""
    source: str                              # e.g. "crt.sh", "udrp_wipo", "x_profile"
    tier: SignalTier
    signal_type: str                         # human-readable, e.g. "lookalike_domain"
    impersonation_type: ImpersonationType = ImpersonationType.UNKNOWN
    impersonated_brand: Optional[str] = None
    signal_url: Optional[str] = None
    snippet: Optional[str] = None            # raw text for the LLM classifier
    incident_date: Optional[date] = None
    extra: dict[str, Any] = field(default_factory=dict)
    collected_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["tier"] = self.tier.value
        d["impersonation_type"] = self.impersonation_type.value
        if self.incident_date:
            d["incident_date"] = self.incident_date.isoformat()
        d["collected_at"] = self.collected_at.isoformat()
        return d


@dataclass
class Prospect:
    """A resolved, enriched, scored prospect ready for routing."""
    company_name: Optional[str] = None
    primary_domain: Optional[str] = None
    vertical: Optional[str] = None
    company_size_band: Optional[str] = None          # solo | smb | mid | enterprise

    contact_name: Optional[str] = None
    contact_title: Optional[str] = None
    contact_channel: Optional[str] = None            # email | linkedin | abuse_inbox | public_reply
    contact_email: Optional[str] = None              # actual address used by the send worker (B/D)
    linkedin_url: Optional[str] = None               # decision-maker's profile (enables Channel C)

    signals: list[RawSignal] = field(default_factory=list)

    crt_lookalikes: list[str] = field(default_factory=list)
    dmarc_policy: Optional[str] = None               # none | quarantine | reject | missing
    dmarc_score: Optional[int] = None

    victim_score: int = 0
    bant_status: Optional[str] = None                # pass | hold

    routed_channel: Optional[str] = None             # A | B | C | D | E
    compliance_region: Optional[str] = None          # US | EU | UK | other
    compliance_ok: bool = False

    draft_status: Optional[str] = None
    approval_status: str = "unreviewed"              # unreviewed | approved | rejected
    suppressed: bool = False

    # ---- outreach state (mirrors prospects table; managed by the send worker) ----
    touch_count: int = 0                             # 0..3, cadence cap
    last_touch_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    response_status: str = "none"                    # none|replied|opted_out|bounced|converted

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["signals"] = [s.to_dict() for s in self.signals]
        if self.last_touch_at:
            d["last_touch_at"] = self.last_touch_at.isoformat()
        if self.sent_at:
            d["sent_at"] = self.sent_at.isoformat()
        return d


# ---- Victim Score weights (see implementation pack §1) -------------------
VICTIM_SCORE_WEIGHTS = {
    "public_scam_warning": 35,
    "udrp_recent": 35,            # filing < 180 days
    "customer_complaint": 25,
    "live_phishing": 25,
    "news_incident": 20,
    "lookalike_live": 10,        # per domain, capped at 20 by the scorer
    "dmarc_weak": 10,
    "decision_maker_found": 10,
    "smb_confirmed": 10,
}
ROUTE_THRESHOLD = 30
