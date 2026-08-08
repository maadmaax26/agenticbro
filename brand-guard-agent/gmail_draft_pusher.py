#!/usr/bin/env python3
"""
Gmail Draft Pusher — pushes approved A/C outreach drafts into Gmail Drafts folder.

NEVER SENDS. Only creates drafts via users.drafts.create.
Reads approved Channel A and C drafts from the outreach DB,
creates Gmail drafts, and records the draft ID back to the DB.

Run as a cron job every 30 minutes.
"""
import json
import base64
import requests
from pathlib import Path
from datetime import datetime, timezone

# ── Config ──────────────────────────────────────────────────────────────────
CREDENTIALS_DIR = Path("/Users/efinney/.openclaw/workspace/credentials")
TOKEN_FILE = CREDENTIALS_DIR / "gmail_token.json"
CLIENT_FILE = CREDENTIALS_DIR / "gmail_oauth_client.json"

# Outreach DB
ENV_FILE = Path("/Users/efinney/.openclaw/workspace/brand-guard-agent/.env.outreach")
OUTREACH_URL = "https://tkuqlqzhramryxsmlxge.supabase.co"
OUTREACH_KEY = None

GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"
GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token"


def load_outreach_key():
    global OUTREACH_KEY
    for line in ENV_FILE.read_text().splitlines():
        if "SUPABASE_SECRET_API_KEY=" in line and "sb_sec" in line:
            OUTREACH_KEY = line.split("=", 1)[1].strip()
            return
    raise RuntimeError("Could not find outreach DB key in .env.outreach")


def refresh_gmail_token():
    """Refresh the Gmail OAuth token if expired."""
    with open(TOKEN_FILE) as f:
        token = json.load(f)
    with open(CLIENT_FILE) as f:
        client = json.load(f)["installed"]

    # Check if token is still valid
    from datetime import datetime
    expiry = token.get("expiry", "")
    if expiry:
        exp_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
        now = datetime.now(exp_dt.tzinfo)
        if now < exp_dt and token.get("token"):
            return token["token"]

    # Refresh
    resp = requests.post(GMAIL_TOKEN_URL, data={
        "client_id": client["client_id"],
        "client_secret": client["client_secret"],
        "refresh_token": token["refresh_token"],
        "grant_type": "refresh_token",
    })
    if resp.status_code != 200:
        raise RuntimeError(f"Token refresh failed: {resp.text[:200]}")

    token["token"] = resp.json()["access_token"]
    token["expiry"] = datetime.now(timezone.utc).isoformat()
    with open(TOKEN_FILE, "w") as f:
        json.dump(token, f, indent=2)

    return token["token"]


def _body_to_html(body):
    """Turn the plain-text body into safe HTML with real <a> anchors, so Gmail's
    auto-linker never mangles trailing URLs or swallows the footer separator."""
    import html as _html, re as _re
    url_re = _re.compile(r"(https?://[^\s<>()]+)")
    email_re = _re.compile(r"([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})")
    out_lines = []
    for line in body.split("\n"):
        esc = _html.escape(line)
        esc = url_re.sub(lambda m: f'<a href="{m.group(1)}">{m.group(1).replace("https://","").replace("http://","")}</a>', esc)
        esc = email_re.sub(lambda m: m.group(1) if "href=" in esc[:m.start()] else f'<a href="mailto:{m.group(1)}">{m.group(1)}</a>', esc)
        out_lines.append(esc if esc.strip() else "")
    inner = "<br>\n".join(out_lines)
    return (f'<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;'
            f'color:#222;line-height:1.5">{inner}</div>')


def create_gmail_draft(access_token, to_email, subject, body):
    """Create a Gmail draft (NEVER sends). Returns draft ID or None.

    Sends multipart/alternative: a text/plain part plus a text/html part with real
    anchors, so links render cleanly in Gmail instead of being auto-linkified
    (which was wrapping URLs in google.com/url redirects and swallowing the footer)."""
    html_body = _body_to_html(body)
    boundary = "bg_alt_boundary_2026"
    raw_email = (
        f"From: efinney@brandguardhq.com\r\n"
        f"To: {to_email}\r\n"
        f"Subject: {subject}\r\n"
        f"MIME-Version: 1.0\r\n"
        f'Content-Type: multipart/alternative; boundary="{boundary}"\r\n'
        f"\r\n"
        f"--{boundary}\r\n"
        f"Content-Type: text/plain; charset=utf-8\r\n"
        f"\r\n"
        f"{body}\r\n"
        f"\r\n"
        f"--{boundary}\r\n"
        f"Content-Type: text/html; charset=utf-8\r\n"
        f"\r\n"
        f"{html_body}\r\n"
        f"\r\n"
        f"--{boundary}--\r\n"
    )
    encoded = base64.urlsafe_b64encode(raw_email.encode("utf-8")).decode("utf-8")

    resp = requests.post(
        f"{GMAIL_API}/drafts",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={"message": {"raw": encoded}},
    )
    if resp.status_code == 200:
        return resp.json().get("id")
    else:
        print(f"  Draft creation failed: {resp.status_code} {resp.text[:200]}")
        return None


def verify_email_before_draft(email, domain):
    """Quick SMTP check before creating a Gmail draft. Returns (confidence, detail)."""
    import subprocess
    try:
        result = subprocess.run(
            ["python3", "/Users/efinney/.openclaw/workspace/brand-guard-agent/discover_contacts.py",
             "--domain", domain, "--company", domain, "--json", "--max-checks", "3"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            import json
            data = json.loads(result.stdout)
            # Check if the specific email is in the candidates
            for c in data.get("candidates", []):
                if c["email"].lower() == email.lower():
                    return c["confidence"], f"{c['smtp_status']} ({c['smtp_detail']})"
            # If not in candidates, at least check MX
            if data.get("mx_found"):
                return "MEDIUM", "email_not_in_candidates_but_mx_exists"
        return "LOW", "verification_failed"
    except Exception as e:
        return "MEDIUM", f"verification_error: {e}"


def main():
    load_outreach_key()
    headers = {
        "apikey": OUTREACH_KEY,
        "Authorization": f"Bearer {OUTREACH_KEY}",
        "Content-Type": "application/json",
    }

    # 1. Get approved emailable drafts (A/B/C/D) that haven't been pushed to Gmail yet.
    # Widened from A/C to include B (on-domain intake) and D (compliant cold email) so
    # approved emailable drafts don't fall through a channel gap. Rows without a
    # contact_email, or that fail verification below, are skipped — so LinkedIn-only
    # (C) and any address the router's contact-quality gate didn't catch are safe.
    # Dedup marker lives in findings_used.gmail_draft_id (no dedicated column).
    resp = requests.get(
        f"{OUTREACH_URL}/rest/v1/outreach_drafts?select=id,prospect_id,channel,subject,body,approval,findings_used,prospects(contact_email,company_name,primary_domain)&approval=eq.approved&channel=in.(A,B,C,D)&order=approved_at.desc",
        headers=headers,
    )
    if resp.status_code != 200:
        print(f"Failed to fetch approved drafts: {resp.status_code} {resp.text[:200]}")
        return

    drafts = resp.json()
    # Filter out ones already pushed (check findings_used for gmail_draft_id)
    pending = []
    for d in drafts:
        fu = d.get("findings_used") or {}
        if not fu.get("gmail_draft_id"):
            prospect = d.get("prospects") or {}
            to_email = prospect.get("contact_email")
            if to_email:
                pending.append(d)
            else:
                print(f"  Skip {d['id'][:8]}... — no contact email")

    if not pending:
        print("No approved drafts pending Gmail push.")
        return

    print(f"Found {len(pending)} approved drafts to push to Gmail")

    # 2. Refresh Gmail token
    try:
        access_token = refresh_gmail_token()
    except Exception as e:
        print(f"Gmail token refresh failed: {e}")
        return

    # 3. Create Gmail draft for each (with email verification)
    pushed = 0
    skipped = 0
    for d in pending:
        prospect = d.get("prospects") or {}
        to_email = prospect["contact_email"]
        domain = prospect.get("primary_domain", to_email.split("@")[-1] if "@" in to_email else "")
        subject = d.get("subject") or "Brand Guard outreach"
        body = d.get("body") or ""
        company = prospect.get("company_name", "?")

        # Verify the email before creating the draft
        confidence, verify_detail = verify_email_before_draft(to_email, domain)
        if confidence == "LOW":
            print(f"  SKIP {company[:25]:25} → {to_email} (LOW confidence: {verify_detail})")
            # Mark as skipped in findings_used
            fu = d.get("findings_used") or {}
            fu["verification_skipped"] = {"email": to_email, "confidence": confidence, "detail": verify_detail, "skipped_at": datetime.now(timezone.utc).isoformat()}
            requests.patch(
                f"{OUTREACH_URL}/rest/v1/outreach_drafts?id=eq.{d['id']}",
                headers=headers,
                json={"findings_used": fu},
            )
            skipped += 1
            continue

        draft_id = create_gmail_draft(access_token, to_email, subject, body)
        if draft_id:
            # Mark as pushed by updating findings_used with gmail_draft_id
            fu = d.get("findings_used") or {}
            fu["gmail_draft_id"] = draft_id
            fu["gmail_drafted_at"] = datetime.now(timezone.utc).isoformat()

            requests.patch(
                f"{OUTREACH_URL}/rest/v1/outreach_drafts?id=eq.{d['id']}",
                headers=headers,
                json={"findings_used": fu},
            )
            print(f"  OK {company[:25]:25} → {to_email} (draft: {draft_id[:12]}...)")
            pushed += 1
        else:
            print(f"  FAIL {company[:25]:25} → {to_email}")

    print(f"\nPushed {pushed}/{len(pending)} drafts to Gmail (efinney@brandguardhq.com Drafts)")
    if skipped:
        print(f"Skipped {skipped} drafts (email verification failed — LOW confidence)")


if __name__ == "__main__":
    main()