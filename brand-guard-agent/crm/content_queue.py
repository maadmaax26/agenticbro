"""Service-role adapter for the website Brand Guard content review queue."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional


CONTENT_COLUMNS = ",".join([
    "id",
    "status",
    "content_scope",
    "finding_type",
    "safe_summary",
    "draft_copy",
    "draft_hashtags",
    "draft_image_spec",
    "safety_flags",
    "telegram_message_id",
    "created_at",
])


class ContentQueue:
    """Narrow repository for brand_guard_content_candidates."""

    def __init__(self, client: Any) -> None:
        self.client = client

    def list_new(self, limit: int = 5) -> list[dict[str, Any]]:
        return (
            self.client.table("brand_guard_content_candidates")
            .select(CONTENT_COLUMNS)
            .eq("status", "new")
            .is_("telegram_message_id", "null")
            .order("created_at")
            .limit(max(1, min(limit, 50)))
            .execute()
            .data
            or []
        )

    def status_counts(self) -> dict[str, int]:
        rows = (
            self.client.table("brand_guard_content_candidates")
            .select("status")
            .limit(1000)
            .execute()
            .data
            or []
        )
        counts: dict[str, int] = {}
        for row in rows:
            status = str(row.get("status") or "unknown")
            counts[status] = counts.get(status, 0) + 1
        return counts

    def claim(self, candidate_id: str) -> Optional[dict[str, Any]]:
        rows = (
            self.client.table("brand_guard_content_candidates")
            .update({"status": "in_review"})
            .eq("id", candidate_id)
            .eq("status", "new")
            .is_("telegram_message_id", "null")
            .execute()
            .data
            or []
        )
        return rows[0] if rows else None

    def record_telegram_message(self, candidate_id: str, message_id: int) -> None:
        rows = (
            self.client.table("brand_guard_content_candidates")
            .update({"telegram_message_id": str(message_id)})
            .eq("id", candidate_id)
            .eq("status", "in_review")
            .execute()
            .data
            or []
        )
        if not rows:
            raise RuntimeError(f"Content candidate is no longer in review: {candidate_id}")

    def release_claim(self, candidate_id: str) -> None:
        (
            self.client.table("brand_guard_content_candidates")
            .update({"status": "new"})
            .eq("id", candidate_id)
            .eq("status", "in_review")
            .is_("telegram_message_id", "null")
            .execute()
        )

    def decide(self, candidate_id: str, decision: str, reviewed_by: str) -> str:
        target = {
            "approve": "approved",
            "reject": "rejected",
            "skip": "held",
        }.get(decision)
        if not target:
            raise ValueError(f"Unknown content decision: {decision}")

        existing = (
            self.client.table("brand_guard_content_candidates")
            .select("id,status")
            .eq("id", candidate_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not existing:
            raise KeyError(f"Content candidate not found: {candidate_id}")
        if existing[0].get("status") == target:
            return target
        if existing[0].get("status") != "in_review":
            raise RuntimeError(
                f"Content candidate cannot move from {existing[0].get('status')} to {target}",
            )

        now = datetime.now(timezone.utc).isoformat()
        rows = (
            self.client.table("brand_guard_content_candidates")
            .update({
                "status": target,
                "reviewed_by": reviewed_by,
                "reviewed_at": now,
            })
            .eq("id", candidate_id)
            .eq("status", "in_review")
            .execute()
            .data
            or []
        )
        if not rows:
            raise RuntimeError(f"Content candidate changed during review: {candidate_id}")
        return target


def connect_content_queue(env_file: Optional[str] = None) -> ContentQueue:
    from db.store import load_env_file

    if not os.environ.get("SUPABASE_URL") or not (
        os.environ.get("SUPABASE_SECRET_API_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    ):
        load_env_file(env_file)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_API_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("Content queue requires SUPABASE_URL and a server-side secret key")

    try:
        from supabase import create_client
    except ImportError as error:  # pragma: no cover
        raise RuntimeError("pip install supabase  # required for the content queue") from error
    return ContentQueue(create_client(url, key))
