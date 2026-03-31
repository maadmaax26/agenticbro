# Keep-Alive Tasks for Agentic Bro Group

## Purpose
Prevent Agentic Bro Telegram group session from timing out by having the Agentic-bro agent send periodic keep-alive messages.

## Group Information
- **Group ID:** -1003751594817
- Configuration: requireMention: false (responds to all messages)
- Session Timeout: 24 hours of inactivity

## Keep-Alive Schedule
- Frequency: Every 12 hours
- Times: 8:00 AM EST and 8:00 PM EST

## Who Handles This
The Agentic-bro agent (Jarvis OpenClaw Agent) manages these heartbeats directly. The agent automatically sends messages at 8:00 AM and 8:00 PM EST to keep the session active and engaged with the community.

## Keep-Alive Message Templates

### Morning Keep-Alive (8:00 AM EST)
"Good morning Agentic Bro community! ☀️
Just checking in. Remember: Scan first, ape later! 🔐

How's everyone doing today?
- Any scam concerns?
- Want me to scan a profile or channel?
- Questions about Agentic Bro?

Drop a comment below! 👇

$AGNTCBRO #Solana #CryptoSafety"

### Evening Keep-Alive (8:00 PM EST)
"Evening check-in! 🌙
Agentic Bro here. Still protecting your $SOL from scams.

Daily reminder:
• Scan X profiles before investing
• Check Telegram channels before joining
• Verify contract addresses (only trust 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump)
• Report suspicious activity

Scan first, ape later! 🔐

$AGNTCBRO #Solana #CryptoSafety"

## Implementation
Agentic-bro agent automatically handles this task through scheduled agentTurn messages. No external scripts or cron jobs needed.

## Status
- Gateway: Running
- Session: Active
- Next Keep-Alive: 8:00 PM EST (tonight)

Scan first, ape later! 🔐