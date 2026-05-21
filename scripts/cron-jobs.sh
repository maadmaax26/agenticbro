#!/bin/bash

echo "Adding new member monitor jobs to cron..."

# New member welcome - runs every 60 seconds
cat > /etc/cron.d/new-members-welcome << 'CRONJOB'
*/60 * * * * /Users/efinney/.openclaw/workspace/scripts/monitor-new-members.sh -1003751594817 >> /tmp/new-members-welcome.log 2>&1
CRONJOB

# New member join - runs every 60 seconds  
cat > /etc/cron.d/new-members-join << 'CRONJOB'
*/60 * * * * /Users/efinney/.openclaw/workspace/scripts/monitor-new-members.sh -1003751594817 >> /tmp/new-members-join.log 2>&1
CRONJOB

echo "Cron jobs added successfully"
echo "*/60 * * * * /Users/efinney/.openclaw/workspace/scripts/monitor-new-members.sh -1003751594817 >> /tmp/new-members-welcome.log 2>&1" > /etc/cron.d/new-members-welcome
echo "0 6 * * * /Users/efinney/.openclaw/workspace/scripts/monitor-new-members.sh -1003751594817 >> /tmp/new-members-join.log 2>&1" > /etc/cron.d/new-members-join
