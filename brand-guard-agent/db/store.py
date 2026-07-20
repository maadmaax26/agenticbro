"""
Store — the Supabase data-access layer (the ONLY place that touches the database)

The workers stay pure: scorer/router/drafter decide, send_worker gates, inbound classifies.
None of them read or write Supabase. This module is the seam between those pure decisions
and persistence, so the side-effects live in one auditable place:

  * load_suppression()        → hydrate the SuppressionStore the send worker checks
  * load_sendable_drafts()    → approved + unsent drafts, paired with their prospect
  * record_send()             → append a touch, bump cadence counters, mark the draft sent
  * apply_actions()           → persist the inbound worker's proposed actions
  * persist_inbound()         → convenience: apply a whole batch of inbound results

Two implementations behind one base class:
  * InMemoryStore — dict-backed fake for offline tests / dry runs (used by the self-test)
  * SupabaseStore — real; supabase-py with the SERVICE ROLE key (server-side only — it
    bypasses RLS, so it must NEVER reach a browser). supabase-py is imported lazily so
    this module loads even where the package isn't installed.

Guardrails preserved here (they match the schema + the worker contracts):
  * No hard deletes. An opt-out is an INSERT into suppression_list and is permanent;
    we never delete rows to "undo" a suppression.
  * Suppression inserts are idempotent (unique on match_type+value).
  * touches is append-only; touch_count is bumped, never decremented.
  * This layer sends nothing and approves nothing — sending is the worker's job behind a
    human-approved, dry-run-by-default transport.
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Optional

try:
    from common.models import Prospect
    from pipeline.send_worker import SuppressionStore
except ImportError:  # allow running the file directly
    Prospect = None      # type: ignore
    SuppressionStore = None  # type: ignore


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: Any) -> Optional[str]:
    if isinstance(dt, datetime):
        return dt.isoformat()
    return dt


# ===========================================================================
# shared dispatch + orchestration (impl-agnostic)
# ===========================================================================
class BaseStore(ABC):
    """
    Concrete stores implement the small set of primitives below. Everything the
    pipeline calls (load_sendable_drafts, record_send, apply_actions, ...) is built
    on those primitives here, so the two implementations can't drift in behavior.
    """

    # ---- primitives each backend must provide -----------------------------
    @abstractmethod
    def _suppression_sets(self) -> tuple[set[str], set[str]]:
        """Return (suppressed_emails, suppressed_domains), lowercased."""

    @abstractmethod
    def _fetch_sendable(self, limit: int) -> list[tuple["Prospect", dict[str, Any]]]:
        """Approved + unsent drafts joined to their prospect, as (Prospect, draft)."""

    @abstractmethod
    def _insert_touch(self, *, prospect_domain: Optional[str], draft_id: Optional[str],
                      channel: Optional[str], touch_number: Optional[int],
                      outcome: str, sent_at: datetime) -> None: ...

    @abstractmethod
    def _update_prospect(self, domain: Optional[str], fields: dict[str, Any]) -> None: ...

    @abstractmethod
    def _mark_draft_sent(self, draft_id: Optional[str], sent_at: datetime) -> None: ...

    @abstractmethod
    def _insert_suppression(self, match_type: str, value: str, reason: str) -> None: ...

    @abstractmethod
    def _insert_reply(self, *, prospect_domain: Optional[str], from_address: Optional[str],
                      channel: Optional[str], sentiment: str, body: Optional[str]) -> None: ...

    @abstractmethod
    def _upsert_prospect(self, prospect: "Prospect",
                         score_breakdown: Optional[dict[str, Any]] = None) -> None: ...

    # ---- queue primitives (resolver → Drafts approval tab) ----------------
    @abstractmethod
    def _insert_draft(self, prospect: "Prospect", draft: dict[str, Any]) -> str:
        """Persist one UNREVIEWED draft linked to its prospect; return its id."""

    @abstractmethod
    def _fetch_review_queue(self, limit: int) -> list[dict[str, Any]]:
        """Unreviewed drafts joined to prospect + signals, as JSON-able review rows."""

    @abstractmethod
    def _set_draft_approval(self, draft_id: str, *, approval: str,
                            edited_body: Optional[str], channel: Optional[str],
                            approved_by: Optional[str], approved_at: datetime,
                            reason: Optional[str]) -> Optional[dict[str, Any]]:
        """
        Flip a draft's approval state. Returns a small dict
        {prospect_domain, channel, contact_email} for the prospect-side update, or
        None if the draft id wasn't found.
        """

    # ---- public API the pipeline uses -------------------------------------
    def load_suppression(self) -> "SuppressionStore":
        emails, domains = self._suppression_sets()
        if SuppressionStore is None:                  # running file directly w/o pkg
            raise RuntimeError("SuppressionStore unavailable — run as `python -m db.store`")
        return SuppressionStore(emails=emails, domains=domains)

    def load_sendable_drafts(self, limit: int = 50) -> list[tuple["Prospect", dict[str, Any]]]:
        return self._fetch_sendable(limit)

    def record_send(self, prospect: "Prospect", draft: dict[str, Any],
                    result: dict[str, Any]) -> None:
        """
        Persist the outcome of one send_worker.send_touch() result.
          sent    → append touch, bump cadence counters, mark draft sent
          bounced → suppress the address, mark response_status=bounced (append touch)
          skipped/failed → log nothing destructive (optionally a 'skipped' touch)
        """
        outcome = result.get("outcome")
        sent_at = _utcnow()
        domain = prospect.primary_domain
        draft_id = draft.get("draft_id") or draft.get("id")
        channel = result.get("channel") or draft.get("channel")

        if outcome == "sent":
            self._insert_touch(prospect_domain=domain, draft_id=draft_id, channel=channel,
                               touch_number=result.get("touch_number"),
                               outcome="sent", sent_at=sent_at)
            # the worker already mutated the prospect; persist those fields explicitly
            self._update_prospect(domain, {
                "touch_count": getattr(prospect, "touch_count", 0),
                "last_touch_at": _iso(getattr(prospect, "last_touch_at", None)),
                "sent_at": _iso(getattr(prospect, "sent_at", None)),
                "draft": "sent",
            })
            self._mark_draft_sent(draft_id, sent_at)

        elif outcome == "bounced":
            self._insert_touch(prospect_domain=domain, draft_id=draft_id, channel=channel,
                               touch_number=result.get("touch_number"),
                               outcome="bounced", sent_at=sent_at)
            to = result.get("to")
            if to:
                self._insert_suppression("email", to, "bounce")
            self._update_prospect(domain, {"response_status": "bounced"})

        # skipped / failed: nothing to persist beyond app logs

    # ---- inbound actions --------------------------------------------------
    def apply_actions(self, actions: list[dict[str, Any]], *,
                      prospect: Optional["Prospect"] = None) -> list[str]:
        """
        Persist the action dicts produced by pipeline.inbound. Returns a short log of
        what was applied. Unknown actions are recorded and skipped (never guessed at).
        """
        applied: list[str] = []
        for a in actions:
            kind = a.get("action")
            if kind == "suppress":
                self._insert_suppression(a.get("match_type", "email"),
                                         a["value"], a.get("reason", "opt_out"))
                applied.append(f"suppress:{a.get('match_type')}={a['value']}")
            elif kind == "set_response_status":
                self._update_prospect(a.get("prospect_domain"),
                                      {"response_status": a["value"]})
                applied.append(f"response_status={a['value']}")
            elif kind == "stop_sequence":
                # response_status already stops the send worker; mark any queued draft too
                self._update_prospect(a.get("prospect_domain"), {"draft": "none"})
                applied.append(f"stop_sequence({a.get('reason')})")
            elif kind == "log_reply":
                self._insert_reply(prospect_domain=a.get("prospect_domain"),
                                   from_address=a.get("from"), channel=a.get("channel"),
                                   sentiment=a.get("sentiment", "unknown"),
                                   body=a.get("body"))
                applied.append(f"log_reply:{a.get('sentiment')}")
            elif kind == "upsert_prospect":
                if prospect is not None:
                    self._upsert_prospect(prospect)
                    applied.append(f"upsert_prospect:{prospect.primary_domain}")
                else:
                    applied.append("upsert_prospect:SKIPPED(no prospect)")
            elif kind == "flag_for_human":
                # a queue flag is a UI concern; the reply/lead rows above already carry
                # what the Replies / Inbound tabs read. Recorded for completeness.
                applied.append(f"flag_for_human:{a.get('queue')}/{a.get('priority','normal')}")
            else:
                applied.append(f"UNKNOWN_ACTION:{kind}")
        return applied

    def persist_inbound(self, results: list[dict[str, Any]]) -> list[str]:
        """Apply a whole batch of pipeline.inbound results (replies + leads)."""
        log: list[str] = []
        for r in results:
            log.extend(self.apply_actions(r.get("actions", []), prospect=r.get("prospect")))
        return log

    # ---- approval queue (resolver writes, Drafts tab reads, applier flips) -
    def save_prospect(self, prospect: "Prospect",
                      score_breakdown: Optional[dict[str, Any]] = None) -> None:
        """Upsert a scored/routed prospect (natural key = primary_domain)."""
        self._upsert_prospect(prospect, score_breakdown)

    def queue_draft(self, prospect: "Prospect", draft: dict[str, Any]) -> str:
        """
        Persist a draft into the approval queue as approval='unreviewed'. The draft
        dict is the drafter's output (channel/subject/body/opt_out_line/findings_used/
        routing_reason/...). Returns the new draft id. Nothing is approved or sent.
        """
        draft = {**draft, "approval": "unreviewed"}    # never queue pre-approved
        return self._insert_draft(prospect, draft)

    def load_review_queue(self, limit: int = 50) -> list[dict[str, Any]]:
        """
        The Drafts-tab payload: unreviewed drafts + their prospect + evidence +
        score breakdown + a live suppression check. JSON-serializable so it can be
        exported to the (browser) review UI without leaking DB credentials.
        """
        return self._fetch_review_queue(limit)

    def apply_approvals(self, decisions: list[dict[str, Any]], *,
                        approved_by: Optional[str] = None) -> list[str]:
        """
        Server-side applier for the review UI's decisions (the `approvals.json` batch).
        This is the ONLY place draft approval state changes. Each decision:

          { "draft_id": str,
            "decision": "approve" | "reject",
            "edited_body": str?,          # approve: store as edited_body (sends instead of body)
            "channel": str?,              # approve: override the routed channel (A/B/C/D)
            "reason": str?,               # reject: required audit reason
            "suppress": {"match_type","value"}?  # reject: also add to suppression_list
            "approved_by": str? }         # else falls back to the batch `approved_by`

        Returns a short human-readable log. Unknown decisions are recorded, never guessed.
        """
        applied: list[str] = []
        now = _utcnow()
        for d in decisions:
            did = d.get("draft_id")
            decision = (d.get("decision") or "").lower()
            who = d.get("approved_by") or approved_by

            if not did:
                applied.append("SKIP:missing_draft_id")
                continue

            if decision == "approve":
                row = self._set_draft_approval(
                    did, approval="approved", edited_body=d.get("edited_body"),
                    channel=d.get("channel"), approved_by=who, approved_at=now, reason=None)
                if row is None:
                    applied.append(f"SKIP:draft_not_found:{did}")
                    continue
                fields: dict[str, Any] = {"approval": "approved", "draft": "approved"}
                if d.get("channel"):
                    fields["routed_channel"] = d["channel"]
                self._update_prospect(row.get("prospect_domain"), fields)
                ch = d.get("channel") or row.get("channel")
                applied.append(f"approve:{did}:{row.get('prospect_domain')}:{ch}")

            elif decision == "reject":
                row = self._set_draft_approval(
                    did, approval="rejected", edited_body=None, channel=None,
                    approved_by=who, approved_at=now, reason=d.get("reason"))
                if row is None:
                    applied.append(f"SKIP:draft_not_found:{did}")
                    continue
                self._update_prospect(row.get("prospect_domain"),
                                      {"approval": "rejected", "draft": "none"})
                sup = d.get("suppress")
                if sup and sup.get("value"):
                    self._insert_suppression(sup.get("match_type", "domain"),
                                             sup["value"], "manual")
                    applied.append(f"reject+suppress:{did}:{sup['value']}")
                else:
                    applied.append(f"reject:{did}:{row.get('prospect_domain')}")

            else:
                applied.append(f"UNKNOWN_DECISION:{decision}:{did}")
        return applied


# ===========================================================================
# in-memory implementation (offline tests / dry runs)
# ===========================================================================
class InMemoryStore(BaseStore):
    def __init__(self) -> None:
        self.prospects: dict[str, "Prospect"] = {}
        self.drafts: list[dict[str, Any]] = []
        self.touches: list[dict[str, Any]] = []
        self.replies: list[dict[str, Any]] = []
        self.sup_emails: set[str] = set()
        self.sup_domains: set[str] = set()
        self.score_breakdowns: dict[str, dict[str, Any]] = {}   # domain -> breakdown
        self._draft_seq: int = 0

    # seed helpers (stand in for rows already in Supabase) ------------------
    def seed_prospect(self, prospect: "Prospect") -> None:
        self.prospects[prospect.primary_domain or ""] = prospect

    def seed_draft(self, draft: dict[str, Any]) -> None:
        self.drafts.append(draft)

    def seed_suppression(self, *, emails: set[str] = frozenset(),
                         domains: set[str] = frozenset()) -> None:
        self.sup_emails |= {e.lower() for e in emails}
        self.sup_domains |= {d.lower() for d in domains}

    # primitives ------------------------------------------------------------
    def _suppression_sets(self) -> tuple[set[str], set[str]]:
        return set(self.sup_emails), set(self.sup_domains)

    def _fetch_sendable(self, limit: int) -> list[tuple["Prospect", dict[str, Any]]]:
        out: list[tuple["Prospect", dict[str, Any]]] = []
        for d in self.drafts:
            if d.get("approval") != "approved" or d.get("sent_at"):
                continue
            p = self.prospects.get(d.get("prospect_domain", ""))
            if p is None:
                continue
            draft = {
                "draft_id": d.get("draft_id"),
                "channel": d.get("channel") or p.routed_channel,
                "subject": d.get("subject"),
                "body": d.get("body", ""),
                "edited_body": d.get("edited_body"),
                "opt_out_line": d.get("opt_out_line"),
                "send_by_hand": d.get("send_by_hand", False),
                "approval": "approved",
                "sendable": True,          # approved rows have already cleared the drafter gate
                "blockers": [],
                "to": p.contact_email,
            }
            out.append((p, draft))
            if len(out) >= limit:
                break
        return out

    def _insert_touch(self, *, prospect_domain, draft_id, channel, touch_number,
                      outcome, sent_at) -> None:
        self.touches.append({
            "prospect_domain": prospect_domain, "draft_id": draft_id, "channel": channel,
            "touch_number": touch_number, "outcome": outcome, "sent_at": _iso(sent_at),
        })

    def _update_prospect(self, domain, fields) -> None:
        p = self.prospects.get(domain or "")
        if p is None:
            return
        # column name -> model attribute name where they differ
        alias = {"draft": "draft_status", "approval": "approval_status"}
        for k, v in fields.items():
            attr = alias.get(k, k)
            if hasattr(p, attr):
                setattr(p, attr, v)

    def _mark_draft_sent(self, draft_id, sent_at) -> None:
        for d in self.drafts:
            if d.get("draft_id") == draft_id:
                d["sent_at"] = _iso(sent_at)

    def _insert_suppression(self, match_type, value, reason) -> None:
        if match_type == "email":
            self.sup_emails.add(value.lower())
        else:
            self.sup_domains.add(value.lower())

    def _insert_reply(self, *, prospect_domain, from_address, channel, sentiment, body) -> None:
        self.replies.append({
            "prospect_domain": prospect_domain, "from_address": from_address,
            "channel": channel, "sentiment": sentiment, "body": body, "handled": False,
        })

    def _upsert_prospect(self, prospect, score_breakdown=None) -> None:
        self.prospects[prospect.primary_domain or ""] = prospect
        if score_breakdown is not None:
            self.score_breakdowns[prospect.primary_domain or ""] = score_breakdown

    # ---- queue primitives -------------------------------------------------
    def _insert_draft(self, prospect, draft) -> str:
        self._draft_seq += 1
        draft_id = f"mem-{self._draft_seq}"
        row = {
            "draft_id": draft_id,
            "prospect_domain": prospect.primary_domain or "",
            "channel": draft.get("channel") or prospect.routed_channel,
            "subject": draft.get("subject"),
            "body": draft.get("body", ""),
            "edited_body": None,
            "opt_out_line": draft.get("opt_out_line"),
            "send_by_hand": draft.get("send_by_hand", False),
            "findings_used": draft.get("findings_used", {}),
            "routing_reason": draft.get("routing_reason"),
            "model": draft.get("model", "template"),
            "approval": "unreviewed",
            "approved_by": None,
            "approved_at": None,
            "reject_reason": None,
            "sent_at": None,
            "created_at": _iso(_utcnow()),
        }
        self.drafts.append(row)
        return draft_id

    def _fetch_review_queue(self, limit) -> list[dict[str, Any]]:
        sup_emails, sup_domains = self._suppression_sets()
        out: list[dict[str, Any]] = []
        for d in self.drafts:
            if d.get("approval") != "unreviewed":
                continue
            p = self.prospects.get(d.get("prospect_domain", ""))
            if p is None:
                continue
            email = (p.contact_email or "").lower()
            domain = (p.primary_domain or "").lower()
            suppressed = bool(p.suppressed) or email in sup_emails or domain in sup_domains
            out.append({
                "draft_id": d["draft_id"],
                "company_name": p.company_name,
                "primary_domain": p.primary_domain,
                "vertical": p.vertical,
                "company_size_band": p.company_size_band,
                "compliance_region": p.compliance_region,
                "compliance_ok": bool(p.compliance_ok),
                "victim_score": p.victim_score,
                "score_breakdown": self.score_breakdowns.get(d.get("prospect_domain", ""), {}),
                "channel": d.get("channel"),
                "routing_reason": d.get("routing_reason"),
                "subject": d.get("subject"),
                "body": d.get("body", ""),
                "edited_body": d.get("edited_body"),
                "opt_out_line": d.get("opt_out_line"),
                "send_by_hand": d.get("send_by_hand", False),
                "findings_used": d.get("findings_used", {}),
                "contact_channel": p.contact_channel,
                "contact_email": p.contact_email,
                "linkedin_url": p.linkedin_url,
                "approval": d.get("approval"),
                "suppressed": suppressed,
                "created_at": d.get("created_at"),
                "signals": [s.to_dict() for s in p.signals],
            })
            if len(out) >= limit:
                break
        return out

    def _set_draft_approval(self, draft_id, *, approval, edited_body, channel,
                            approved_by, approved_at, reason) -> Optional[dict[str, Any]]:
        for d in self.drafts:
            if d.get("draft_id") == draft_id:
                d["approval"] = approval
                d["approved_by"] = approved_by
                d["approved_at"] = _iso(approved_at)
                if edited_body is not None:
                    d["edited_body"] = edited_body
                if channel:
                    d["channel"] = channel
                if reason is not None:
                    d["reject_reason"] = reason
                p = self.prospects.get(d.get("prospect_domain", ""))
                return {
                    "prospect_domain": d.get("prospect_domain"),
                    "channel": d.get("channel"),
                    "contact_email": getattr(p, "contact_email", None),
                }
        return None


# ===========================================================================
# supabase implementation (server-side, SERVICE ROLE key)
# ===========================================================================
class SupabaseStore(BaseStore):
    """
    Real backend. Requires SUPABASE_URL + a server-side secret key in the environment.

    Key name: Supabase disabled the legacy JWT service-role keys (2026-05-17) in favor
    of the new `sb_secret_...` format. This reads, in priority order:
        SUPABASE_SECRET_API_KEY   (current — sb_secret_...)
        SUPABASE_SERVICE_ROLE_KEY (legacy fallback, if you still have one enabled)
    Either is a privileged key that bypasses RLS — only ever run this server-side
    (the OpenClaw agent / a cron worker), NEVER in client code.
    """

    _KEY_ENV_VARS = ("SUPABASE_SECRET_API_KEY", "SUPABASE_SERVICE_ROLE_KEY")

    def __init__(self, url: Optional[str] = None, service_key: Optional[str] = None) -> None:
        url = url or os.environ.get("SUPABASE_URL")
        if service_key is None:
            for var in self._KEY_ENV_VARS:
                service_key = os.environ.get(var)
                if service_key:
                    break
        if not url or not service_key:
            raise RuntimeError(
                "SupabaseStore needs SUPABASE_URL and a server-side secret key "
                "(SUPABASE_SECRET_API_KEY, or legacy SUPABASE_SERVICE_ROLE_KEY). "
                "Set them in the server environment (never expose the secret key client-side)."
            )
        try:
            from supabase import create_client  # lazy: only needed for the real backend
        except ImportError as e:                 # pragma: no cover
            raise RuntimeError("pip install supabase  # required for SupabaseStore") from e
        self.client = create_client(url, service_key)

    # NOTE: these mirror the BaseStore primitives against the schema in db/schema.sql.
    # Kept compact; adapt column names if your live tables differ.
    def _suppression_sets(self) -> tuple[set[str], set[str]]:
        rows = self.client.table("suppression_list").select("match_type,value").execute().data or []
        emails = {r["value"].lower() for r in rows if r["match_type"] == "email"}
        domains = {r["value"].lower() for r in rows if r["match_type"] == "domain"}
        return emails, domains

    def _prospect_id(self, domain: Optional[str]) -> Optional[str]:
        if not domain:
            return None
        rows = (self.client.table("prospects").select("id")
                .eq("primary_domain", domain).limit(1).execute().data or [])
        return rows[0]["id"] if rows else None

    def _fetch_sendable(self, limit: int) -> list[tuple["Prospect", dict[str, Any]]]:
        # approved, unsent drafts + their prospect (PostgREST embedded resource)
        rows = (self.client.table("outreach_drafts")
                .select("*, prospects(*)")
                .eq("approval", "approved").is_("sent_at", "null")
                .limit(limit).execute().data or [])
        out: list[tuple["Prospect", dict[str, Any]]] = []
        for r in rows:
            pr = r.get("prospects") or {}
            if Prospect is None:
                continue
            p = Prospect(
                company_name=pr.get("company_name"), primary_domain=pr.get("primary_domain"),
                vertical=pr.get("vertical"), company_size_band=pr.get("company_size_band"),
                contact_name=pr.get("contact_name"), contact_title=pr.get("contact_title"),
                contact_channel=pr.get("contact_channel"), contact_email=pr.get("contact_email"),
                linkedin_url=pr.get("linkedin_url"), routed_channel=pr.get("routed_channel"),
                compliance_region=pr.get("compliance_region"),
                approval_status=pr.get("approval", "unreviewed"),
                touch_count=pr.get("touch_count", 0) or 0,
                response_status=pr.get("response_status", "none") or "none",
            )
            draft = {
                "draft_id": r.get("id"), "channel": r.get("channel") or p.routed_channel,
                "subject": r.get("subject"), "body": r.get("body", ""),
                "edited_body": r.get("edited_body"), "opt_out_line": r.get("opt_out_line"),
                "send_by_hand": (r.get("channel") in ("A", "C")),
                "approval": "approved", "sendable": True, "blockers": [],
                "to": p.contact_email,
            }
            out.append((p, draft))
        return out

    def _insert_touch(self, *, prospect_domain, draft_id, channel, touch_number,
                      outcome, sent_at) -> None:
        self.client.table("touches").insert({
            "prospect_id": self._prospect_id(prospect_domain), "draft_id": draft_id,
            "channel": channel, "touch_number": touch_number, "outcome": outcome,
            "sent_at": _iso(sent_at),
        }).execute()

    def _update_prospect(self, domain, fields) -> None:
        if not domain:
            return
        self.client.table("prospects").update(fields).eq("primary_domain", domain).execute()

    def _mark_draft_sent(self, draft_id, sent_at) -> None:
        if not draft_id:
            return
        self.client.table("outreach_drafts").update({"sent_at": _iso(sent_at)}) \
            .eq("id", draft_id).execute()

    def _insert_suppression(self, match_type, value, reason) -> None:
        # upsert so opt-outs are idempotent (unique match_type+value)
        self.client.table("suppression_list").upsert(
            {"match_type": match_type, "value": value, "reason": reason},
            on_conflict="match_type,value",
        ).execute()

    def _insert_reply(self, *, prospect_domain, from_address, channel, sentiment, body) -> None:
        self.client.table("replies").insert({
            "prospect_id": self._prospect_id(prospect_domain), "from_address": from_address,
            "channel": channel, "sentiment": sentiment, "body": body, "handled": False,
        }).execute()

    def _upsert_prospect(self, prospect, score_breakdown=None) -> None:
        row = {
            "company_name": prospect.company_name, "primary_domain": prospect.primary_domain,
            "vertical": prospect.vertical, "company_size_band": prospect.company_size_band,
            "contact_name": prospect.contact_name, "contact_title": prospect.contact_title,
            "contact_channel": prospect.contact_channel, "contact_email": prospect.contact_email,
            "linkedin_url": prospect.linkedin_url,
            "crt_lookalikes": prospect.crt_lookalikes or [],
            "dmarc_policy": prospect.dmarc_policy, "dmarc_score": prospect.dmarc_score,
            "victim_score": prospect.victim_score,
            "routed_channel": prospect.routed_channel,
            "compliance_region": prospect.compliance_region, "compliance_ok": prospect.compliance_ok,
            "bant": prospect.bant_status, "approval": prospect.approval_status,
            "suppressed": prospect.suppressed,
        }
        if score_breakdown is not None:
            row["score_breakdown"] = score_breakdown
        self.client.table("prospects").upsert(row, on_conflict="primary_domain").execute()

    # ---- queue primitives -------------------------------------------------
    def _insert_draft(self, prospect, draft) -> str:
        res = self.client.table("outreach_drafts").insert({
            "prospect_id": self._prospect_id(prospect.primary_domain),
            "channel": draft.get("channel") or prospect.routed_channel,
            "subject": draft.get("subject"),
            "body": draft.get("body", ""),
            "opt_out_line": draft.get("opt_out_line"),
            "findings_used": draft.get("findings_used", {}),
            "model": draft.get("model", "template"),
            "approval": "unreviewed",
        }).execute()
        rows = res.data or []
        return rows[0]["id"] if rows else ""

    def _fetch_review_queue(self, limit) -> list[dict[str, Any]]:
        sup_emails, sup_domains = self._suppression_sets()
        rows = (self.client.table("outreach_drafts")
                .select("*, prospects(*, signals(*))")
                .eq("approval", "unreviewed").is_("sent_at", "null")
                .order("created_at", desc=True).limit(limit).execute().data or [])
        out: list[dict[str, Any]] = []
        for r in rows:
            pr = r.get("prospects") or {}
            email = (pr.get("contact_email") or "").lower()
            domain = (pr.get("primary_domain") or "").lower()
            suppressed = (bool(pr.get("suppressed"))
                          or email in sup_emails or domain in sup_domains)
            out.append({
                "draft_id": r.get("id"),
                "company_name": pr.get("company_name"),
                "primary_domain": pr.get("primary_domain"),
                "vertical": pr.get("vertical"),
                "company_size_band": pr.get("company_size_band"),
                "compliance_region": pr.get("compliance_region"),
                "compliance_ok": bool(pr.get("compliance_ok")),
                "victim_score": pr.get("victim_score", 0),
                "score_breakdown": pr.get("score_breakdown", {}),
                "channel": r.get("channel"),
                "routing_reason": None,   # router reason isn't a column; surfaced from app logs
                "subject": r.get("subject"),
                "body": r.get("body", ""),
                "edited_body": r.get("edited_body"),
                "opt_out_line": r.get("opt_out_line"),
                "send_by_hand": (r.get("channel") in ("A", "C")),
                "findings_used": r.get("findings_used", {}),
                "contact_channel": pr.get("contact_channel"),
                "contact_email": pr.get("contact_email"),
                "linkedin_url": pr.get("linkedin_url"),
                "approval": r.get("approval"),
                "suppressed": suppressed,
                "created_at": r.get("created_at"),
                "signals": pr.get("signals", []),
            })
        return out

    def _set_draft_approval(self, draft_id, *, approval, edited_body, channel,
                            approved_by, approved_at, reason) -> Optional[dict[str, Any]]:
        update: dict[str, Any] = {"approval": approval,
                                  "approved_by": approved_by,
                                  "approved_at": _iso(approved_at)}
        if edited_body is not None:
            update["edited_body"] = edited_body
        if channel:
            update["channel"] = channel
        res = (self.client.table("outreach_drafts").update(update)
               .eq("id", draft_id).execute())
        rows = res.data or []
        if not rows:
            return None
        r = rows[0]
        pid = r.get("prospect_id")
        domain = contact_email = None
        if pid:
            prs = (self.client.table("prospects")
                   .select("primary_domain,contact_email").eq("id", pid)
                   .limit(1).execute().data or [])
            if prs:
                domain = prs[0].get("primary_domain")
                contact_email = prs[0].get("contact_email")
        return {"prospect_domain": domain, "channel": r.get("channel"),
                "contact_email": contact_email}


# ---------------------------------------------------------------------------
# .env loading — fills MISSING vars from a local .env file. Real environment
# variables always win; this never overrides them and never prints any value.
# Dependency-free (no python-dotenv needed).
# ---------------------------------------------------------------------------
# Where SupabaseStore looks for its config, in priority order.
_REQUIRED_ENV = ("SUPABASE_URL",) + SupabaseStore._KEY_ENV_VARS

# Candidate .env locations, searched in order. `~` is expanded. The agenticbro
# repo is the canonical source; the OpenClaw workspace mirror is a fallback.
_ENV_FILE_CANDIDATES = (
    "~/agenticbro/.env.local",
    "~/.openclaw/workspace/.env.local",
    "~/agenticbro/.env",
    "./.env.local",
    "./.env",
)


def _parse_env_file(path: str) -> dict[str, str]:
    """Minimal KEY=value parser: handles `export `, quotes, blank/# lines."""
    out: dict[str, str] = {}
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith("#"):
                    continue
                if line.startswith("export "):
                    line = line[len("export "):]
                if "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                if not key or not key[0].isalpha() and key[0] != "_":
                    continue
                val = val.strip()
                if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
                    val = val[1:-1]                       # strip matching quotes
                elif " #" in val:                          # unquoted inline comment
                    val = val.split(" #", 1)[0].strip()
                out[key] = val
    except OSError:
        pass
    return out


def load_env_file(path: Optional[str] = None, *, override: bool = False) -> Optional[str]:
    """
    Load env vars from a .env file into os.environ for any var not already set.

    Resolution: explicit `path` arg → $BRANDGUARD_ENV_FILE → the candidate list.
    Returns the path actually loaded, or None if nothing was found. Only the KEY
    NAMES are logged; secret VALUES are never printed.
    """
    search = [path] if path else []
    if not path:
        env_override = os.environ.get("BRANDGUARD_ENV_FILE")
        if env_override:
            search.append(env_override)
        search.extend(_ENV_FILE_CANDIDATES)

    for cand in search:
        if not cand:
            continue
        resolved = os.path.expanduser(cand)
        if not os.path.isfile(resolved):
            continue
        pairs = _parse_env_file(resolved)
        applied = []
        for k, v in pairs.items():
            if override or k not in os.environ:
                os.environ[k] = v
                applied.append(k)
        # only report the vars we actually care about (names only, no values)
        relevant = [k for k in applied if k in _REQUIRED_ENV]
        print(f"[store] loaded env from {resolved} "
              f"({len(applied)} var(s); supabase keys set: {relevant or 'none new'})")
        return resolved
    return None


def connect(env_file: Optional[str] = None, *, auto_load: bool = True) -> BaseStore:
    """
    Factory → a real SupabaseStore.

    If `auto_load` (default) and the Supabase vars aren't already in the environment,
    this sources them from a local `.env.local` first (see `load_env_file`), so you can
    just call `connect()` without manually exporting anything. Pass `env_file=...` to
    point at a specific file, or `auto_load=False` to require the vars be pre-set.
    Tests construct `InMemoryStore()` directly and never touch this.
    """
    have_url = bool(os.environ.get("SUPABASE_URL"))
    have_key = any(os.environ.get(k) for k in SupabaseStore._KEY_ENV_VARS)
    if auto_load and not (have_url and have_key):
        if load_env_file(env_file) is None and env_file:
            raise RuntimeError(f"env file not found: {env_file}")
    return SupabaseStore()


if __name__ == "__main__":
    if Prospect is None:
        print("Run as a module:  python -m db.store")
        raise SystemExit(0)

    from datetime import timezone as _tz
    from pipeline.send_worker import send_touch, ConsoleTransport
    from pipeline.inbound import InboundEvent, process_inbound

    store = InMemoryStore()

    # --- seed: two approved drafts + a prior suppression (as if already in Supabase) ---
    store.seed_prospect(Prospect(company_name="GoodLead", primary_domain="goodlead.com",
                                 routed_channel="D", contact_channel="email",
                                 contact_email="owner@goodlead.com", contact_name="Pat",
                                 approval_status="approved"))
    store.seed_prospect(Prospect(company_name="OldLead", primary_domain="oldlead.com",
                                 routed_channel="D", contact_channel="email",
                                 contact_email="optout@oldlead.com", approval_status="approved"))
    store.seed_draft({"draft_id": "d1", "prospect_domain": "goodlead.com", "channel": "D",
                      "approval": "approved", "subject": "A brand-impersonation finding",
                      "body": "Hi Pat — one verified finding about goodlead.com. Free scan, no card.",
                      "opt_out_line": "Opt out: https://x/optout"})
    store.seed_draft({"draft_id": "d2", "prospect_domain": "oldlead.com", "channel": "D",
                      "approval": "approved", "subject": "A finding",
                      "body": "Hi — a finding about oldlead.com.",
                      "opt_out_line": "Opt out: https://x/optout"})
    store.seed_suppression(emails={"optout@oldlead.com"})   # they opted out previously

    now = datetime(2026, 6, 19, tzinfo=_tz.utc)
    console = ConsoleTransport(verbose=True)
    suppression = store.load_suppression()

    print("=" * 72)
    print("OUTBOUND — load approved drafts, gate, send (dry-run), persist touches")
    for prospect, draft in store.load_sendable_drafts():
        result = send_touch(prospect, draft, transport=console,
                            suppression=suppression, now=now)
        store.record_send(prospect, draft, result)
        print(f"  {prospect.company_name:9} → {result['outcome'].upper():7} ({result.get('reason')})")

    print("\nState after outbound:")
    print(f"  touches logged      : {len(store.touches)}  -> {store.touches}")
    print(f"  GoodLead touch_count: {store.prospects['goodlead.com'].touch_count}")
    print(f"  draft d1 sent_at    : {[d.get('sent_at') for d in store.drafts if d['draft_id']=='d1'][0]}")

    print("\n" + "=" * 72)
    print("INBOUND — classify events, persist actions (suppress / stop / warm lead)")
    events = [
        InboundEvent(kind="reply", source="email", from_address="ceo@goodlead.com",
                     prospect_domain="goodlead.com",
                     body="This is helpful — tell me about pricing?"),
        InboundEvent(kind="reply", source="email", from_address="busy@acme.com",
                     prospect_domain="acme.com", body="unsubscribe me please"),
        InboundEvent(kind="lead", source="scan", from_address="owner@warmlead.com",
                     company_name="Warm Lead Co.", contact_name="Robin",
                     prospect_domain="warmlead.com", body="Ran the scan, found lookalikes."),
    ]
    log = store.persist_inbound(process_inbound(events, use_llm=False))
    for line in log:
        print(f"  • {line}")

    print("\nState after inbound:")
    print(f"  suppressed emails   : {sorted(store.sup_emails)}")
    print(f"  goodlead response   : {store.prospects['goodlead.com'].response_status}")
    print(f"  replies logged      : {len(store.replies)}")
    print(f"  warm lead upserted  : {'warmlead.com' in store.prospects} "
          f"(channel={store.prospects.get('warmlead.com').routed_channel if 'warmlead.com' in store.prospects else '—'})")
    print("=" * 72)
    print("InMemoryStore only — no network, no Supabase, nothing sent.")
