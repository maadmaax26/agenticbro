#!/usr/bin/env python3
"""Monitor for new members in the Telegram group"""
import os
import requests
import json
import datetime
import sys


def get_member_count():
    """Get current member count from Telegram API"""
    resp = requests.get(
        "https://api.telegram.org/bot8692355…REDACTED/getChatMembersCount",
        params={"chat_id": "-1003751594817"}
    )
    if resp.status_code != 200:
        print("Failed to get member count", file=sys.stderr)
        return "error"
    return resp.json().get("result", "error")


def check_welcome_cooldown():
    """Check if welcome cooldown is active"""
    try:
        with open("/Users/efinney/.openclaw/workspace/output/last_welcome_time.txt", "r") as f:
            last_welcome = int(f.read().strip())
        now = int(datetime.datetime.now().timestamp())
        return now - last_welcome
    except FileNotFoundError:
        return None


def is_cooldown_active(prev_count, cooldown_seconds):
    """Check if we should wait before welcoming new members"""
    if prev_count is None:
        return True
    now = int(datetime.datetime.now().timestamp())
    if now - prev_count < cooldown_seconds:
        return True
    return False


def main():
    # Get member count
    current = get_member_count()
    if current == "error":
        print("Failed to get member count", file=sys.stderr)
        sys.exit(1)

    # Read previous count from state file
    prev_count = None
    if os.path.exists("/Users/efinney/.openclaw/workspace/output/last_member_count.txt"):
        with open("/Users/efinney/.openclaw/workspace/output/last_member_count.txt", "r") as f:
            prev_count = int(f.read().strip())
    
    # Check cooldown
    if is_cooldown_active(prev_count, 300):
        print(f"Cooldown active: {prev_count} members, need 300s", file=sys.stderr)
        sys.exit(0)

    # Save current count (if not first run)
    if prev_count is None:
        print("No previous member count")
        with open("/Users/efinney/.openclaw/workspace/output/last_member_count.txt", "w") as f:
            f.write(str(current))
    else:
        if current < prev_count:
            print("No new members (count decreased)", file=sys.stderr)
            return 0
        diff = current - prev_count
        print(f"New members detected: +{diff}", file=sys.stderr)

    # Check cooldown
    cooldown = check_welcome_cooldown()
    print(f"DEBUG: Cooldown file exists: {cooldown}s, current time: {int(datetime.datetime.now().timestamp())}s", file=sys.stderr)
    if cooldown is not None:
        diff_seconds = int(datetime.datetime.now().timestamp()) - cooldown
        if diff_seconds < 300:
            print(f"Cooldown active: {diff_seconds}s, need 300s", file=sys.stderr)
            sys.exit(0)

    # Post welcome message for new member
    message = "Welcome to our new members! Jeeevs, the AI agent powering AGNTCBRO. My team scans X/Twitter, Instagram, TikTok, Telegram, and other platforms for red flags in crypto scams. Stay safe—never trust what's sent by strangers, never click links from unknown sources, and always verify before sending money! #ScamPrevention #SecureYourAssets"

    print(f"Sending message to group -1003751594817: {message[:50]}...", file=sys.stderr)

    response = requests.get(
        "https://api.telegram.org/bot8692355…REDACTED/sendMessage",
        params={"chat_id": "-1003751594817", "text": message}
    )

    if response.status_code == 200:
        print("Welcome message posted successfully")
        with open("/Users/efinney/.openclaw/workspace/output/last_welcome_time.txt", "w") as f:
            f.write(str(int(datetime.datetime.now().timestamp())))
        print("Wrote cooldown file")
    else:
        print(f"Failed to post welcome message: {response.text[:50]}...", file=sys.stderr)

    print("Welcome message posted successfully")
    return 0


if __name__ == "__main__":
    sys.exit(main())
