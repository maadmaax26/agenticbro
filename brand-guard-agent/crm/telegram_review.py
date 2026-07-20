#!/usr/bin/env python3
"""
crm/telegram_review.py — Brand Guard draft review/approval over Telegram, native to
the OpenClaw brand-guard-agent. DB-direct (no Cowork bridge, no file queue).

It reuses the existing store:
    store.load_review_queue(limit)  -> unreviewed drafts (+ prospect + suppression flag)
    store.apply_approvals([...])    -> the ONLY place approval state changes

Approving a draft only flips approval='approved' in Supabase. The existing
gmail_draft_pusher.py (separate cron) turns approved emailable drafts into Gmail
DRAFTS. Nothing here ever sends mail.

Subcommands
    status                          counts of the review queue
    post [--limit N] [--dry-run]    post undelivered drafts to Telegram w/ Approve/Reject buttons
    decide <draft_id> <approve|reject> [--reason "..."] [--by <uid>]
    callback "bg:approve:ID" [fromId] [cbId] [chatId] [messageId]
    content-status                  counts of website-scan content candidates
    content-post [--limit N]        claim and post new X-ready drafts to the owner DM
    content-decide <id> <action>    approve, reject, or hold a content candidate

Config
    SUPABASE_URL + SUPABASE_SECRET_API_KEY  — from env or .env.outreach (BRANDGUARD_ENV_FILE)
    Telegram bot token + owner chat id      — from openclaw.json (channels.telegram) or
                                              BG_BOT_TOKEN / BG_CHAT_ID env overrides.

State (which draft_ids were already posted) lives in
    ~/.openclaw/brand-guard-queue/state.json   (shared with the old skill; harmless)
"""
from __future__ import annotations
import argparse, json, os, sys, urllib.request, urllib.parse
from pathlib import Path
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

OPENCLAW_HOME = Path(os.environ.get("OPENCLAW_HOME", Path.home() / ".openclaw"))
STATE_FILE = OPENCLAW_HOME / "brand-guard-queue" / "state.json"


# ---------------------------------------------------------------------------
# env + config
# ---------------------------------------------------------------------------
def _load_env_file():
    """Fill missing SUPABASE_/TELEGRAM_ vars from .env.outreach (dependency-free)."""
    candidates = []
    if os.environ.get("BRANDGUARD_ENV_FILE"):
        candidates.append(Path(os.environ["BRANDGUARD_ENV_FILE"]).expanduser())
    candidates += [ROOT / ".env.outreach", OPENCLAW_HOME / "workspace" / ".env.local",
                   Path.home() / "agenticbro" / ".env.local"]
    for p in candidates:
        try:
            if not p.is_file():
                continue
            for line in p.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v
        except Exception:
            pass


def _telegram_conf():
    tok = os.environ.get("BG_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN")
    chat = os.environ.get("BG_CHAT_ID")
    if not tok or not chat:
        try:
            cfg = json.loads((OPENCLAW_HOME / "openclaw.json").read_text())
            tg = (cfg.get("channels", {}) or {}).get("telegram", {}) or {}
            accts = tg.get("accounts", {}) or {}
            acct_id = tg.get("defaultAccount") or (next(iter(accts), None))
            acct = accts.get(acct_id, {}) if acct_id else {}
            tok = tok or acct.get("botToken")
            chat = chat or (acct.get("allowFrom") or tg.get("allowFrom") or [None])[0]
        except Exception:
            pass
    if not tok:
        raise SystemExit("No Telegram bot token (set BG_BOT_TOKEN or openclaw.json channels.telegram).")
    if not chat:
        raise SystemExit("No owner chat id (set BG_CHAT_ID or openclaw.json channels.telegram.allowFrom[0]).")
    return tok, str(chat)


def _tg(method, payload):
    tok, _ = _telegram_conf()
    data = json.dumps(payload).encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{tok}/{method}",
                                 data=data, headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        out = json.loads(r.read().decode())
    if not out.get("ok"):
        raise RuntimeError(f"Telegram {method}: {out.get('description')}")
    return out["result"]


# ---------------------------------------------------------------------------
# store + state
# ---------------------------------------------------------------------------
def _store():
    _load_env_file()
    from db.store import connect  # lazy — offline commands never import supabase
    return connect()


def _state():
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {"posted": {}, "decided": {}}


def _save_state(s):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(s, indent=1))


REGISTRAR_HINTS = ("abuse@", "domainabuse@", "webmaster@", "registrar@",
                   "@service.aliyun", "@godaddy.com", "@nameshield", "@key-systems",
                   "@web.com", "@safebrands", "@namecheap")


def _emailable(row):
    e = (row.get("contact_email") or "").lower()
    if not e or "@" not in e:
        return False
    return not any(h in e for h in REGISTRAR_HINTS)


def _card(row, idx, total):
    company = row.get("company_name") or row.get("primary_domain") or "?"
    email = row.get("contact_email")
    if row.get("suppressed"):
        contact = "🚫 SUPPRESSED — do not contact"
    elif _emailable(row):
        contact = f"✉️ {email} → Gmail draft on approve"
    elif row.get("contact_channel") == "contact_form" or not email:
        contact = "📝 web-form / no email — approve records it; send by hand"
    else:
        contact = f"⚠️ {email} — registrar/role address, not auto-emailable"
    body = row.get("edited_body") or row.get("body") or ""
    body = body[:600] + (" …" if len(body) > 600 else "")
    return "\n".join([
        f"*Brand Guard draft {idx}/{total}*  ·  score {row.get('victim_score','?')}  ·  ch {row.get('channel','?')}",
        f"*{company}*  _({row.get('vertical','?')})_",
        f"*Subj:* {row.get('subject','(no subject)')}",
        contact,
        "\n" + body,
    ])


def _kb(draft_id):
    return {"inline_keyboard": [[
        {"text": "✅ Approve", "callback_data": f"bg:approve:{draft_id}"},
        {"text": "❌ Reject", "callback_data": f"bg:reject:{draft_id}"},
        {"text": "⏭ Skip", "callback_data": f"bg:skip:{draft_id}"},
    ]]}


def _content_queue():
    _load_env_file()
    from crm.content_queue import connect_content_queue
    return connect_content_queue()


def _content_card(row, idx, total):
    summary = row.get("safe_summary") or {}
    platforms = ", ".join(summary.get("platforms") or []) or "monitored platforms"
    hashtags = " ".join(f"#{tag}" for tag in (row.get("draft_hashtags") or []))
    copy = row.get("draft_copy") or ""
    return "\n".join([
        f"Brand Guard X draft {idx}/{total}",
        f"Findings: {summary.get('total_findings', '?')} high-risk | Platforms: {platforms}",
        "",
        copy,
        "",
        hashtags,
        "",
        "Approval keeps this draft in the queue for manual X posting. Nothing is published automatically.",
    ])


def _content_kb(candidate_id):
    return {"inline_keyboard": [[
        {"text": "✅ Approve", "callback_data": f"bgc:approve:{candidate_id}"},
        {"text": "❌ Reject", "callback_data": f"bgc:reject:{candidate_id}"},
        {"text": "⏸ Hold", "callback_data": f"bgc:skip:{candidate_id}"},
    ]]}


# ---------------------------------------------------------------------------
# commands
# ---------------------------------------------------------------------------
def cmd_status(_):
    rows = _store().load_review_queue(200)
    live = [r for r in rows if not r.get("suppressed")]
    print(f"Review queue: {len(rows)} unreviewed ({len(live)} contactable, "
          f"{sum(1 for r in live if _emailable(r))} emailable, "
          f"{len(rows)-len(live)} suppressed).")


def cmd_post(args):
    _, chat = _telegram_conf()
    rows = _store().load_review_queue(200)
    st = _state()
    todo = [r for r in rows if r["draft_id"] not in st["posted"]
            and r["draft_id"] not in st["decided"] and not r.get("suppressed")]
    if not todo:
        print("Nothing new to post (all posted/decided, or only suppressed rows remain).")
        return
    batch = todo[: (args.limit if args.limit else 5)]
    for i, r in enumerate(batch, 1):
        text = _card(r, i, len(todo))
        if args.dry_run:
            print("---DRY---\n" + text + "\n[Approve/Reject/Skip]")
            continue
        msg = _tg("sendMessage", {"chat_id": chat, "text": text, "parse_mode": "Markdown",
                                  "reply_markup": _kb(r["draft_id"]), "disable_web_page_preview": True})
        st["posted"][r["draft_id"]] = msg["message_id"]
    if not args.dry_run:
        _save_state(st)
    rest = len(todo) - len(batch)
    print(f"Posted {len(batch)} card(s)." + (f" {rest} more — run `post --limit {rest}`." if rest else ""))


def cmd_content_status(_):
    counts = _content_queue().status_counts()
    ordered = ("new", "in_review", "approved", "held", "rejected", "posted")
    print("Content queue: " + ", ".join(f"{status}={counts.get(status, 0)}" for status in ordered))


def cmd_content_post(args):
    _, chat = _telegram_conf()
    queue = _content_queue()
    rows = queue.list_new(args.limit or 5)
    if not rows:
        print("No new content candidates.")
        return
    if args.dry_run:
        for i, row in enumerate(rows, 1):
            print("---DRY---\n" + _content_card(row, i, len(rows)) + "\n[Approve/Reject/Hold]")
        return

    posted = 0
    for i, row in enumerate(rows, 1):
        candidate_id = row["id"]
        if not queue.claim(candidate_id):
            continue
        telegram_message = None
        try:
            telegram_message = _tg("sendMessage", {
                "chat_id": chat,
                "text": _content_card(row, i, len(rows)),
                "reply_markup": _content_kb(candidate_id),
                "disable_web_page_preview": True,
            })
            queue.record_telegram_message(candidate_id, telegram_message["message_id"])
            posted += 1
        except Exception:
            # Release only when Telegram did not accept the message. If delivery
            # succeeded, leave the row claimed so a retry cannot post a duplicate.
            if telegram_message is None:
                queue.release_claim(candidate_id)
            raise
    print(f"Posted {posted} content review card(s).")


def cmd_content_decide(args):
    reviewer = args.by or "local-admin"
    status = _content_queue().decide(args.candidate_id, args.action, reviewer)
    print(f"Content candidate {args.candidate_id}: {status}. Nothing was published.")


def _apply(draft_id, decision, who, reason=None):
    store = _store()
    dec = {"draft_id": draft_id, "decision": decision}
    if reason:
        dec["reason"] = reason
    log = store.apply_approvals([dec], approved_by=who or "telegram")
    st = _state(); st["decided"][draft_id] = decision; _save_state(st)
    return log


def cmd_decide(args):
    if args.action == "skip":
        st = _state(); st["decided"][args.draft_id] = "skip"; _save_state(st)
        print(f"Skipped {args.draft_id} (left unreviewed).")
        return
    log = _apply(args.draft_id, args.action, args.by, args.reason)
    print(f"{args.action.title()} applied: {', '.join(log)}")
    if args.action == "approve":
        print("→ Approved in Supabase. gmail_draft_pusher will create the Gmail draft on its next run (emailable A/C).")


def cmd_callback(args):
    import re
    content_match = re.match(r"^bgc:(approve|reject|skip):(.+)$", args.data or "")
    m = re.match(r"^bg:(approve|reject|skip):(.+)$", args.data or "")
    if content_match:
        action, candidate_id = content_match.group(1), content_match.group(2)
        _, owner = _telegram_conf()
        if args.from_id and str(args.from_id) != str(owner):
            if args.cb_id:
                try: _tg("answerCallbackQuery", {"callback_query_id": args.cb_id, "text": "Not authorized."})
                except Exception: pass
            print(f"Ignored callback from non-owner {args.from_id}.")
            return
        status = _content_queue().decide(candidate_id, action, args.from_id or "telegram-owner")
        human = {
            "approved": "✅ Approved for manual X posting. Nothing was published.",
            "rejected": "❌ Content draft rejected.",
            "held": "⏸ Content draft placed on hold.",
        }[status]
        if args.cb_id:
            try: _tg("answerCallbackQuery", {"callback_query_id": args.cb_id, "text": human})
            except Exception: pass
        if args.chat_id and args.message_id:
            try: _tg("editMessageText", {
                "chat_id": args.chat_id,
                "message_id": int(args.message_id),
                "text": human,
                "disable_web_page_preview": True,
            })
            except Exception: pass
        print(human)
        return
    if not m:
        print("Not a Brand Guard callback; ignoring.")
        return
    action, draft_id = m.group(1), m.group(2)
    _, owner = _telegram_conf()
    if args.from_id and str(args.from_id) != str(owner):
        if args.cb_id:
            try: _tg("answerCallbackQuery", {"callback_query_id": args.cb_id, "text": "Not authorized."})
            except Exception: pass
        print(f"Ignored callback from non-owner {args.from_id}.")
        return
    if action == "skip":
        st = _state(); st["decided"][draft_id] = "skip"; _save_state(st)
        human = "⏭ Skipped — left unreviewed."
    else:
        _apply(draft_id, action, args.from_id)
        human = ("✅ Approved — Gmail draft will be created by the pusher shortly."
                 if action == "approve" else "❌ Rejected in Supabase.")
    if args.cb_id:
        try: _tg("answerCallbackQuery", {"callback_query_id": args.cb_id,
                 "text": {"approve": "Approved ✅", "reject": "Rejected ❌", "skip": "Skipped ⏭"}[action]})
        except Exception: pass
    if args.chat_id and args.message_id:
        try: _tg("editMessageText", {"chat_id": args.chat_id, "message_id": int(args.message_id),
                 "text": human, "parse_mode": "Markdown", "disable_web_page_preview": True})
        except Exception: pass
    print(human)


def main():
    ap = argparse.ArgumentParser(prog="telegram_review")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    p = sub.add_parser("post"); p.add_argument("--limit", type=int, default=0); p.add_argument("--dry-run", action="store_true")
    d = sub.add_parser("decide"); d.add_argument("draft_id"); d.add_argument("action", choices=["approve", "reject", "skip"]); d.add_argument("--reason"); d.add_argument("--by")
    c = sub.add_parser("callback"); c.add_argument("data"); c.add_argument("from_id", nargs="?"); c.add_argument("cb_id", nargs="?"); c.add_argument("chat_id", nargs="?"); c.add_argument("message_id", nargs="?")
    sub.add_parser("content-status")
    cp = sub.add_parser("content-post"); cp.add_argument("--limit", type=int, default=5); cp.add_argument("--dry-run", action="store_true")
    cd = sub.add_parser("content-decide"); cd.add_argument("candidate_id"); cd.add_argument("action", choices=["approve", "reject", "skip"]); cd.add_argument("--by")
    a = ap.parse_args()
    try:
        {
            "status": cmd_status,
            "post": cmd_post,
            "decide": cmd_decide,
            "callback": cmd_callback,
            "content-status": cmd_content_status,
            "content-post": cmd_content_post,
            "content-decide": cmd_content_decide,
        }[a.cmd](a)
    except SystemExit:
        raise
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr); sys.exit(1)


if __name__ == "__main__":
    main()
