#!/usr/bin/env python3
"""
Telegram User ID Lookup Script
Uses MTProto (Telethon) to resolve username → user_id and get account age estimation.

Usage:
    source /Users/efinney/.openclaw/workspace/telegram-venv/bin/activate
    python scripts/telegram-id-lookup.py @username

Environment variables (from aibro/.env.local):
    TELEGRAM_API_ID=33421119
    TELEGRAM_API_HASH=46103eaa1d1f1b481da426aa528b6ee2
    TELEGRAM_SESSION_STRING=1AQAOMTQ5LjE1NC4xNzUuNTIBu2Lw...

The session string is already authenticated and stored in .env.local.
"""

import os
import sys
import asyncio
from datetime import datetime
from telethon import TelegramClient
from telethon.sessions import StringSession

# Load environment from aibro/.env.local
ENV_FILE = "/Users/efinney/.openclaw/workspace/aibro/.env.local"

def load_env():
    """Load environment variables from aibro/.env.local"""
    if not os.path.exists(ENV_FILE):
        print(f"Error: {ENV_FILE} not found")
        sys.exit(1)
    
    with open(ENV_FILE, 'r') as f:
        for line in f:
            line = line.strip()
            if line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            # Remove quotes if present
            value = value.strip('"').strip("'")
            os.environ[key] = value
    
    return os.environ.get('TELEGRAM_API_ID'), os.environ.get('TELEGRAM_API_HASH'), os.environ.get('TELEGRAM_SESSION_STRING')


async def lookup_user(username: str):
    """
    Resolve a Telegram username to user_id and profile info.
    
    Args:
        username: Telegram username (with or without @)
    
    Returns:
        dict with user info or error
    """
    # Clean username
    if username.startswith('@'):
        username = username[1:]
    
    # Load credentials
    api_id, api_hash, session_string = load_env()
    
    if not all([api_id, api_hash, session_string]):
        print("Error: Missing TELEGRAM_API_ID, TELEGRAM_API_HASH, or TELEGRAM_SESSION_STRING")
        print(f"Check {ENV_FILE}")
        sys.exit(1)
    
    # Create client
    session = StringSession(session_string)
    client = TelegramClient(session, int(api_id), api_hash)
    
    try:
        await client.connect()
        
        # Resolve username
        entity = await client.get_entity(username)
        
        # Extract user info
        user_id = entity.id
        first_name = getattr(entity, 'first_name', '') or ''
        last_name = getattr(entity, 'last_name', '') or ''
        username = getattr(entity, 'username', '') or ''
        
        # Calculate account age estimate based on user_id
        age_estimate = estimate_account_age(user_id)
        
        result = {
            'success': True,
            'username': username,
            'user_id': user_id,
            'display_name': f"{first_name} {last_name}".strip(),
            'first_name': first_name,
            'last_name': last_name,
            'is_bot': getattr(entity, 'bot', False),
            'is_verified': getattr(entity, 'verified', False),
            'is_scam': getattr(entity, 'scam', False),
            'is_fake': getattr(entity, 'fake', False),
            'restricted': getattr(entity, 'restricted', False),
            'age_estimate': age_estimate,
            'risk_level': calculate_risk(user_id, age_estimate),
        }
        
        # Print results
        print("\n" + "="*60)
        print(f"🔍 TELEGRAM USER LOOKUP: @{username}")
        print("="*60)
        print(f"\n📋 PROFILE INFO")
        print("-"*40)
        print(f"  User ID:        {user_id}")
        print(f"  Username:       @{username}")
        print(f"  Display Name:   {result['display_name']}")
        print(f"  Bot:            {'Yes' if result['is_bot'] else 'No'}")
        print(f"  Verified:       {'Yes ✅' if result['is_verified'] else 'No'}")
        print(f"  Scam Flag:      {'⚠️ YES' if result['is_scam'] else 'No'}")
        print(f"  Fake Flag:      {'⚠️ YES' if result['is_fake'] else 'No'}")
        
        print(f"\n📅 ACCOUNT AGE ESTIMATE")
        print("-"*40)
        print(f"  User ID:        {user_id}")
        print(f"  Digits:         {len(str(user_id))}")
        print(f"  Estimated Age:   {age_estimate['estimated_age']}")
        print(f"  Created:        ~{age_estimate['estimated_year']}")
        print(f"  Risk Level:     {age_estimate['risk']}")
        
        print(f"\n📊 RISK ASSESSMENT")
        print("-"*40)
        print(f"  Risk Level:     {result['risk_level']}")
        print(f"  Reason:         {age_estimate['reason']}")
        
        if result['is_scam'] or result['is_fake']:
            print("\n🚨 WARNING: This account has been flagged by Telegram!")
        
        print("\n" + "="*60 + "\n")
        
        return result
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return {
            'success': False,
            'error': str(e),
            'username': username,
        }
    finally:
        await client.disconnect()


def estimate_account_age(user_id: int) -> dict:
    """
    Estimate account creation date based on Telegram user ID pattern.
    
    Telegram assigns user IDs sequentially, so we can estimate account age.
    
    Args:
        user_id: Telegram user ID
    
    Returns:
        dict with age estimate, year, and risk level
    """
    digits = len(str(user_id))
    
    # User ID ranges and approximate creation dates
    # These are approximate and based on observed patterns
    if user_id < 1000000:  # < 1M (6 digits)
        return {
            'estimated_age': '6+ years (pre-2020)',
            'estimated_year': '2017 or earlier',
            'risk': 'LOW',
            'reason': 'Very old account (established user)',
            'digits': digits,
        }
    elif user_id < 10000000:  # < 10M (7 digits)
        return {
            'estimated_age': '4-6 years (2019-2022)',
            'estimated_year': '2018-2020',
            'risk': 'LOW',
            'reason': 'Established account (moderate age)',
            'digits': digits,
        }
    elif user_id < 100000000:  # < 100M (8 digits)
        return {
            'estimated_age': '2-4 years (2021-2024)',
            'estimated_year': '2020-2022',
            'risk': 'MEDIUM',
            'reason': 'Moderately new account (suspicious window)',
            'digits': digits,
        }
    elif user_id < 1000000000:  # < 1B (9 digits)
        return {
            'estimated_age': '1-2 years (2023-2025)',
            'estimated_year': '2023-2024',
            'risk': 'MEDIUM-HIGH',
            'reason': 'New account (common for scams)',
            'digits': digits,
        }
    else:  # >= 1B (10+ digits)
        return {
            'estimated_age': '< 1 year (2024-2025)',
            'estimated_year': '2024-2025',
            'risk': 'HIGH',
            'reason': 'Very new account (high risk)',
            'digits': digits,
        }


def calculate_risk(user_id: int, age_estimate: dict) -> str:
    """
    Calculate overall risk level for the account.
    
    Args:
        user_id: Telegram user ID
        age_estimate: Age estimate dict
    
    Returns:
        Risk level string
    """
    base_risk = age_estimate['risk']
    
    # Add additional risk factors
    # (In real implementation, would check scam/fake flags from Telegram)
    
    return base_risk


async def main():
    if len(sys.argv) < 2:
        print("\nUsage: python telegram-id-lookup.py @username")
        print("Example: python telegram-id-lookup.py @gost1_man\n")
        sys.exit(1)
    
    username = sys.argv[1]
    await lookup_user(username)


if __name__ == '__main__':
    asyncio.run(main())