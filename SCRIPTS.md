# Scans

### New Member Monitor

- `monitor-new-members.sh` - Scans Telegram groups for new members
  - Group ID: -1003751594817
  - Last run: Fri Apr 17 22:18:47 EDT 2026
  - Status: Completed - No new members detected

### Cron Jobs

- `new-member-welcome` - Runs at specified intervals
  - Status: Running successfully

- `buy-energy-boost` - Runs hourly for energy boost purchases
  - Status: 6 consecutive errors detected
  - Need to investigate cooldown logic

- `token-reminder` - Runs on token usage events
  - Status: Errors due to cooldown
  - Need to verify cooldown duration settings
