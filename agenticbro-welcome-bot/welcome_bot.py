#!/usr/bin/env python3
"""
Agentic Bro Welcome Bot
Automatically welcomes new members to the Agentic Bro Telegram group
"""

import os
import logging
from datetime import datetime
from telegram import Update
from telegram.ext import Application, ContextTypes, MessageHandler, filters

# Configuration
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8692355…REDACTED")
TARGET_GROUP_ID = int(os.getenv("TARGET_GROUP_ID", "-1003751594817"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=getattr(logging, LOG_LEVEL),
    handlers=[
        logging.FileHandler('bot.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Welcome messages
WELCOME_MESSAGES = [
    "Welcome to Agentic Bro! 🚀\n\nI'm Jeeevs, your AI scam detector. Tag me or DM me to scan any profile before you ape:\n\n🔍 X/Twitter profiles\n📱 Telegram channels\n🎬 TikTok profiles\n📸 Instagram accounts\n\n🔐 Scan first, trust later!\n\n$AGNTCBRO #Solana #CryptoSafety",
    
    "Hey there! Welcome to Agentic Bro! 👋\n\nHere to keep your $SOL safe from scams. Just tag me with any @username or link and I'll run a full risk assessment.\n\nPlatforms I scan:\n• X/Twitter\n• Telegram\n• TikTok\n• Instagram\n\n🔐 Scan first, trust later!\n\n$AGNTCBRO",
    
    "Welcome to the Bro community! 🤝\n\nBefore you ape into any token, let me scan it for red flags. I can check profiles across:\n\n✓ X/Twitter\n✓ Telegram\n✓ TikTok\n✓ Instagram\n\n🔐 Stay safe out there!\n\n$AGNTCBRO #Solana"
]

async def welcome_new_member(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle new chat members."""
    if update.message and update.message.new_chat_members:
        chat_id = update.message.chat_id
        
        # Only process if in target group
        if chat_id != TARGET_GROUP_ID:
            logger.debug(f"Ignoring message from chat {chat_id} (not target group)")
            return
        
        for member in update.message.new_chat_members:
            # Don't welcome the bot itself
            if member.id == context.bot.id:
                logger.info("Bot was added to group, skipping self-welcome")
                continue
            
            # Get member info
            name = member.first_name
            if member.last_name:
                name += f" {member.last_name}"
            
            username = f"@{member.username}" if member.username else name
            
            logger.info(f"New member joined: {username} (ID: {member.id})")
            
            # Pick a welcome message (rotate through them)
            msg_index = (member.id % len(WELCOME_MESSAGES))
            welcome_msg = WELCOME_MESSAGES[msg_index]
            
            # Personalize the message
            personalized_msg = f"Hey {username}! {welcome_msg}"
            
            try:
                await update.message.reply_text(personalized_msg)
                logger.info(f"Sent welcome message to {username}")
            except Exception as e:
                logger.error(f"Failed to send welcome message: {e}")

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle errors."""
    logger.error(f"Update {update} caused error {context.error}")

def main():
    """Start the bot."""
    logger.info("=" * 60)
    logger.info("Agentic Bro Welcome Bot Starting")
    logger.info(f"Target Group ID: {TARGET_GROUP_ID}")
    logger.info(f"Log Level: {LOG_LEVEL}")
    logger.info("=" * 60)
    
    # Create application
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Add handler for new chat members
    application.add_handler(MessageHandler(filters.StatusUpdate.NEW_CHAT_MEMBERS, welcome_new_member))
    
    # Add error handler
    application.add_error_handler(error_handler)
    
    # Start polling
    logger.info("Starting polling...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()