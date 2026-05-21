#!/usr/bin/env python3
"""
Simple Telegram User ID Lookup - Direct test
"""
import os
import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession

# Load environment from aibro/.env.local
env_file = '/Users/efinney/.openclaw/workspace/aibro/.env.local'
with open(env_file) as f:
    for line in f:
        line = line.strip()
        if line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        value = value.strip('"').strip("'")
        os.environ[key] = value

api_id = int(os.environ['TELEGRAM_API_ID'])
api_hash = os.environ['TELEGRAM_API_HASH']
session_string = os.environ['TELEGRAM_SESSION_STRING']

async def main():
    username = 'gost1_man'
    if len(os.sys.argv) > 1:
        username = os.sys.argv[1].lstrip('@')
    
    print(f"Looking up: @{username}")
    
    client = TelegramClient(StringSession(session_string), api_id, api_hash)
    await client.connect()
    
    try:
        entity = await client.get_entity(username)
        
        user_id = entity.id
        digits = len(str(user_id))
        
        # Age estimate
        if user_id < 1000000:
            age = '6+ years (pre-2020)'
            risk = 'LOW'
        elif user_id < 10000000:
            age = '4-6 years (2018-2022)'
            risk = 'LOW'
        elif user_id < 100000000:
            age = '2-4 years (2020-2024)'
            risk = 'MEDIUM'
        elif user_id < 1000000000:
            age = '1-2 years (2023-2025)'
            risk = 'MEDIUM-HIGH'
        else:
            age = '< 1 year (2024-2025)'
            risk = 'HIGH'
        
        print(f"\n{'='*50}")
        print(f"🔍 TELEGRAM USER: @{username}")
        print(f"{'='*50}")
        print(f"  User ID:     {user_id}")
        print(f"  Digits:      {digits}")
        print(f"  Name:        {getattr(entity, 'first_name', '')} {getattr(entity, 'last_name', '')}")
        print(f"  Username:    @{getattr(entity, 'username', 'N/A')}")
        print(f"  Bot:         {getattr(entity, 'bot', False)}")
        print(f"  Verified:    {getattr(entity, 'verified', False)}")
        print(f"  Scam Flag:   {getattr(entity, 'scam', False)}")
        print(f"  Fake Flag:   {getattr(entity, 'fake', False)}")
        print(f"\n📅 AGE ESTIMATE")
        print(f"  Estimated:   {age}")
        print(f"  Risk Level:  {risk}")
        print(f"{'='*50}\n")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())