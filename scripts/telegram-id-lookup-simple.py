#!/usr/bin/env python3
"""
Telegram User ID Lookup Script

Resolves Telegram username → user_id using:
1. MTProto (if authenticated) - BEST
2. Web tool (tg-user.id) - FALLBACK
3. Manual input - LAST RESORT

Usage:
    python scripts/telegram-id-lookup-simple.py @username
    python scripts/telegram-id-lookup-simple.py 7062008359

Author: Agentic Bro Scam Detection System
"""
import os
import sys
import re
import asyncio
import json

# Try to import requests, fallback if not available
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

# Bot token from openclaw.json
BOT_TOKEN = "8692355…REDACTED"

# Environment file location
ENV_FILE = '/Users/efinney/.openclaw/workspace/aibro/.env.local'

# Cache file for user_id lookups
CACHE_FILE = '/Users/efinney/.openclaw/workspace/output/telegram_user_cache.json'


def load_env():
    """Load environment variables from aibro/.env.local"""
    env_vars = {}
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if line.startswith('#') or '=' not in line:
                    continue
                key, value = line.split('=', 1)
                value = value.strip('"').strip("'")
                env_vars[key] = value
    return env_vars


def load_cache():
    """Load cached user_id lookups"""
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {}


def save_cache(cache):
    """Save cache to file"""
    os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f, indent=2)


def estimate_account_age(user_id: int) -> dict:
    """Estimate account creation date based on Telegram user ID pattern."""
    digits = len(str(user_id))
    
    if user_id < 1000000:  # < 1M (6 digits)
        return {
            'estimated_age': '6+ years (pre-2020)',
            'estimated_year': '2017 or earlier',
            'risk': 'LOW',
            'risk_score': 0,
            'reason': 'Very old account (established user)',
        }
    elif user_id < 10000000:  # < 10M (7 digits)
        return {
            'estimated_age': '4-6 years (2018-2022)',
            'estimated_year': '2018-2020',
            'risk': 'LOW',
            'risk_score': 2,
            'reason': 'Established account',
        }
    elif user_id < 100000000:  # < 100M (8 digits)
        return {
            'estimated_age': '2-4 years (2020-2024)',
            'estimated_year': '2020-2022',
            'risk': 'MEDIUM',
            'risk_score': 5,
            'reason': 'Moderately new account (suspicious window)',
        }
    elif user_id < 1000000000:  # < 1B (9 digits)
        return {
            'estimated_age': '1-2 years (2023-2025)',
            'estimated_year': '2023-2024',
            'risk': 'MEDIUM-HIGH',
            'risk_score': 7,
            'reason': 'New account (common for scams)',
        }
    else:  # >= 1B (10+ digits)
        return {
            'estimated_age': '< 1 year (2024-2025)',
            'estimated_year': '2024-2025',
            'risk': 'HIGH',
            'risk_score': 9,
            'reason': 'Very new account (high risk)',
        }


def resolve_via_web_tool(username: str) -> dict:
    """
    Attempt to resolve username → user_id via web tools.
    
    This uses various methods to extract user_id:
    1. Check if user_id is in t.me page source
    2. Use third-party APIs if available
    """
    username = username.lstrip('@')
    
    if not REQUESTS_AVAILABLE:
        return {
            'success': False,
            'error': 'requests module not installed',
            'fallback': f'Go to https://tg-user.id/ and enter @{username}',
        }
    
    # Method 1: Check t.me page
    try:
        resp = requests.get(f"https://t.me/{username}", timeout=10)
        if resp.status_code == 200:
            # Look for user_id patterns in the page
            # Telegram pages sometimes contain user_id in data attributes
            match = re.search(r'"user_id":\s*(\d+)', resp.text)
            if match:
                user_id = int(match.group(1))
                return {
                    'success': True,
                    'user_id': user_id,
                    'username': username,
                    'method': 't.me_page',
                }
            
            # Check if profile exists
            if f'@{username}' in resp.text or username in resp.text:
                return {
                    'success': False,
                    'exists': True,
                    'username': username,
                    'error': 'Could not extract user_id from page',
                    'fallback': f'Go to https://tg-user.id/ and enter @{username}',
                }
    except Exception as e:
        pass
    
    # Method 2: Try tg-user.id (may be blocked by Cloudflare)
    # Note: This is a free tool, use with caution and respect rate limits
    try:
        # The site may require JavaScript, so this might not work
        # But we try anyway
        resp = requests.get(f"https://tg-user.id/", timeout=10)
        # This site likely needs the username in a form submission
        # For now, just return fallback instructions
    except:
        pass
    
    return {
        'success': False,
        'username': username,
        'error': 'Could not resolve via web tool',
        'fallback': f'Go to https://tg-user.id/ and enter @{username} to get the user_id',
    }


async def resolve_via_mtproto(username: str, env_vars: dict) -> dict:
    """
    Resolve username → user_id via MTProto (Telethon).
    
    Requires authenticated session.
    """
    username = username.lstrip('@')
    
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession
    except ImportError:
        return {
            'success': False,
            'error': 'telethon not installed',
            'fallback': f'Install: pip install telethon',
        }
    
    api_id = env_vars.get('TELEGRAM_API_ID')
    api_hash = env_vars.get('TELEGRAM_API_HASH')
    session_string = env_vars.get('TELEGRAM_SESSION_STRING')
    
    if not all([api_id, api_hash, session_string]):
        return {
            'success': False,
            'error': 'MTProto credentials not configured',
            'fallback': f'Set TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION_STRING in {ENV_FILE}',
        }
    
    try:
        client = TelegramClient(StringSession(session_string), int(api_id), api_hash)
        await client.connect()
        
        entity = await client.get_entity(username)
        user_id = entity.id
        
        await client.disconnect()
        
        return {
            'success': True,
            'user_id': user_id,
            'username': getattr(entity, 'username', username),
            'display_name': f"{getattr(entity, 'first_name', '')} {getattr(entity, 'last_name', '')}".strip(),
            'method': 'mtproto',
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'fallback': f'Go to https://tg-user.id/ and enter @{username}',
        }


def format_result(user_id: int, username: str = None, display_name: str = None) -> dict:
    """Format the result with age estimate and risk assessment."""
    age_estimate = estimate_account_age(user_id)
    
    result = {
        'success': True,
        'user_id': user_id,
        'digits': len(str(user_id)),
        'username': username,
        'display_name': display_name,
        'age_estimate': age_estimate['estimated_age'],
        'estimated_year': age_estimate['estimated_year'],
        'risk_level': age_estimate['risk'],
        'risk_score': age_estimate['risk_score'],
        'risk_reason': age_estimate['reason'],
    }
    
    return result


def print_result(result: dict):
    """Pretty print the result."""
    print("\n" + "="*60)
    
    if result.get('user_id'):
        print(f"🔍 TELEGRAM USER LOOKUP")
        print("="*60)
        print(f"\n📋 PROFILE INFO")
        print("-"*40)
        print(f"  User ID:        {result['user_id']}")
        if result.get('username'):
            print(f"  Username:       @{result['username']}")
        if result.get('display_name'):
            print(f"  Display Name:   {result['display_name']}")
        
        print(f"\n📅 ACCOUNT AGE ESTIMATE")
        print("-"*40)
        print(f"  User ID:        {result['user_id']}")
        print(f"  Digits:         {result['digits']}")
        print(f"  Estimated Age:  {result['age_estimate']}")
        print(f"  Created:        ~{result['estimated_year']}")
        
        print(f"\n📊 RISK ASSESSMENT")
        print("-"*40)
        print(f"  Risk Level:     {result['risk_level']}")
        print(f"  Risk Score:     {result['risk_score']}/10")
        print(f"  Reason:         {result['risk_reason']}")
        
        if result.get('method'):
            print(f"\n🔧 RESOLUTION METHOD")
            print("-"*40)
            print(f"  Method:         {result['method']}")
    else:
        print(f"🔍 TELEGRAM USERNAME CHECK: @{result.get('username', 'unknown')}")
        print("="*60)
        if result.get('exists'):
            print(f"\n✅ Username EXISTS on Telegram")
            print(f"  URL: https://t.me/{result.get('username')}")
        else:
            print(f"\n❌ Username NOT FOUND")
        
        if result.get('fallback'):
            print(f"\n📌 NEXT STEP")
            print("-"*40)
            print(f"  {result['fallback']}")
    
    print("\n" + "="*60 + "\n")


def main():
    if len(sys.argv) < 2:
        print("\n" + "="*60)
        print("TELEGRAM USER ID LOOKUP")
        print("="*60)
        print("\nUsage:")
        print("  python telegram-id-lookup-simple.py @username")
        print("  python telegram-id-lookup-simple.py 7062008359")
        print("\nExamples:")
        print("  python telegram-id-lookup-simple.py @gost1_man")
        print("  python telegram-id-lookup-simple.py 7062008359")
        print("\n" + "="*60 + "\n")
        sys.exit(1)
    
    arg = sys.argv[1]
    
    # Load environment and cache
    env_vars = load_env()
    cache = load_cache()
    
    # Check if it's a user_id (numeric)
    if arg.isdigit():
        user_id = int(arg)
        result = format_result(user_id)
        result['method'] = 'direct_input'
        
        # Cache the result
        if user_id not in cache:
            cache[user_id] = result
            save_cache(cache)
        
        print_result(result)
        return result
    
    # It's a username
    username = arg.lstrip('@')
    
    # Check cache first
    if username in cache:
        print(f"📦 Found in cache: @{username}")
        result = cache[username]
        result['method'] = 'cache'
        print_result(result)
        return result
    
    print(f"\n🔍 Looking up: @{username}")
    
    # Try MTProto first
    print("  → Trying MTProto...")
    mtproto_result = asyncio.run(resolve_via_mtproto(username, env_vars))
    
    if mtproto_result.get('success'):
        result = format_result(
            mtproto_result['user_id'],
            mtproto_result.get('username', username),
            mtproto_result.get('display_name')
        )
        result['method'] = 'mtproto'
        
        # Cache the result
        cache[username] = result
        if mtproto_result['user_id'] not in cache:
            cache[mtproto_result['user_id']] = result
        save_cache(cache)
        
        print_result(result)
        return result
    
    # MTProto failed, try web tool
    print(f"  → MTProto failed: {mtproto_result.get('error')}")
    print("  → Trying web tool...")
    web_result = resolve_via_web_tool(username)
    
    if web_result.get('success'):
        result = format_result(web_result['user_id'], username)
        result['method'] = web_result.get('method', 'web_tool')
        
        # Cache the result
        cache[username] = result
        if web_result['user_id'] not in cache:
            cache[web_result['user_id']] = result
        save_cache(cache)
        
        print_result(result)
        return result
    
    # Both failed - return fallback instructions
    print(f"  → Web tool failed: {web_result.get('error')}")
    
    result = {
        'success': False,
        'username': username,
        'exists': web_result.get('exists', True),
        'error': 'Could not resolve username to user_id',
        'fallback': f'Go to https://tg-user.id/ and enter @{username} to get the user_id, then run:\n    python telegram-id-lookup-simple.py <user_id>',
    }
    
    print_result(result)
    return result


if __name__ == '__main__':
    main()