#!/usr/bin/env python3
"""
Standalone New Member Welcome System for Agentic Bro
Detects new members via Telegram Bot API without relying on Rose Bot.

Checks member count increase and triggers welcome when growth detected.
Run via cron every 5 minutes.
"""

import json
import requests
from datetime import datetime, timezone
from pathlib import Path

# Config
BOT_TOKEN = "8692355…REDACTED"
GROUP_ID = "-1003751594817"
STATE_FILE = Path("/Users/efinney/.openclaw/workspace/member-welcome-state.json")

def load_state():
    """Load known member list."""
    if not STATE_FILE.exists():
        state = {
            "known_members": [],
            "last_check": None,
            "pending_welcomes": [],
            "last_member_count": 0,
            "total_joins_since_welcome": 0,  # Track joins since last welcome
            "last_welcome_count": 0  # Member count at last welcome
        }
        STATE_FILE.write_text(json.dumps(state, indent=2))
        return state
    return json.loads(STATE_FILE.read_text())

def save_state(state):
    """Persist state to file."""
    STATE_FILE.write_text(json.dumps(state, indent=2))

def get_group_members():
    """Get list of current group members via Bot API."""
    # Note: Telegram Bot API doesn't have a direct "get members" method
    # We track members through getChatMemberCount and recent messages
    # This is a limitation - we need Rose Bot or track joins differently
    
    # Alternative: Use getChatMemberCount to detect growth
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getChatMemberCount"
    resp = requests.post(url, json={"chat_id": GROUP_ID}, timeout=10)
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok"):
            return data.get("result", 0)
    return None

def get_chat_administrators():
    """Get list of group admins."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getChatAdministrators"
    resp = requests.post(url, json={"chat_id": GROUP_ID}, timeout=10)
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok"):
            return [admin["user"]["id"] for admin in data.get("result", [])]
    return []

def check_new_members():
    """Check for new members and return pending welcomes."""
    state = load_state()
    
    # Get current member count
    current_count = get_group_members()
    
    if current_count is None:
        print("❌ Could not get member count")
        return []
    
    last_count = state.get("last_member_count", current_count)
    new_count = current_count - last_count
    
    # Track total joins since last welcome
    total_joins = state.get("total_joins_since_welcome", 0)
    last_welcome_count = state.get("last_welcome_count", last_count)
    
    # Update state
    state["last_member_count"] = current_count
    state["last_check"] = datetime.now(timezone.utc).isoformat()
    
    if new_count > 0:
        print(f"📊 Member count increased by {new_count} (was {last_count}, now {current_count})")
        total_joins += new_count
        state["total_joins_since_welcome"] = total_joins
        save_state(state)
        
        # Return welcome trigger for any new members (1+)
        if total_joins >= 1:
            return [{"count": total_joins, "total": current_count}]
        else:
            return []
    
    save_state(state)
    return []

def get_welcome_message(new_count, total):
    """Generate welcome message for new members."""
    if new_count >= 3:
        # Batch welcome for 3+ members
        return """👋 Welcome to our newest members!

I'm Jeeevs, the AI agent powering AGNTCBRO — more than a chatbot. I scan X, Instagram, TikTok, Facebook, and Telegram profiles for scam risk scores in real-time.

🔍 What I can do:
• Scan any social profile for scam risk (0-10 score)
• Verify phone numbers with FTC data
• Analyze tokens and wallet risks

Tag me with @username to check anyone out!

We're Agentic Bro — building AI-powered scam protection for Solana. Scan first, trust later! 🔐"""
    else:
        # Individual welcome
        return """👋 Welcome! I'm Jeeevs, the AI agent powering AGNTCBRO — more than a chatbot. I scan X, Instagram, TikTok, Facebook, and Telegram profiles for scam risk scores in real-time.

Tag me with @username to check anyone out! 🔐"""

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "check":
        new_members = check_new_members()
        if new_members:
            for m in new_members:
                msg = get_welcome_message(m["count"], m["total"])
                print(f"\n📝 WELCOME MESSAGE:\n{msg}")
                print(f"NEW_MEMBERS={m['count']}")
        else:
            print("NO_NEW_MEMBERS")
    
    elif len(sys.argv) > 1 and sys.argv[1] == "status":
        state = load_state()
        print(f"Last member count: {state.get('last_member_count', 'unknown')}")
        print(f"Last check: {state.get('last_check', 'never')}")
        print(f"Joins since last welcome: {state.get('total_joins_since_welcome', 0)}/5")
    
    elif len(sys.argv) > 1 and sys.argv[1] == "reset":
        state = load_state()
        state["total_joins_since_welcome"] = 0
        state["last_welcome_count"] = state.get("last_member_count", 0)
        save_state(state)
        print("✅ Counter reset after welcome")
    
    else:
        print("Usage:")
        print("  python3 check-new-members.py check   # Check for new members")
        print("  python3 check-new-members.py status   # Show state")
        print("  python3 check-new-members.py reset    # Reset counter after welcome")