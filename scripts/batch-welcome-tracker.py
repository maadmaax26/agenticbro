#!/usr/bin/env python3
"""
Batch Welcome Tracker for Agentic Bro Telegram Group

Tracks Rose Bot welcome messages and triggers a batch welcome after 5 new members.
State is persisted in batch-welcome-state.json.

Rose Bot sends: "Hey there [Name], and welcome to $AGNTCBRO!"
When we see 5 of these, we send one consolidated welcome.
"""

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE = Path("/Users/efinney/.openclaw/workspace")
STATE_FILE = WORKSPACE / "batch-welcome-state.json"

# Initialize state
def init_state():
    if not STATE_FILE.exists():
        state = {
            "join_count": 0,
            "last_welcome": None,
            "pending_members": [],
            "last_reset": datetime.now(timezone.utc).isoformat()
        }
        STATE_FILE.write_text(json.dumps(state, indent=2))
    return json.loads(STATE_FILE.read_text())

def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))

def increment_join(member_name: str):
    """Call this when Rose Bot welcomes a new member."""
    state = init_state()
    state["join_count"] += 1
    state["pending_members"].append({
        "name": member_name,
        "joined_at": datetime.now(timezone.utc).isoformat()
    })
    save_state(state)
    
    print(f"✅ Member joined: {member_name}")
    print(f"📊 Join count: {state['join_count']}/5")
    
    return state["join_count"]

def should_send_welcome():
    """Check if we should send batch welcome."""
    state = init_state()
    return state["join_count"] >= 5

def reset_after_welcome():
    """Reset counter after sending welcome."""
    state = init_state()
    state["join_count"] = 0
    state["last_welcome"] = datetime.now(timezone.utc).isoformat()
    state["pending_members"] = []
    save_state(state)
    print("🔄 Counter reset after batch welcome")

def get_pending_members():
    """Get list of pending member names."""
    state = init_state()
    return [m["name"] for m in state["pending_members"]]

def get_welcome_message():
    """Generate batch welcome message."""
    members = get_pending_members()
    
    if len(members) == 0:
        return None
    
    # Short welcome for 5+ members
    msg = """👋 Welcome! I'm Jeeevs, the AI agent powering $AGNTCBRO — more than a chatbot. I scan X, Instagram, TikTok, Facebook, and Telegram profiles for scam risk scores in real-time.

Tag me with @username to check anyone out! 🔐"""

    return msg

# For testing
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        
        if cmd == "increment":
            name = sys.argv[2] if len(sys.argv) > 2 else "TestUser"
            count = increment_join(name)
            print(f"Join count now: {count}/5")
            
            if should_send_welcome():
                print("\n📝 Ready to send batch welcome!")
                print("Message:")
                print(get_welcome_message())
                
        elif cmd == "reset":
            reset_after_welcome()
            print("Counter reset")
            
        elif cmd == "status":
            state = init_state()
            print(f"Join count: {state['join_count']}/5")
            print(f"Last welcome: {state.get('last_welcome', 'Never')}")
            print(f"Pending members: {get_pending_members()}")
            
        elif cmd == "message":
            print(get_welcome_message())
    else:
        print("Usage:")
        print("  python3 batch-welcome-tracker.py increment <name>")
        print("  python3 batch-welcome-tracker.py reset")
        print("  python3 batch-welcome-tracker.py status")
        print("  python3 batch-welcome-tracker.py message")