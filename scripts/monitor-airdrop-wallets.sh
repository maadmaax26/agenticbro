#!/bin/bash
# AGNTCBRO Airdrop Wallet Monitor
# Checks wallet eligibility for future distributions

SCRIPT_DIR="/Users/efinney/.openclaw/workspace/scripts"
MONITOR_SCRIPT="$SCRIPT_DIR/airdrop_wallet_monitor.py"

# Usage
usage() {
    echo "━━━ AGNTCBRO Airdrop Wallet Monitor ━━━"
    echo ""
    echo "Usage: bash $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  init              Create initial balance snapshot (run after Week 1 distribution)"
    echo "  check             Check eligibility for next week's distribution"
    echo "  check-week N      Check specific week's wallets"
    echo "  check-all         Check all wallets across all weeks"
    echo ""
    echo "Examples:"
    echo "  bash $0 init                    # Create initial snapshot"
    echo "  bash $0 check                    # Check Week 1 wallets"
    echo "  bash $0 check-week 2             # Check Week 2 wallets"
    echo "  bash $0 check-all                # Check all weeks"
    echo ""
}

# Main
case "$1" in
    init)
        echo "Creating initial balance snapshot..."
        python3 "$MONITOR_SCRIPT" --init-snapshot
        ;;
    check)
        echo "Checking wallet eligibility..."
        python3 "$MONITOR_SCRIPT" --week "${2:-1}"
        ;;
    check-week)
        if [ -z "$2" ]; then
            echo "Error: Week number required"
            usage
            exit 1
        fi
        echo "Checking Week $2 wallets..."
        python3 "$MONITOR_SCRIPT" --week "$2"
        ;;
    check-all)
        echo "Checking all wallets..."
        python3 "$MONITOR_SCRIPT" --check-all
        ;;
    *)
        usage
        ;;
esac