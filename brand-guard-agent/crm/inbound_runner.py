#!/usr/bin/env python3
"""
crm/inbound_runner.py — Channel-E reply/bounce tracker, native to OpenClaw.

Consolidates what the Cowork `brand-guard-reply-tracker` did into the pipeline:
reads the efinney@brandguardhq.com inbox (reusing gmail_draft_pusher's OAuth token),
classifies each inbound message with pipeline.inbound.process_inbound (deterministic
opt-out detection + best-effort sentiment), and records results to the LOCAL outreach
store (JSON under workspace/data): opt-outs/bounces are appended to contacted-companies.json
(which the drafter's suppression index reads → never re-contacted), and every reply is
logged to inbound-replies.json. The outreach DB is local now, not Supabase.

NEVER sends or replies. Read + classify + bookkeep only.

Dedup: processed Gmail message IDs are remembered in
    ~/.openclaw/brand-guard-queue/inbound_state.json

Usage:
    python3 crm/inbound_runner.py                 # last 2 days, live
    python3 crm/inbound_runner.py --days 3
    python3 crm/inbound_runner.py --dry-run       # classify + print, persist nothing
"""
from __future__ import annotations
import argparse, json, os, re, sys, base64, subprocess
from pathlib import Path
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import requests
from pipeline.inbound import InboundEvent, process_inbound

OPENCLAW_HOME = Path(os.environ.get("OPENCLAW_HOME", Path.home() / ".openclaw"))
STATE_FILE = OPENCLAW_HOME / "brand-guard-queue" / "inbound_state.json"
GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"
SELF = "efinney@brandguardhq.com"
BOUNCE_SENDERS = ("mailer-daemon@googlemail.com", "mailer-daemon@google.com", "postmaster@")

# ---------------------------------------------------------------------------
# LOCAL outreach store (JSON files under workspace/data) — the outreach DB was
# moved off Supabase. Opt-outs/bounces go into contacted-companies.json (which the
# drafter's suppression index reads → future drafts to them are blocked); every
# inbound reply is logged to inbound-replies.json.
# ---------------------------------------------------------------------------
DATA_DIR = Path(os.environ.get("BG_DATA_DIR", "/Users/efinney/.openclaw/workspace/data"))
CONTACTED_FILE = DATA_DIR / "contacted-companies.json"
REPLIES_FILE = DATA_DIR / "inbound-replies.json"


def _read_json(p, default):
    try:
        return json.loads(Path(p).read_text())
    except Exception:
        return default


def _lookup_company(email, domain):
    """Find the company name for a reply by matching the local contacted ledger."""
    led = _read_json(CONTACTED_FILE, {"contacted": []}).get("contacted", [])
    e = (email or "").lower()
    d = (domain or "").lower().lstrip("www.")
    for r in led:
        if (r.get("email") or "").lower() == e:
            return r.get("company")
    for r in led:
        re_ = (r.get("email") or "").lower()
        if d and "@" in re_ and re_.split("@", 1)[1].lstrip("www.") == d:
            return r.get("company")
    return None


def _suppress_local(company, email, status):
    """Append a suppression record to contacted-companies.json (idempotent by email+status)."""
    led = _read_json(CONTACTED_FILE, {"description": "Unified contact tracking", "contacted": []})
    rows = led.setdefault("contacted", [])
    key = ((email or "").lower(), status)
    if any(((r.get("email") or "").lower(), r.get("status")) == key for r in rows):
        return False
    rows.append({"company": company or (email or "").split("@")[-1], "email": email,
                 "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                 "source": "inbound-tracker", "status": status})
    led["total"] = len(rows)
    led["last_updated"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    CONTACTED_FILE.write_text(json.dumps(led, ensure_ascii=False, indent=2))
    return True


def _log_reply(rec):
    log = _read_json(REPLIES_FILE, {"replies": []})
    log.setdefault("replies", []).append(rec)
    log["last_updated"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    REPLIES_FILE.write_text(json.dumps(log, ensure_ascii=False, indent=2))


def _load_state():
    try:
        return set(json.loads(STATE_FILE.read_text()).get("processed", []))
    except Exception:
        return set()


def _save_state(ids):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    keep = sorted(ids)[-4000:]  # cap growth
    STATE_FILE.write_text(json.dumps({"processed": keep}, indent=1))


def _gmail_token():
    # Reuse the pusher's refresh logic + credential files (single Gmail auth for the whole agent).
    from gmail_draft_pusher import refresh_gmail_token
    return refresh_gmail_token()


def _hdr(headers, name):
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


def _addr(raw):
    m = re.search(r"[\w.+-]+@[\w.-]+", raw or "")
    return m.group(0).lower() if m else ""


def _domain(email):
    return email.split("@", 1)[1].lower() if email and "@" in email else ""


def fetch_messages(token, days):
    hdrs = {"Authorization": f"Bearer {token}"}
    q = f"newer_than:{days}d -from:{SELF}"
    r = requests.get(f"{GMAIL_API}/messages", headers=hdrs,
                     params={"q": q, "maxResults": 50})
    r.raise_for_status()
    out = []
    for m in (r.json().get("messages") or []):
        md = requests.get(f"{GMAIL_API}/messages/{m['id']}", headers=hdrs,
                          params={"format": "metadata",
                                  "metadataHeaders": ["From", "To", "Subject"]})
        if md.status_code != 200:
            continue
        j = md.json()
        h = j.get("payload", {}).get("headers", [])
        out.append({"id": m["id"], "from": _hdr(h, "From"), "to": _hdr(h, "To"),
                    "subject": _hdr(h, "Subject"), "snippet": j.get("snippet", "")})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=2)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-fit-check", action="store_true",
                    help="don't auto-prepare Fit-Check Brief drafts for positive replies")
    a = ap.parse_args()

    try:
        token = _gmail_token()
    except Exception as e:
        print(f"[inbound] Gmail token refresh failed: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        msgs = fetch_messages(token, a.days)
    except Exception as e:
        print(f"[inbound] Gmail fetch failed: {e}", file=sys.stderr)
        sys.exit(1)

    processed = _load_state()
    fresh = [m for m in msgs if m["id"] not in processed]
    if not fresh:
        print("[inbound] 0 new inbound messages.")
        return

    # Build events + collect bounces
    events, bounces, touched = [], [], []
    for m in fresh:
        sender = _addr(m["from"])
        is_bounce = any(b in (m["from"] or "").lower() for b in BOUNCE_SENDERS)
        if is_bounce:
            # the failed recipient is usually in the To of the original / in the snippet
            failed = _addr(m["snippet"]) or _addr(m["to"])
            if failed and failed != SELF:
                bounces.append(failed)
            continue
        if sender and sender != SELF:
            events.append(InboundEvent(kind="reply", source="email", from_address=sender,
                                       from_domain=_domain(sender), prospect_domain=_domain(sender),
                                       body=m["snippet"] or "", received_at=datetime.now(timezone.utc)))
            touched.append(sender)

    opt_outs = replies = suppressed = 0
    signups = []

    if a.dry_run:
        for r in process_inbound(events, use_llm=False):
            acts = ", ".join(x.get("action", "?") for x in r.get("actions", []))
            print(f"[dry] {r.get('type')} [{r.get('sentiment','?')}] → {acts}")
        for b in bounces:
            print(f"[dry] bounce → suppress {b}")
        print(f"[inbound:dry] would process {len(events)} replies, {len(bounces)} bounces.")
        return

    if events:
        results = process_inbound(events, use_llm=False)
        for ev, r in zip(events, results):
            if r.get("type") != "reply":
                continue
            company = _lookup_company(ev.from_address, ev.from_domain)
            acts = [x.get("action") for x in r.get("actions", [])]
            is_optout = "suppress" in acts
            _log_reply({
                "from": ev.from_address, "domain": ev.from_domain, "company": company,
                "sentiment": r.get("sentiment"), "opt_out": is_optout,
                "snippet": (ev.body or "")[:400],
                "received_at": ev.received_at.isoformat() if hasattr(ev.received_at, "isoformat") else str(ev.received_at),
                "logged_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            })
            if is_optout:
                _suppress_local(company, ev.from_address, "opted_out")
                opt_outs += 1
            replies += 1
            if r.get("sentiment") == "positive":
                signups.append((ev, r))

    for b in bounces:
        try:
            if _suppress_local(_lookup_company(b, b.split("@")[-1] if "@" in b else ""), b, "bounced"):
                suppressed += 1
        except Exception as e:
            print(f"[inbound] suppress {b} failed: {e}", file=sys.stderr)

    # For each positive reply, prepare a Fit-Check Brief as a Gmail DRAFT (review-only,
    # never sends) so a "yes" turns into proof-in-hand the moment Earl opens Gmail.
    briefs = []
    if not a.no_fit_check:
        for ev, _r in signups:
            to = ev.from_address
            dom = ev.from_domain or _domain(to)
            if not to or not dom:
                continue
            try:
                subprocess.run(
                    [sys.executable, str(HERE / "fit_check.py"),
                     "--domain", dom, "--to", to, "--gmail-draft", "--format", "text"],
                    cwd=str(ROOT), timeout=120,
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                briefs.append(to)
            except Exception as e:
                print(f"[inbound] fit-check brief for {to} failed: {e}", file=sys.stderr)

    processed.update(m["id"] for m in fresh)
    _save_state(processed)

    print(f"[inbound] {len(fresh)} new: {replies} replies ({opt_outs} opt-outs), "
          f"{len(bounces)} bounces suppressed.")
    if signups:
        who = ", ".join(ev.from_address for ev, _ in signups)
        print(f"[inbound] ⭐ {len(signups)} POSITIVE repl{'y' if len(signups)==1 else 'ies'} "
              f"({who}) — possible pilot interest.")
        if briefs:
            print(f"[inbound] 📄 Fit-Check Brief draft prepared in Gmail for: {', '.join(briefs)} "
                  f"— review and send.")


if __name__ == "__main__":
    main()
