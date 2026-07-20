"""
Send worker  —  the last gate before an approved draft actually goes out

Runs AFTER scorer → router → drafter → HUMAN APPROVAL. Its only job is to take a
prospect that a human already approved and decide, in auditable code, whether this
specific touch may be sent right now — then hand the message to a transport and log
the touch. It NEVER invents recipients, NEVER edits copy, and NEVER overrides a stop.

Why this lives in code (not the model): every "we sent X to Y on date Z" must be
explainable and reproducible for CAN-SPAM / GDPR. The model is nowhere near a send.

Hard gates enforced here, in order (first failure wins, reason recorded):
  1. send-by-hand channels never auto-send   (C = LinkedIn from your profile; A = public reply)
  2. inbound-only channels never send          (E)
  3. draft must be approved AND sendable       (the drafter's blockers must be empty)
  4. suppression list is checked every time    (opt-out/bounce/complaint = permanent)
  5. response already closed the loop           (replied / opted_out / bounced / converted = stop)
  6. cadence cap: max 3 touches, same channel   (FOLLOWUP_RULE; then 60-day nurture)
  7. minimum spacing between touches            (don't re-hit the same person too fast)

Transports are pluggable and default to a DRY-RUN console transport — i.e. running
this file sends NOTHING. Wiring a real SMTP transport (your Supabase custom SMTP) is
an explicit, opt-in step the operator takes; see SmtpTransport below.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional, Protocol

try:
    from common.models import Prospect
    from pipeline.router import FOLLOWUP_RULE
except ImportError:  # allow running the file directly
    Prospect = None  # type: ignore
    FOLLOWUP_RULE = {"max_touches": 3, "same_channel": True}

# Channels a human sends, not the worker:
#   C  LinkedIn note from your personal profile (drafter sets send_by_hand=True)
#   A  credible public reply — you post it yourself where they raised the issue
SEND_BY_HAND_CHANNELS = {"A", "C"}
# Channel with no outbound message at all (always-on inbound capture)
INBOUND_ONLY_CHANNELS = {"E"}
# Channels this worker is allowed to actually transmit (legitimacy-first email)
AUTO_SEND_CHANNELS = {"B", "D"}

MAX_TOUCHES = int(FOLLOWUP_RULE.get("max_touches", 3))
# Conservative default spacing; the operator can override. Value-add each touch.
MIN_DAYS_BETWEEN_TOUCHES = 4
# Response states that permanently stop a sequence.
STOP_RESPONSE_STATES = {"replied", "opted_out", "bounced", "converted"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# suppression — checked before EVERY send (mirrors db/suppression_list)
# ---------------------------------------------------------------------------
class SuppressionStore:
    """
    Minimal, pluggable suppression check. In production back this with the
    `suppression_list` table (match_type in ('email','domain')). Here it's an
    in-memory set so the worker is testable offline. Matching is case-insensitive.
    """

    def __init__(self, emails: Optional[set[str]] = None,
                 domains: Optional[set[str]] = None) -> None:
        self._emails = {e.lower().strip() for e in (emails or set())}
        self._domains = {d.lower().strip() for d in (domains or set())}

    def add_email(self, email: str) -> None:
        self._emails.add(email.lower().strip())

    def add_domain(self, domain: str) -> None:
        self._domains.add(domain.lower().strip())

    def is_suppressed(self, *, email: Optional[str], domain: Optional[str]) -> Optional[str]:
        """Return the matched reason ('email'/'domain') or None if clear to send."""
        if email and email.lower().strip() in self._emails:
            return "email"
        if domain and domain.lower().strip() in self._domains:
            return "domain"
        # also suppress if the email's own domain is suppressed
        if email and "@" in email:
            edom = email.split("@", 1)[1].lower().strip()
            if edom in self._domains:
                return "domain"
        return None


# ---------------------------------------------------------------------------
# transports — where a cleared message actually goes
# ---------------------------------------------------------------------------
class Transport(Protocol):
    def send(self, message: dict[str, Any]) -> dict[str, Any]:
        """Return {'outcome': 'sent'|'failed'|'bounced', 'detail': str}."""
        ...


@dataclass
class ConsoleTransport:
    """Default. Prints the message and reports 'sent' WITHOUT transmitting anything."""
    sink: list[dict[str, Any]] = field(default_factory=list)
    verbose: bool = True

    def send(self, message: dict[str, Any]) -> dict[str, Any]:
        self.sink.append(message)
        if self.verbose:
            print(f"[DRY-RUN] would send to {message.get('to')}  "
                  f"subj={message.get('subject')!r}")
        return {"outcome": "sent", "detail": "dry-run (console transport, nothing transmitted)"}


class SmtpTransport:
    """
    OPT-IN real sender (e.g. your Supabase custom SMTP). NOT used by the self-test and
    NOT constructed anywhere by default — the worker still ships dry-run.

    Two independent locks must BOTH be released before a single byte leaves the box:
      1. You construct an SmtpTransport and hand it to the worker (default is Console).
      2. It is *armed*: either pass ``armed=True`` or set env ``BRANDGUARD_LIVE_SEND=1``.
         A disarmed transport builds the message, prints what it WOULD do, and returns
         ``outcome='disarmed'`` (the worker treats that as "not sent" — no touch logged).

    This double-lock means importing/constructing the class can never send by accident;
    real transmission is a deliberate operator action taken after a compliance review.

    ``smtp_factory`` is injectable so tests (and dry-runs) can exercise the full build/
    send path against a fake server with no socket. Defaults to the stdlib SMTP clients.
    """

    _ARM_ENV = "BRANDGUARD_LIVE_SEND"
    _ARM_TRUE = {"1", "true", "yes", "on"}
    # SMTP reply codes that mean the address is bad → suppress it immediately.
    _BOUNCE_CODES = {510, 511, 513, 550, 551, 553}

    def __init__(self, host: str, port: int, username: str, password: str,
                 from_addr: str, *, use_tls: bool = True,
                 reply_to: Optional[str] = None,
                 armed: Optional[bool] = None,
                 smtp_factory: Optional[Callable[..., Any]] = None) -> None:
        self.host, self.port = host, port
        self.username, self.password = username, password
        self.from_addr, self.use_tls = from_addr, use_tls
        self.reply_to = reply_to
        self.armed = self._resolve_armed(armed)
        self._smtp_factory = smtp_factory       # for tests / custom clients

    @classmethod
    def _resolve_armed(cls, armed: Optional[bool]) -> bool:
        if armed is not None:
            return bool(armed)
        import os
        return os.environ.get(cls._ARM_ENV, "").strip().lower() in cls._ARM_TRUE

    def _build_mime(self, message: dict[str, Any]):
        from email.mime.text import MIMEText
        from email.utils import formatdate, make_msgid
        msg = MIMEText(message.get("body", ""), "plain", "utf-8")
        msg["Subject"] = message.get("subject", "")
        msg["From"] = self.from_addr
        msg["To"] = message["to"]
        if self.reply_to:
            msg["Reply-To"] = self.reply_to
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid()
        return msg

    def _open(self):
        """Return a connected, authenticated SMTP client (real or injected)."""
        if self._smtp_factory is not None:
            return self._smtp_factory(self.host, self.port)
        import smtplib
        if self.port == 465:                    # implicit TLS
            client = smtplib.SMTP_SSL(self.host, self.port, timeout=30)
        else:
            client = smtplib.SMTP(self.host, self.port, timeout=30)
            if self.use_tls:
                client.starttls()
        if self.username:
            client.login(self.username, self.password)
        return client

    def send(self, message: dict[str, Any]) -> dict[str, Any]:
        if not message.get("to"):
            return {"outcome": "failed", "detail": "no recipient"}

        msg = self._build_mime(message)

        if not self.armed:
            # Disarmed: do everything EXCEPT transmit. Loud, safe, reversible.
            return {"outcome": "disarmed",
                    "detail": (f"SmtpTransport disarmed — would send to {message['to']} "
                               f"via {self.host}:{self.port}. Set {self._ARM_ENV}=1 or "
                               f"armed=True after a compliance review to transmit.")}

        import smtplib
        try:
            client = self._open()
            try:
                client.send_message(msg)
            finally:
                try:
                    client.quit()
                except Exception:               # noqa: BLE001
                    pass
            return {"outcome": "sent", "detail": "smtp ok"}
        except smtplib.SMTPRecipientsRefused as e:           # bad address(es)
            return {"outcome": "bounced", "detail": f"recipients refused: {e}"}
        except smtplib.SMTPResponseException as e:
            outcome = "bounced" if e.smtp_code in self._BOUNCE_CODES else "failed"
            return {"outcome": outcome, "detail": f"{e.smtp_code} {e.smtp_error}"}
        except Exception as e:                                # noqa: BLE001
            return {"outcome": "failed", "detail": str(e)}


# ---------------------------------------------------------------------------
# eligibility — the 7 gates, each returning a clear reason
# ---------------------------------------------------------------------------
def _recipient_email(prospect: "Prospect", draft: dict[str, Any]) -> Optional[str]:
    # explicit recipient on the draft wins; else a verified email contact channel
    to = draft.get("to") or draft.get("recipient")
    if to:
        return to
    if (prospect.contact_channel or "") == "email" and prospect.contact_name:
        # the actual address lives in your CRM; the skeleton expects draft['to'].
        return draft.get("to")
    return None


def check_sendable(prospect: "Prospect", draft: dict[str, Any], *,
                   suppression: SuppressionStore,
                   now: Optional[datetime] = None) -> tuple[bool, str, Optional[str]]:
    """
    Decide if THIS touch may go out now.
    Returns (ok, reason, recipient_email). ok=False means skip (reason says why).
    """
    now = now or _utcnow()
    channel = (draft.get("channel") or prospect.routed_channel or "").upper()

    # 1) human-sent channels are never auto-sent
    if channel in SEND_BY_HAND_CHANNELS or draft.get("send_by_hand"):
        return (False, f"send_by_hand ({channel}) — queued for a human to send", None)

    # 2) inbound-only
    if channel in INBOUND_ONLY_CHANNELS:
        return (False, "inbound-only channel (E) — nothing to send", None)

    if channel not in AUTO_SEND_CHANNELS:
        return (False, f"channel {channel or '∅'} not auto-sendable", None)

    # 3) approved + sendable (drafter cleared all blockers)
    if (draft.get("approval") or prospect.approval_status) != "approved":
        return (False, "not approved by a human yet", None)
    if not draft.get("sendable", False):
        return (False, f"draft not sendable (blockers: {draft.get('blockers') or '?'})", None)

    # 5) loop already closed?  (checked before cadence so a reply always wins)
    resp = getattr(prospect, "response_status", None) or draft.get("response_status")
    if resp in STOP_RESPONSE_STATES:
        return (False, f"sequence stopped — response_status={resp}", None)

    # recipient + 4) suppression
    recipient = _recipient_email(prospect, draft)
    if channel in AUTO_SEND_CHANNELS and not recipient:
        return (False, "no recipient email on draft", None)
    sup = suppression.is_suppressed(email=recipient, domain=prospect.primary_domain)
    if sup:
        return (False, f"suppressed ({sup}) — permanent, never contact", None)

    # 6) cadence cap
    touch_count = int(getattr(prospect, "touch_count", 0) or draft.get("touch_count", 0))
    if touch_count >= MAX_TOUCHES:
        return (False, f"cadence cap reached ({touch_count}/{MAX_TOUCHES}) — 60-day nurture", None)

    # 7) minimum spacing since last touch
    last = getattr(prospect, "last_touch_at", None) or draft.get("last_touch_at")
    if isinstance(last, str):
        try:
            last = datetime.fromisoformat(last)
        except ValueError:
            last = None
    if isinstance(last, datetime):
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if now - last < timedelta(days=MIN_DAYS_BETWEEN_TOUCHES):
            return (False, f"too soon — last touch {(now - last).days}d ago "
                           f"(< {MIN_DAYS_BETWEEN_TOUCHES}d)", None)

    return (True, "clear to send", recipient)


# ---------------------------------------------------------------------------
# build + send one touch
# ---------------------------------------------------------------------------
def build_message(prospect: "Prospect", draft: dict[str, Any],
                  recipient: str) -> dict[str, Any]:
    """Assemble the wire message. Opt-out line is appended if not already in the body."""
    body = draft.get("edited_body") or draft.get("body") or ""
    opt_out = draft.get("opt_out_line")
    if opt_out and opt_out not in body:
        body = f"{body}\n\n{opt_out}"
    return {
        "to": recipient,
        "subject": draft.get("subject") or "",
        "body": body,
        "channel": (draft.get("channel") or prospect.routed_channel or "").upper(),
    }


def send_touch(prospect: "Prospect", draft: dict[str, Any], *,
               transport: Optional[Transport] = None,
               suppression: Optional[SuppressionStore] = None,
               now: Optional[datetime] = None) -> dict[str, Any]:
    """
    Run the gates; if clear, send via the transport and return a `touches`-shaped
    record. If skipped, return {'outcome':'skipped','reason':...} and send nothing.
    Also mutates the prospect's cadence counters on a successful send so a caller
    can persist them (touch_count, last_touch_at, sent_at).
    """
    transport = transport or ConsoleTransport()
    suppression = suppression or SuppressionStore()
    now = now or _utcnow()

    ok, reason, recipient = check_sendable(prospect, draft, suppression=suppression, now=now)
    if not ok:
        return {"outcome": "skipped", "reason": reason,
                "company": getattr(prospect, "company_name", None),
                "channel": (draft.get("channel") or prospect.routed_channel)}

    message = build_message(prospect, draft, recipient)  # type: ignore[arg-type]
    result = transport.send(message)
    outcome = result.get("outcome", "failed")

    touch_number = int(getattr(prospect, "touch_count", 0) or 0) + 1
    if outcome == "sent":
        # update cadence state (caller persists to Supabase)
        try:
            prospect.touch_count = touch_number          # type: ignore[attr-defined]
            prospect.last_touch_at = now                 # type: ignore[attr-defined]
            prospect.sent_at = now                       # type: ignore[attr-defined]
        except Exception:                                # noqa: BLE001
            pass
    elif outcome == "bounced":
        # a hard bounce should suppress that address immediately
        if recipient:
            suppression.add_email(recipient)

    return {
        "outcome": outcome,
        "reason": result.get("detail", ""),
        "company": getattr(prospect, "company_name", None),
        "channel": message["channel"],
        "touch_number": touch_number if outcome == "sent" else None,
        "to": recipient,
        "sent_at": now.isoformat() if outcome == "sent" else None,
    }


def run_send_batch(items: list[tuple["Prospect", dict[str, Any]]], *,
                   transport: Optional[Transport] = None,
                   suppression: Optional[SuppressionStore] = None,
                   now: Optional[datetime] = None) -> list[dict[str, Any]]:
    """Process a batch of (prospect, draft) pairs. Returns one result per item."""
    transport = transport or ConsoleTransport()
    suppression = suppression or SuppressionStore()
    now = now or _utcnow()
    return [send_touch(p, d, transport=transport, suppression=suppression, now=now)
            for (p, d) in items]


if __name__ == "__main__":
    if Prospect is None:
        print("Run as a module:  python -m pipeline.send_worker")
        raise SystemExit(0)

    from datetime import date  # noqa: F401

    sup = SuppressionStore(emails={"optout@oldlead.com"}, domains={"donotcontact.com"})
    console = ConsoleTransport(verbose=True)

    # helper to fake an approved, sendable Channel-D draft
    def d_draft(**over: Any) -> dict[str, Any]:
        base = {"channel": "D", "subject": "A brand-impersonation finding",
                "body": "Hi — one verified finding about your domain. Free scan, no card.",
                "opt_out_line": "Prefer not to hear from us? Opt out: https://x/optout",
                "approval": "approved", "sendable": True, "blockers": [],
                "send_by_hand": False, "to": "owner@goodlead.com"}
        base.update(over)
        return base

    cases: list[tuple[str, "Prospect", dict[str, Any]]] = [
        ("D, clear → SENT",
         Prospect(company_name="GoodLead", primary_domain="goodlead.com",
                  routed_channel="D", contact_channel="email", contact_name="Pat",
                  approval_status="approved"),
         d_draft()),
        ("D, suppressed email → SKIP",
         Prospect(company_name="OldLead", primary_domain="oldlead.com",
                  routed_channel="D", contact_channel="email", approval_status="approved"),
         d_draft(to="optout@oldlead.com")),
        ("D, suppressed domain → SKIP",
         Prospect(company_name="Blocked", primary_domain="donotcontact.com",
                  routed_channel="D", contact_channel="email", approval_status="approved"),
         d_draft(to="ceo@donotcontact.com")),
        ("D, cadence cap 3/3 → SKIP",
         Prospect(company_name="Tapped", primary_domain="tapped.com", routed_channel="D",
                  contact_channel="email", approval_status="approved", touch_count=3),
         d_draft(to="hi@tapped.com")),
        ("D, replied already → SKIP",
         Prospect(company_name="Replied", primary_domain="replied.com", routed_channel="D",
                  contact_channel="email", approval_status="approved",
                  response_status="replied"),
         d_draft(to="hi@replied.com")),
        ("D, too soon since last touch → SKIP",
         Prospect(company_name="TooSoon", primary_domain="toosoon.com", routed_channel="D",
                  contact_channel="email", approval_status="approved", touch_count=1,
                  last_touch_at=_utcnow() - timedelta(days=1)),
         d_draft(to="hi@toosoon.com")),
        ("C, send-by-hand → SKIP (human sends)",
         Prospect(company_name="Maple Goods", primary_domain="maplegoods.com",
                  routed_channel="C", approval_status="approved"),
         d_draft(channel="C", send_by_hand=True, to=None)),
        ("D, not approved → SKIP",
         Prospect(company_name="Unapproved", primary_domain="unapproved.com",
                  routed_channel="D", contact_channel="email"),
         d_draft(approval="unreviewed", to="hi@unapproved.com")),
        ("E, inbound-only → SKIP",
         Prospect(company_name="Inbound", primary_domain="inbound.com", routed_channel="E"),
         d_draft(channel="E", to=None)),
    ]

    print("=" * 72)
    for label, p, d in cases:
        res = send_touch(p, d, transport=console, suppression=sup,
                         now=datetime(2026, 6, 19, tzinfo=timezone.utc))
        tag = res["outcome"].upper()
        print(f"{tag:8} | {label}")
        print(f"         └─ {res.get('reason')}")
    print("=" * 72)
    print(f"Transport actually transmitted: {len(console.sink)} message(s) "
          f"(dry-run — nothing left the machine).")

    # ----------------------------------------------------------------------
    # SmtpTransport demo — proves the disarmed/armed double-lock with NO socket.
    # A fake SMTP client records the message instead of opening a connection.
    # ----------------------------------------------------------------------
    print("\n" + "=" * 72)
    print("SmtpTransport double-lock check (fake server — nothing leaves the box)")

    class _FakeSMTP:
        outbox: list[Any] = []

        def __init__(self, host, port):
            self.host, self.port = host, port

        def send_message(self, msg):
            _FakeSMTP.outbox.append(msg)

        def quit(self):
            pass

    sample = {"to": "owner@goodlead.com", "subject": "A finding",
              "body": "one verified finding", "channel": "D"}

    disarmed = SmtpTransport("smtp.example.com", 587, "u", "p",
                             "outreach@brandguard.app",
                             smtp_factory=_FakeSMTP)          # armed defaults to env (unset → False)
    r1 = disarmed.send(sample)
    print(f"  disarmed → outcome={r1['outcome']!r}  fake outbox={len(_FakeSMTP.outbox)}")

    armed = SmtpTransport("smtp.example.com", 587, "u", "p",
                          "outreach@brandguard.app",
                          armed=True, smtp_factory=_FakeSMTP)  # explicit opt-in
    r2 = armed.send(sample)
    print(f"  armed    → outcome={r2['outcome']!r}  fake outbox={len(_FakeSMTP.outbox)}")
    if _FakeSMTP.outbox:
        m = _FakeSMTP.outbox[-1]
        print(f"           built MIME: To={m['To']!r} Subject={m['Subject']!r} "
              f"Message-ID set={bool(m['Message-ID'])}")

    ok = (r1["outcome"] == "disarmed" and len(_FakeSMTP.outbox) == 1
          and r2["outcome"] == "sent")
    print("  RESULT:", "PASS — disarmed sends nothing; armed builds + sends to fake only"
          if ok else "FAIL — double-lock not behaving as specified")
    print("=" * 72)
