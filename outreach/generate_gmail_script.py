#!/usr/bin/env python3
"""
Generate a ready-to-run create_gmail_drafts.py with credentials from Keychain.
"""

import subprocess

def get_from_keychain(service, account):
    result = subprocess.run(
        ["security", "find-generic-password", "-s", service, "-a", account, "-w"],
        capture_output=True, text=True, check=True
    )
    return result.stdout.strip()

def main():
    print("🔑 Retrieving credentials from Keychain...")
    
    client_secret = get_from_keychain("google_web_client_secret", "efinney@brandguardhq.com")
    refresh_token = get_from_keychain("google_refresh_token", "efinney@brandguardhq.com")
    
    script = f'''#!/usr/bin/env python3
import json
import base64
import subprocess
from email.mime.text import MIMEText
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

SENDER_EMAIL = "efinney@brandguardhq.com"
SCOPES = ["https://www.googleapis.com/auth/gmail.compose"]
CLIENT_ID = "370046134085-gbahfngbucg1fgr8d4n20c087k67ffmp.apps.googleusercontent.com"
CLIENT_SECRET = "{client_secret}"
TARGETS_FILE = "batch2-targets.json"

def get_refresh_token_from_keychain():
    try:
        result = subprocess.run(
            ["security", "find-generic-password", "-s", "google_refresh_token",
             "-a", "efinney@brandguardhq.com", "-w"],
            capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        print("❌ Could not retrieve refresh token from Keychain")
        return None

def get_gmail_service():
    refresh_token = get_refresh_token_from_keychain()
    if not refresh_token:
        raise ValueError("Refresh token not found in Keychain")

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        scopes=SCOPES
    )

    if creds.expired or not creds.token:
        creds.refresh(Request())

    return build("gmail", "v1", credentials=creds)

def create_draft(service, to_email, subject, body):
    message = MIMEText(body, "plain")
    message["to"] = to_email
    message["from"] = SENDER_EMAIL
    message["subject"] = subject
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    draft = service.users().drafts().create(
        userId="me",
        body={{"message": {{"raw": raw_message}}}}
    ).execute()
    return draft["id"]

def load_targets(json_file):
    with open(json_file, "r") as f:\n        return json.load(f)\n\ndef main():
    print("🔐 Authenticating with Gmail API...")
    service = get_gmail_service()
    print("✅ Authenticated successfully.\\n")

    targets = load_targets(TARGETS_FILE)
    print(f"📬 Loaded {{len(targets)}} targets from {{TARGETS_FILE}}\\n")

    created = []
    for i, target in enumerate(targets, 1):
        try:
            draft_id = create_draft(
                service,
                to_email=target["to"],
                subject=target["subject"],
                body=target["body"]
            )
            created.append(draft_id)
            print(f"[{{i}}/{{len(targets)}}] ✅ Draft created → {{target['name']}} ({{target['to']}})")
        except Exception as e:\n            print(f"[{{i}}/{{len(targets)}}] ❌ Failed to create draft for {{target['name']}}: {{e}}")

    print(f"\\n🎉 Finished! Created {{len(created)}}/{{len(targets)}} drafts in Gmail.")

if __name__ == "__main__":
    main()
'''
    
    with open("create_gmail_drafts.py", "w") as f:\n        f.write(script)\n    \n    print("✅ Generated create_gmail_drafts.py with credentials from Keychain")\n    print("You can now run: python3 create_gmail_drafts.py")\n\nif __name__ == "__main__":\n    main()