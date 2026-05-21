#!/bin/bin/env python3
"""
Member Join Detector for Agentic Bro

This script should be called when the bot receives a 'new_chat_members' update
from Telegram. It tracks new members and triggers welcome messages.

Usage:
  python3 member-join-detector.py add "John" "Jane"  # Add new members
  python3 member-join-detector.py status              # Show pending welcomes
  python3 member-join-detector.py clear               # Clear pending welcomes
"""

import json
from datetime import datetime, timezone
from pathlib import Path

STATE_FILE = Path("/Users/efinney/.openclaw/workspace/member-welcome-state.json")

def load_state():
    """Load state from file."""
    if not STATE_FILE.exists():
        state = {
            "known_members": [],      # List of user IDs we've welcomed
            "pending_welcomes": [],   # List of {name, user_id, timestamp} to welcome
            "last_welcome": None,     # Last time we sent batch welcome
            "total_welcomed": 0       # Total members welcomed
        }
        STATE_FILE.write_text(json.dumps(state, indent=2))
        return state
    return json.loads(STATE_FILE.read_text())

def save_state(state):
    """Persist state to file."""
    STATE_FILE.write_text(json.dumps(state, indent=2))

def add_new_members(members):
    """Add new members to pending welcomes.
    
    Args:
        members: List of {"name": str, "user_id": int}
    """
    state = load_state()
    
    for member in members:
        name = member.get("name", "New Member")
        user_id = member.get("user_id")
        
        # Skip if already welcomed
        if user_id and str(user_id) in [str(m) for m in state["known_members"]]:
            print(f"⏭️ Skipping {name} (already welcomed)")
            continue
        
        # Add to pending
        state["pending_welcomes"].append({
            "name": name,
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        if user_id:
            state["known_members"].append(str(user_id))
        
        print(f"✅ Added {name} to pending welcomes")
    
    save_state(state)
    return state

def get_pending_welcomes():
    """Get list of members waiting to be welcomed."""
    state = load_state()
    return state.get("pending_welcomes", [])

def should_send_batch_welcome():
    """Check if we have 5+ pending welcomes."""
    state = load_state()
    return len(state["pending_welcomes"]) >= 5

def clear_pending_welcomes():
    """Clear pending welcomes after sending."""
    state = load_state()
    count = len(state["pending_welcomes"])
    state["pending_welcomes"] = []
    state["last_welcome"] = datetime.now(timezone.utc).isoformat()
    state["total_welcomed"] += count
    save_state(state)
    print(f"🔄 Cleared {count} pending welcomes")
    return count

def get_welcome_message():
    """Generate welcome message based on pending count."""
    state = load_state()
    pending = state["pending_welcomes"]
    count = len(pending)
    
    if count == 0:
        return None
    
    if count >= 5:
        # Batch welcome for 5+ members
        names = [m["name"] for m in pending[:5]]  # First 5 names
        names_str = ", ".join(names[:3])
        if len(names) > 3:
            names_str += f" and {len(names) - 3} others"
        
        return f"""👋 Welcome to our newest members!

I'm Jeeevs, the AI scam detection assistant. I scan profiles and phone numbers to help protect you from scams.

**What I do:**
• Scan X/IG/TikTok/FB/Telegram profiles
• Verify phone numbers with FTC data
• Analyze tokens for risks

**How to use:** Tag me with @username to scan anyone.

Stay safe! 🔐"""
    else:
        # Individual welcome (for 1-4 members)
        names = [m["name"] for m in pending]
        if len(names) == 1:
            greeting = f"👋 Welcome {names[0]}!"
        else:
            greeting = f"👋 Welcome {', '.join(names[:-1])} and {names[-1]}!"
        
        return f"""{greeting}

I'm Jeeevs, the AI scam detection assistant. Tag me with @username to scan any profile for scam risks.

Stay safe! 🔐"""

def status():
    """Print current status."""
    state = load_state()
    pending = state.get("pending_welcomes", [])
    
    print(f"📊 Pending welcomes: {len(pending)}")
    print(f"📊 Total welcomed: {state.get('total_welcomed', 0)}")
    print(f"📊 Last welcome: {state.get('last_welcome', 'never')}")
    
    if pending:
        print("\nPending members:")
        for m in pending:
            print(f"  • {m['name']} ({m.get('user_id', 'unknown')})")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 member-join-detector.py add 'John' 'Jane'  # Add members")
        print("  python3 member-join-detector.py status              # Show status")
        print("  python3 member-join-detector.py clear               # Clear pending")
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == "add":
        # Parse member names from args
        members = []
        for arg in sys.argv[2:]:
            members.append({"name": arg, "user_id": None})
        if members:
            add_new_members(members)
            msg = get_welcome_message()
            if msg:
                print(f"\n📝 WELCOME MESSAGE:\n{msg}")
            if should_send_batch_welcome():
                print("\n🎯 Ready for batch welcome (5+ members)")
    
    elif cmd == "status":
        status()
    
    elif cmd == "clear":
        clear_pending_welcomes()
    
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)