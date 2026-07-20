#!/usr/bin/env python3
"""
Gmail OAuth2 Setup Script
Run this once to authorize the application and generate token.json
"""

import os
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

SCOPES = ['https://www.googleapis.com/auth/gmail.compose', 'https://www.googleapis.com/auth/gmail.send']
CLIENT_SECRET_FILE = os.path.join(os.path.dirname(__file__), "gmail_oauth_client.json")
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "gmail_token.json")

def main():
    creds = None

    # Load existing token if available
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    # If no valid credentials, run the OAuth flow
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                CLIENT_SECRET_FILE, SCOPES
            )
            creds = flow.run_local_server(port=0)

        # Save the credentials for future use
        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())
            print(f"✅ Token saved to: {TOKEN_FILE}")

    print("✅ Gmail OAuth2 setup complete!")

if __name__ == "__main__":
    main()