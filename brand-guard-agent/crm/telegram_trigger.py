#!/usr/bin/env python3
"""
crm/telegram_trigger.py — Brand Guard outreach pipeline trigger from Telegram.

Lets Madmax trigger the full discovery → review-queue pipeline and the review
workflow directly from any Telegram DM session with the bot.

Subcommands:
    run [--days N] [--max-cases N]   Run the worker (live, fills review queue)
    status                           Show review queue counts
    post [--limit N]                  Post unreviewed drafts to Telegram for review
    approve <draft_id>               Approve a draft
    reject <draft_id> [--reason]     Reject a draft
    push                              Push approved drafts to Gmail Drafts folder

Usage from OpenClaw agent turn:
    python3 crm/telegram_trigger.py run --days 30 --max-cases 25
    python3 crm/telegram_trigger.py status
    python3 crm/telegram_trigger.py post --limit 5
    python3 crm/telegram_trigger.py approve abc123
    python3 crm/telegram_trigger.py push

Never sends mail. Only fills queue, posts for review, and creates Gmail drafts.
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys
from pathlib import Path
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

ENV_FILE = ROOT / ".env.outreach"
# Fallback env file with Supabase creds (used by the cron job too)
FALLBACK_ENV = Path.home() / "agenticbro" / ".env.local"
WORKER = ROOT / "worker.py"
GMAIL_PUSHER = ROOT / "gmail_draft_pusher.py"
REVIEW_SCRIPT = HERE / "telegram_review.py"


def _load_env():
    """Load env vars from .env.outreach then fallback .env.local.
    Also injects the real Telegram bot token from macOS Keychain if the env
    file only has a placeholder path."""
    # First try .env.outreach (has outreach DB creds)
    for env_path in [ENV_FILE, FALLBACK_ENV]:
        if not env_path.is_file():
            continue
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v

    # If TELEGRAM_BOT_TOKEN is missing or looks like a placeholder, get from Keychain
    tok = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not tok or len(tok) < 40 or "PLACEHOLDER" in tok or tok.startswith("/"):
        try:
            import subprocess
            real_tok = subprocess.run(
                ["security", "find-generic-password", "-s", "telegram_bot_token", "-a", "agenticbro", "-w"],
                capture_output=True, text=True, check=True
            ).stdout.strip()
            if real_tok and len(real_tok) > 40:
                os.environ["TELEGRAM_BOT_TOKEN"] = real_tok
                os.environ["BG_BOT_TOKEN"] = real_tok
        except Exception:
            pass

    # Also ensure BG_CHAT_ID is set for the review script
    if not os.environ.get("BG_CHAT_ID"):
        os.environ["BG_CHAT_ID"] = "2122311885"


def _run_worker(days: int, max_cases: int, use_llm: bool) -> dict:
    """Run the discovery → review-queue populator (live mode)."""
    cmd = [
        sys.executable, str(WORKER),
        "--live",
        "--days", str(days),
        "--max-cases", str(max_cases),
    ]
    if use_llm:
        cmd.append("--use-llm")

    # Use the env file that has Supabase creds
    env_file = str(FALLBACK_ENV) if FALLBACK_ENV.is_file() else str(ENV_FILE)

    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=600,
        cwd=str(ROOT),
        env={**os.environ, "BRANDGUARD_ENV_FILE": env_file},
    )

    return {
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def _run_review(subcommand: str, extra_args: list[str]) -> dict:
    """Run the telegram_review.py subcommand."""
    cmd = [sys.executable, str(REVIEW_SCRIPT)] + [subcommand] + extra_args
    env_file = str(FALLBACK_ENV) if FALLBACK_ENV.is_file() else str(ENV_FILE)
    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=120,
        cwd=str(ROOT),
        env={**os.environ, "BRANDGUARD_ENV_FILE": env_file},
    )
    return {
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }

def _review_direct(draft_id: str, decision: str, reason: str = "") -> dict:
    """Apply approve/reject directly via store (avoids UUID issue with approved_by)."""
    import importlib
    sys.path.insert(0, str(ROOT))
    from db.store import connect
    store = connect()
    dec = {"draft_id": draft_id, "decision": decision}
    if reason:
        dec["reason"] = reason
    log = store.apply_approvals([dec], approved_by=None)
    return {"result": log, "exit_code": 0}


def _run_gmail_push() -> dict:
    """Push approved drafts to Gmail Drafts folder."""
    cmd = [sys.executable, str(GMAIL_PUSHER)]
    env_file = str(FALLBACK_ENV) if FALLBACK_ENV.is_file() else str(ENV_FILE)
    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=120,
        cwd=str(ROOT),
        env={**os.environ, "BRANDGUARD_ENV_FILE": env_file},
    )
    return {
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def _parse_worker_summary(stdout: str) -> dict:
    """Extract key metrics from worker output."""
    summary = {}
    for line in stdout.splitlines():
        if "collected:" in line:
            summary["signals_collected"] = line.split("collected:")[-1].strip()
        elif "resolved=" in line and "queued" in line:
            parts = line.strip().split()
            for p in parts:
                if "=" in p:
                    k, v = p.split("=", 1)
                    summary[k] = v
    return summary


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Brand Guard outreach pipeline trigger — run from Telegram.")
    sub = ap.add_subparsers(dest="command", required=True)

    # run: full discovery → queue pipeline
    run_cmd = sub.add_parser("run", help="Run discovery → score → route → draft → queue (live)")
    run_cmd.add_argument("--days", type=int, default=30, help="UDRP lookback days (default 30)")
    run_cmd.add_argument("--max-cases", type=int, default=25, help="Max cases (default 25)")
    run_cmd.add_argument("--use-llm", action="store_true", help="Use local LLM for draft polish")

    # status: review queue counts
    sub.add_parser("status", help="Show review queue counts")

    # post: post unreviewed drafts to Telegram
    post_cmd = sub.add_parser("post", help="Post unreviewed drafts to Telegram for review")
    post_cmd.add_argument("--limit", type=int, default=5, help="Max drafts to post (default 5)")

    # approve: approve a draft
    approve_cmd = sub.add_parser("approve", help="Approve a draft by ID")
    approve_cmd.add_argument("draft_id", help="Draft ID to approve")

    # reject: reject a draft
    reject_cmd = sub.add_parser("reject", help="Reject a draft by ID")
    reject_cmd.add_argument("draft_id", help="Draft ID to reject")
    reject_cmd.add_argument("--reason", default="", help="Rejection reason")

    # push: push approved drafts to Gmail
    sub.add_parser("push", help="Push approved drafts to Gmail Drafts folder")

    args = ap.parse_args()
    _load_env()

    if args.command == "run":
        result = _run_worker(args.days, args.max_cases, args.use_llm)
        summary = _parse_worker_summary(result["stdout"])

        # Print clean summary for the agent
        queued = summary.get("queued", "?")
        resolved = summary.get("resolved", "?")
        collected = summary.get("signals_collected", "?")
        below = summary.get("below_threshold", "0")
        stopped = summary.get("stopped", "0")

        if result["exit_code"] == 0:
            print(f"✅ Pipeline complete — signals: {collected} | resolved: {resolved} | queued (unreviewed): {queued} | below threshold: {below} | stopped: {stopped}")
            if queued != "0" and queued != "?":
                print(f"📋 {queued} new drafts waiting for review. Run 'post' to review them in Telegram, or open agenticbro.app/brand-guard/admin")
            else:
                print("No new drafts queued — all prospects were below threshold or already contacted.")
        else:
            print(f"❌ Pipeline failed (exit {result['exit_code']})")
            if result["stderr"]:
                print(f"Error: {result['stderr'][:500]}")
        return result["exit_code"]

    elif args.command == "status":
        result = _run_review("status", [])
        print(result["stdout"].strip())
        if result["stderr"] and result["exit_code"] != 0:
            print(f"Error: {result['stderr'][:300]}")
        return result["exit_code"]

    elif args.command == "post":
        result = _run_review("post", ["--limit", str(args.limit)])
        print(result["stdout"].strip())
        if result["stderr"] and result["exit_code"] != 0:
            print(f"Error: {result['stderr'][:300]}")
        return result["exit_code"]

    elif args.command == "approve":
        result = _review_direct(args.draft_id, "approve")
        print(f"✅ Approved: {result['result']}")
        print("→ Gmail draft will be created on next push run")
        return 0

    elif args.command == "reject":
        result = _review_direct(args.draft_id, "reject", args.reason)
        print(f"❌ Rejected: {result['result']}")
        return 0

    elif args.command == "push":
        result = _run_gmail_push()
        if result["exit_code"] == 0:
            print(f"✅ Approved drafts pushed to Gmail Drafts folder")
            print(result["stdout"][:500])
        else:
            print(f"❌ Gmail push failed (exit {result['exit_code']})")
            print(result["stderr"][:500])
        return result["exit_code"]

    return 0


if __name__ == "__main__":
    raise SystemExit(main())