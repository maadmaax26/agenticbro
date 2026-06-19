#!/usr/bin/env python3
"""
tag_all_members.py — Tag all group members with a message (admin-only)

Reads members from local JSON file and sends via Telegram Bot API.
Splits into multiple messages if needed (Telegram 4096 char limit).

Usage:
  python3 tag_all_members.py add <group_id> <user_id> [username] [first_name]
  python3 tag_all_members.py remove <group_id> <user_id>
  python3 tag_all_members.py list <group_id>
  python3 tag_all_members.py count <group_id>
  python3 tag_all_members.py tag <group_id> "<message>"

Member store: /Users/efinney/.openclaw/workspace/data/group_members.json
"""

import json
import os
import sys
import urllib.request
import urllib.parse
from datetime import datetime, timezone

MEMBERS_FILE = "/Users/efinney/.openclaw/workspace/data/group_members.json"
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")

def _load_members():
    """Load member store from disk."""
    os.makedirs(os.path.dirname(MEMBERS_FILE), exist_ok=True)
    if os.path.exists(MEMBERS_FILE):
        with open(MEMBERS_FILE, "r") as f:
            return json.load(f)
    return {}

def _save_members(data):
    """Save member store to disk."""
    os.makedirs(os.path.dirname(MEMBERS_FILE), exist_ok=True)
    with open(MEMBERS_FILE, "w") as f:
        json.dump(data, f, indent=2)

def add_member(group_id: str, user_id: int, username: str = "", first_name: str = "", last_name: str = ""):
    """Add or update a member."""
    data = _load_members()
    gid = str(group_id)
    uid = str(user_id)
    
    if gid not in data:
        data[gid] = {}
    
    now = datetime.now(timezone.utc).isoformat()
    
    if uid in data[gid]:
        # Update existing (re-joined)
        data[gid][uid]["username"] = username
        data[gid][uid]["first_name"] = first_name
        data[gid][uid]["last_name"] = last_name
        data[gid][uid]["is_member"] = True
        data[gid][uid]["left_at"] = None
        data[gid][uid]["updated_at"] = now
        print(f"Updated member {uid} (@{username}) in group {gid}")
    else:
        data[gid][uid] = {
            "user_id": user_id,
            "username": username,
            "first_name": first_name,
            "last_name": last_name,
            "is_member": True,
            "joined_at": now,
            "updated_at": now,
            "left_at": None,
        }
        print(f"Added member {uid} (@{username}) to group {gid}")
    
    _save_members(data)

def remove_member(group_id: str, user_id: int):
    """Mark a member as left."""
    data = _load_members()
    gid = str(group_id)
    uid = str(user_id)
    
    now = datetime.now(timezone.utc).isoformat()
    
    if gid in data and uid in data[gid]:
        data[gid][uid]["is_member"] = False
        data[gid][uid]["left_at"] = now
        data[gid][uid]["updated_at"] = now
        _save_members(data)
        print(f"Marked member {uid} as left group {gid}")
    else:
        print(f"Member {uid} not found in group {gid}")

def get_members(group_id: str, active_only: bool = True) -> list:
    """Get members of a group."""
    data = _load_members()
    gid = str(group_id)
    
    if gid not in data:
        return []
    
    members = []
    for uid, info in data[gid].items():
        if active_only and not info.get("is_member", True):
            continue
        members.append(info)
    
    # Sort by join date
    members.sort(key=lambda m: m.get("joined_at", ""))
    return members

def tag_all(group_id: str, message: str) -> dict:
    """Build and send a tag-all message to the group."""
    if not BOT_TOKEN:
        return {"error": "TELEGRAM_BOT_TOKEN env var required"}
    
    members = get_members(group_id, active_only=True)
    if not members:
        return {"error": "No members tracked. Members are added when they join the group.", "count": 0}
    
    # Build mentions
    mentions = []
    for m in members:
        username = m.get("username", "")
        first_name = m.get("first_name", "")
        user_id = m.get("user_id", "")
        
        if username:
            mentions.append(f"@{username}")
        elif user_id:
            # HTML mention links directly to user (notification even without username)
            name = first_name or "Member"
            mentions.append(f'<a href="tg://user?id={user_id}">{name}</a>')
        else:
            mentions.append(first_name or "Member")
    
    # Split into chunks (Telegram 4096 char limit)
    header = f"📢 {message}\n\n"
    chunks = []
    current = header
    
    for mention in mentions:
        separator = " " if not current.endswith("\n\n") else ""
        test = current + separator + mention
        if len(test) > 3900:  # Safety margin for HTML entities
            chunks.append(current)
            current = mention + " "
        else:
            current = test
    
    if current.strip():
        chunks.append(current)
    
    # Send each chunk via Telegram API
    sent = 0
    errors = []
    for i, chunk in enumerate(chunks):
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": group_id,
            "text": chunk,
            "parse_mode": "HTML",
        }
        
        try:
            req_data = json.dumps(payload).encode()
            req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"})
            resp = urllib.request.urlopen(req, timeout=15)
            result = json.loads(resp.read())
            if result.get("ok"):
                sent += 1
                print(f"✅ Sent message {i+1}/{len(chunks)} ({len(chunk)} chars)")
            else:
                errors.append(f"Chunk {i+1}: {result.get('description', 'unknown error')}")
                print(f"❌ Error sending message {i+1}: {result}")
        except Exception as e:
            errors.append(f"Chunk {i+1}: {str(e)}")
            print(f"❌ Error sending message {i+1}: {e}")
    
    return {
        "sent": sent,
        "total_chunks": len(chunks),
        "members_tagged": len(mentions),
        "errors": errors if errors else None,
    }

def sync_admins(group_id: str):
    """Sync administrators from Telegram (only members we can list via Bot API)."""
    if not BOT_TOKEN:
        print("ERROR: TELEGRAM_BOT_TOKEN env var required")
        return
    
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getChatAdministrators"
    payload = {"chat_id": group_id}
    
    try:
        req_data = json.dumps(payload).encode()
        req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"})
        resp = urllib.request.urlopen(req, timeout=10)
        result = json.loads(resp.read())
        
        admins = result.get("result", [])
        for admin in admins:
            user = admin.get("user", {})
            add_member(
                group_id=group_id,
                user_id=user.get("id", ""),
                username=user.get("username", ""),
                first_name=user.get("first_name", ""),
                last_name=user.get("last_name", ""),
            )
        print(f"Synced {len(admins)} admins from Telegram")
    except Exception as e:
        print(f"Error syncing admins: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    action = sys.argv[1]
    
    if action == "add":
        if len(sys.argv) < 4:
            print("Usage: tag_all_members.py add <group_id> <user_id> [username] [first_name]")
            sys.exit(1)
        group_id = sys.argv[2]
        user_id = int(sys.argv[3])
        username = sys.argv[4] if len(sys.argv) > 4 else ""
        first_name = sys.argv[5] if len(sys.argv) > 5 else ""
        add_member(group_id, user_id, username, first_name)
    
    elif action == "remove":
        if len(sys.argv) < 4:
            print("Usage: tag_all_members.py remove <group_id> <user_id>")
            sys.exit(1)
        group_id = sys.argv[2]
        user_id = int(sys.argv[3])
        remove_member(group_id, user_id)
    
    elif action == "list":
        if len(sys.argv) < 3:
            print("Usage: tag_all_members.py list <group_id>")
            sys.exit(1)
        group_id = sys.argv[2]
        members = get_members(group_id)
        print(f"Members in group {group_id}: {len(members)}")
        for m in members:
            uid = m.get("user_id", "?")
            uname = m.get("username", "?")
            fname = m.get("first_name", "")
            print(f"  {uid} @{uname} {fname}")
    
    elif action == "count":
        if len(sys.argv) < 3:
            print("Usage: tag_all_members.py count <group_id>")
            sys.exit(1)
        group_id = sys.argv[2]
        members = get_members(group_id)
        print(len(members))
    
    elif action == "tag":
        if len(sys.argv) < 4:
            print("Usage: tag_all_members.py tag <group_id> \"<message>\"")
            sys.exit(1)
        group_id = sys.argv[2]
        message = sys.argv[3]
        result = tag_all(group_id, message)
        print(json.dumps(result, indent=2))
    
    elif action == "sync":
        if len(sys.argv) < 3:
            print("Usage: tag_all_members.py sync <group_id>")
            sys.exit(1)
        group_id = sys.argv[2]
        sync_admins(group_id)
    
    else:
        print(f"Unknown action: {action}")
        sys.exit(1)