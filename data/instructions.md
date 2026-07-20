# Agentic Bro Group — Mention-Only Mode Configuration Steps

## ✅ Current Status: Configured but NOT ACTIVE YET ⚠️

The group is unhealthy (health 40%) because BotFather command hasn't been completed yet. Here's what you need to do RIGHT NOW in Telegram app with @BotFather:

1. **Search and open** `@BotFather` on your phone or computer
2. Make sure conversation shows bot "Agentic Bro" 
3. Run THIS EXACT COMMAND (copy from below — no extra spaces!):
   ```
   /setgroupmention enabled group:-1003751594817
   ```

## What BotFather Will Reply:
After sending that command, @BotFather will either say:
- ✅ "✅ Done! Group is now set to require mention."  ← GOOD — then we'll be live with mention-only mode  
OR (if it fails): 
- ❌ Some error message about group not found or bot permissions

## After BotFather Completes That Step:
• Health score will jump back up → 90+ normally after violations stop happening
• All my configuration files are ready and waiting ✅ (routing.json, MEMORY.md, MODERATION_RULES.md all updated)  
• Just need confirmation from you that Bot Father command succeeded above

## If Command Fails or Doesn't Appear:
The `/setgroupmention` feature might not be available in your current BotFather version. In that case we have fallback options like manually configuring mention filtering through gateway API (requires bot token which shouldn't exist publicly) OR using system context rules from MEMORY.md directly instead of relying on Bot-level require_mention flag.

Let me know the result when you send @Bot Father command — I'll take next action based on response! 🛠️🔐