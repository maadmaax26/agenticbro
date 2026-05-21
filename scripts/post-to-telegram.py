#!/usr/bin/env python3
"""
Direct Telegram Message Poster for Agentic Bro Group
======================================================

This script posts promotional messages to the Agentic Bro Telegram group.
Group ID: -1003751594817
"""

import os
import sys
import time
import json
from pathlib import Path

# Add the scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Check if python-telegram-bot is installed
try:
    from telegram import Bot, Update
    from telegram.ext import CommandHandler, CallbackContext
    TELEGRAM_AVAILABLE = True
except ImportError:
    TELEGRAM_AVAILABLE = False
    print("⚠️  python-telegram-bot not installed. Installing...")
    os.system("pip3 install python-telegram-bot -q")
    from telegram import Bot
    from telegram.ext import CommandHandler, CallbackContext
    TELEGRAM_AVAILABLE = True

# Configuration
GROUP_ID = "-1003751594817"  # Agentic Bro group

# Message templates
BUY_THE_DIP_MESSAGES = [
    "💎 Diamond hands don't flinch! 
Money moves when you don't panic. 
🔥 Scammers panic when you HODL smart. 
⚖️ Market swings test the weak - you? You're building. 
🎯 Scan before ape. Sleep tonight knowing you're covered. 
$AGNTCBRO 🚀 #Solana #DiamondHands #CryptoSurvival",
    
    "📉 Dips are for buying, not crying! 
You don't get discounts on dreams - you get them on assets. 
🧠 Smart money waits for red candles. 
Dumb money sells on red candles. 
🏦 You're building wealth, not regret. 
📈 Scan → Verify → Ape. 
$AGNTCBRO #Solana #BuyTheDip #CryptoMindset",
    
    "💪 Strong community = Strong token! 
5K+ eyes watching for scams are better than 5K+ eyes making the same mistakes. 
🛡️ Protection mode: active. 
🔮 We spot the rug before you. 
🤝 Together we stay safe. 
💎 Trade smart, trade safe. 
$AGNTCBRO #Solana #CommunityPower #ScamFree",
    
    "🛡️ Your personal scam shield is active! 
⚠️ 34+ HIGH RISK profiles blocked. 
🕰️ Your safety never sleeps. 
📊 Data speaks - patterns don't lie. 
🔐 Trade with awareness. 
⭐ Stay sharp, stay safe. 
$AGNTCBRO #Solana #ScamShield #CryptoProtection",
    
    "🧠 Alpha mindset: Verify everything! 
FOMO burns. Proof pays. 
🕵️ No FOMO, just smart moves. 
🔍 Scan → Verify → Think → Ape. 
💎 Don't chase phantom alpha - build your own. 
🚀 Smart money thinks before it moves. 
$AGNTCBRO #Solana #AlphaMental #CryptoWisdom",
    
    "💎💎💎 AGENTIC BRO ENERGY BOOST 📈 
✨ Diamond hands meme: 
"Money doesn't care about your emotions. 

But your emotions cost you money. 

Stay calm, stay sharp, stay smart. 

$AGNTCBRO #Solana #MoveToMoon",
    
    "🚀 AGENTIC BRO DEFI DAY MODE 🌟 
"Smart moves only. No gambling, no random memes, no scams. 

Respect the game. 
Respect the money. 
Respect yourself. 

$AGNTCBRO #Solana #DefiLife #MoveToMoon"
]


class TelegramPoster:
    def __init__(self):
        """Initialize Telegram bot with token from environment"""
        bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        
        if not bot_token:
            # Try alternative locations
            config_paths = [
                "/Users/efinney/.openclaw/workspace/.env",
                "/Users/efinney/.openclaw/workspace/.env.local"
            ]
            
            for config_path in config_paths:
                if os.path.exists(config_path):
                    self.load_env(config_path)
                    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
                    if bot_token:
                        print(f"✅ Loaded token from {config_path}")
                        break
            
            if not bot_token:
                print("❌ No TELEGRAM_BOT_TOKEN found in environment files!")
                print("\nPlease set your Telegram bot token:")
                print('  export TELEGRAM_BOT_TOKEN="your-bot-token-here"')
                return None
        
        self.bot = Bot(token=bot_token)
        self.group_id = GROUP_ID
        self.message_count = 0
    
    def load_env(self, path):
        """Load environment variables from a file"""
        with open(path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()
    
    def post_message(self, message):
        """Post a message to the Agentic Bro group"""
        try:
            print(f"📤 Posting to group {self.group_id}...")
            print(f"📝 Message preview: {message[:100]}...")
            
            message_obj = self.bot.send_message(
                chat_id=self.group_id,
                text=message,
                parse_mode='HTML'
            )
            
            self.message_count += 1
            print(f"✅ Message sent successfully (#{self.message_count})")
            print(f"   Message ID: {message_obj.message_id}")
            
            return True, message_obj
            
        except Exception as e:
            print(f"❌ Error posting message: {e}")
            return False, str(e)
    
    def random_message(self):
        """Get a random buy-the-dip message"""
        import random
        return random.choice(BUY_THE_DIP_MESSAGES)
    
    def post_random(self):
        """Post a random message"""
        message = self.random_message()
        success, result = self.post_message(message)
        return success, result, message


def main():
    print("🚀 Agentic Bro Telegram Poster")
    print("=" * 50)
    
    poster = TelegramPoster()
    
    if not poster:
        print("❌ Could not initialize Telegram poster")
        return 1
    
    if len(sys.argv) > 1:
        # Custom message from command line
        if sys.argv[1] == '--test':
            print("\n🧪 Posting test message...")
            success, result, message = poster.post_random()
            return 0 if success else 1
        
        elif sys.argv[1] == '--list':
            print("\n📋 Available messages:")
            for i, msg in enumerate(BUY_THE_DIP_MESSAGES, 1):
                print(f"{i}. {msg[:100]}...")
            return 0
        
        else:
            # Post custom message
            message = sys.argv[1]
            success, result = poster.post_message(message)
            return 0 if success else 1
    else:
        # Post random message
        print("\n🎲 Posting random buy-the-dip message...")
        success, result, message = poster.post_random()
        
        if success:
            print("\n" + "=" * 50)
            print("✅ Message posted successfully!")
            return 0
        else:
            print("\n" + "=" * 50)
            print(f"❌ Failed to post message: {result}")
            return 1


if __name__ == "__main__":
    sys.exit(main())