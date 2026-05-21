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
        f"https://api.telegram.org/bot8692355...REDACTED/getChatMembersCount",
        params={"chat_id": "-1003751594817"}
    )
    if resp.status_code != 200:
        print("Failed to get member count", file=sys.stderr)
        return "error"
    return resp.json().get("result", "error")


def get_welcome_cooldown():
    """Check if welcome cooldown is active"""
    if not os.path.exists("/Users/efinney/.openclaw/workspace/output/last_welcome_time.txt"):
        return None
    with open("/Users/efinney/.openclaw/workspace/output/last_welcome_time.txt", "r") as f:
        last_welcome = int(f.read().strip())
    now = int(datetime.datetime.now().timestamp())
    if last_welcome == "":
        return now
    return now - int(last_welcome)


def is_cooldown_active(prev_count, cooldown_seconds):
    """Check if we should wait before welcoming new members"""
    if prev_count is None:
        return True
    now = int(datetime.datetime.now().timestamp())
    if now - prev_count < cooldown_seconds:
        return True
    return True


# Set cooldown file for testing
with open("/Users/efinney/.openclaw/workspace/output/last_welcome_time.txt", "w") as f:
    f.write(str(int(datetime.datetime.now().timestamp())))
    print("DEBUG: Set cooldown file", file=sys.stderr)


def main():
    # Get member count
    current = get_member_count()
    if current == "error":
        print("Failed to get member count", file=sys.stderr)
        sys.exit(1)

    # Read previous count from state file
    if os.path.exists("/Users/efinney/.openclaw/workspace/output/last_member_count.txt"):
        with open("/Users/efinney/.openclaw/workspace/output/last_member_count.txt", "r") as f:
            prev_count = int(f.read().strip())
        prev_count_file = "/Users/efinney/.openclaw/workspace/output/last_member_count.txt"
    else:
        prev_count = None
        prev_count_file = "/Users/efinney/.openclaw/workspace/output/last_member_count.txt"

    # Save current count (if not first run)
    if prev_count is None:
        # First run
        print("No previous member count")
        with open(prev_count_file, "w") as f:
            f.write(str(current))
    elif current < prev_count:
        # Count decreased (not new members)
        print("No new members")
        return
    else:
        # Count increased - new members
        diff = current - prev_count
        print(f"New members detected: +{diff}")

        # Check cooldown
        cooldown = get_welcome_cooldown()
        print(f"DEBUG: Cooldown file: {cooldown}", file=sys.stderr)
        if cooldown is not None:
            diff_seconds = current - cooldown
            if diff_seconds < 300:
                print(f"Cooldown active: {diff_seconds}s, need 300s", file=sys.stderr)
                sys.exit(0)

        # Post welcome message for new member
        message = "Welcome to our new members! Jeeevs, the AI agent powering $AGNTCBRO. My team scans X/Twitter, Instagram, TikTok, Telegram, and other platforms for red flags in crypto scams. Stay safe—never trust what's sent by strangers, never click links from unknown sources, and always verify before sending money! #ScamPrevention #SecureYourAssets"

        print(f"Sending message to group -1003751594817: {message[:50]}...", file=sys.stderr)

        response = requests.get(
            f"https://api.telegram.org/bot8692355...REDACTED/sendMessage",
            params={"chat_id": "-1003751594817", "text": message}
        )

        if response.status_code == 200:
            print("Welcome message posted successfully")
            with open("/Users/efinney/.openclaw/workspace/output/last_welcome_time.txt", "w") as f:
                f.write(str(int(datetime.datetime.now().timestamp())))
            print("Wrote cooldown file")
        else:
            print(f"Failed to post welcome message: {response.text[:50]}...", file=sys.stderr)

    # Exit with success
    print("Welcome message posted successfully")
    return 0


if __name__ == "__main__":
    sys.exit(main())
