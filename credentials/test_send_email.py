#!/usr/bin/env python3
"""
Test script to send a simple email via Gmail API using OAuth2
"""

import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from email.mime.text import MIMEText
import base64

SCOPES = ['https://www.googleapis.com/auth/gmail.send']
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "gmail_token.json")
SENDER = "efinney@brandguardhq.com"
RECIPIENT = "efinney@brandguardhq.com"

def create_message(sender, to, subject, message_text):
    message = MIMEText(message_text)
    message['to'] = to
    message['from'] = sender
    message['subject'] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return {'raw': raw}

def main():
    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    service = build('gmail', 'v1', credentials=creds)

    message = create_message(
        SENDER,
        RECIPIENT,
        "Test Email from Agentic Bro OAuth",
        "This is a test email sent successfully via Gmail OAuth2.\n\nIf you received this, the setup is working!"
    )

    try:
        sent = service.users().messages().send(userId="me", body=message).execute()
        print(f"✅ Email sent successfully! Message ID: {sent['id']}")
    except Exception as err:
        print(f"❌ Failed to send email: {err}")

if __name__ == "__main__":
    main()