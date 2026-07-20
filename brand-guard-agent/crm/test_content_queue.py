from __future__ import annotations

import unittest
from dataclasses import dataclass
from typing import Any

from crm.content_queue import ContentQueue


@dataclass
class Result:
    data: list[dict[str, Any]]


class Query:
    def __init__(self, rows: list[dict[str, Any]], operation: str, payload=None) -> None:
        self.rows = rows
        self.operation = operation
        self.payload = payload
        self.filters: list[tuple[str, str, Any]] = []
        self.max_rows: int | None = None

    def select(self, _columns):
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def eq(self, column, value):
        self.filters.append(("eq", column, value))
        return self

    def is_(self, column, value):
        self.filters.append(("is", column, value))
        return self

    def order(self, _column):
        return self

    def limit(self, value):
        self.max_rows = value
        return self

    def execute(self):
        matched = []
        for row in self.rows:
            if all(
                row.get(column) == value if kind == "eq" else row.get(column) is None
                for kind, column, value in self.filters
            ):
                matched.append(row)
        if self.max_rows is not None:
            matched = matched[:self.max_rows]
        if self.operation == "update":
            for row in matched:
                row.update(self.payload)
        return Result([dict(row) for row in matched])


class FakeClient:
    def __init__(self, rows):
        self.rows = rows

    def table(self, _name):
        return Query(self.rows, "select")


class ContentQueueTests(unittest.TestCase):
    def setUp(self):
        self.rows = [{
            "id": "candidate-1",
            "status": "new",
            "telegram_message_id": None,
            "draft_copy": "Safe draft",
        }]
        self.queue = ContentQueue(FakeClient(self.rows))

    def test_claim_is_idempotent_and_records_message(self):
        self.assertEqual(len(self.queue.list_new()), 1)
        self.assertIsNotNone(self.queue.claim("candidate-1"))
        self.assertIsNone(self.queue.claim("candidate-1"))
        self.queue.record_telegram_message("candidate-1", 42)
        self.assertEqual(self.rows[0]["telegram_message_id"], "42")
        self.assertEqual(self.queue.list_new(), [])

    def test_approval_does_not_mark_candidate_posted(self):
        self.queue.claim("candidate-1")
        self.queue.record_telegram_message("candidate-1", 42)
        self.assertEqual(self.queue.decide("candidate-1", "approve", "admin"), "approved")
        self.assertEqual(self.queue.decide("candidate-1", "approve", "admin"), "approved")
        self.assertEqual(self.rows[0]["status"], "approved")
        self.assertNotIn("posted_url", self.rows[0])

    def test_failed_delivery_can_release_claim(self):
        self.queue.claim("candidate-1")
        self.queue.release_claim("candidate-1")
        self.assertEqual(self.rows[0]["status"], "new")


if __name__ == "__main__":
    unittest.main()
