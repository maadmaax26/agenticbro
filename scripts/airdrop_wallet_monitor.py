#!/usr/bin/env python3
"""
AGNTCBRO Airdrop Wallet Monitor
Monitors recipient wallets for token sales to determine eligibility for future distributions.

Usage:
    python3 airdrop_wallet_monitor.py [--week 1] [--check-all]

Output:
    - Reports wallets that sold tokens (INELIGIBLE)
    - Reports wallets still holding (ELIGIBLE)
    - Updates distribution CSV with eligibility status
"""

import json
import csv
import os
import time
from datetime import datetime
from pathlib import Path

# Configuration
AGNTCBRO_MINT = "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
RPC_ENDPOINTS = [
    "https://api.mainnet-beta.solana.com",
    "https://solana-api.projectserum.com",
]

# Paths
WORKSPACE = Path("/Users/efinney/.openclaw/workspace")
DISTRIBUTION_CSV = WORKSPACE / "airdrop-weekly-distribution.csv"
ELIGIBILITY_CSV = WORKSPACE / "airdrop-eligibility-tracking.csv"
SNAPSHOT_DIR = WORKSPACE / "airdrop-snapshots"

# Tier thresholds
TIER_THRESHOLDS = {
    "Diamond": 50_000_000,  # 50M+
    "Gold": 10_000_000,    # 10M-50M
    "Silver": 4_000_000,   # 4M-10M
}


def get_wallet_balance(wallet_address: str) -> dict:
    """
    Fetch current AGNTCBRO balance for a wallet.
    Returns dict with balance, slot, and timestamp.
    """
    import urllib.request
    import urllib.error
    
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTokenAccountsByOwner",
        "params": [
            wallet_address,
            {"mint": AGNTCBRO_MINT},
            {"encoding": "jsonParsed"}
        ]
    }
    
    for rpc in RPC_ENDPOINTS:
        try:
            req = urllib.request.Request(
                rpc,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            
            with urllib.request.urlopen(req, timeout=15) as response:
                result = json.loads(response.read().decode('utf-8'))
                
                if 'result' in result and result['result']:
                    accounts = result['result'].get('value', [])
                    total_balance = 0
                    
                    for account in accounts:
                        token_data = account.get('account', {}).get('data', {}).get('parsed', {}).get('info', {})
                        balance = int(token_data.get('tokenAmount', {}).get('amount', 0))
                        total_balance += balance
                    
                    return {
                        "balance": total_balance,
                        "success": True,
                        "rpc": rpc,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                else:
                    return {
                        "balance": 0,
                        "success": True,
                        "rpc": rpc,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    
        except urllib.error.URLError as e:
            print(f"  ⚠️ RPC error ({rpc}): {e}")
            continue
        except Exception as e:
            print(f"  ⚠️ Error: {e}")
            continue
    
    return {"balance": 0, "success": False, "error": "All RPC endpoints failed"}


def get_transaction_history(wallet_address: str, since_signature: str = None) -> list:
    """
    Fetch recent transactions for a wallet to detect AGNTCBRO transfers.
    Returns list of outgoing AGNTCBRO transfers (potential sells).
    """
    import urllib.request
    import urllib.error
    
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getSignaturesForAddress",
        "params": [
            wallet_address,
            {"limit": 50}
        ]
    }
    
    transactions = []
    
    for rpc in RPC_ENDPOINTS:
        try:
            req = urllib.request.Request(
                rpc,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            
            with urllib.request.urlopen(req, timeout=15) as response:
                result = json.loads(response.read().decode('utf-8'))
                
                if 'result' in result:
                    for tx in result['result']:
                        # Note: Full transaction parsing would require getTransaction
                        # For now, we track signature and blockTime
                        transactions.append({
                            "signature": tx.get('signature'),
                            "blockTime": tx.get('blockTime'),
                            "slot": tx.get('slot')
                        })
                    return transactions
                    
        except Exception as e:
            print(f"  ⚠️ Transaction fetch error: {e}")
            continue
    
    return transactions


def check_eligibility(wallet: dict, initial_balance: int, current_balance: int) -> dict:
    """
    Determine if wallet is still eligible for future distributions.
    A wallet is INELIGIBLE if:
    - Current balance < initial airdrop amount (sold some or all tokens)
    - Current balance < tier threshold (fell below required holding)
    """
    tier = wallet.get('tier', 'Silver')
    threshold = TIER_THRESHOLDS.get(tier, 4_000_000)
    airdrop_received = wallet.get('total_tokens', 0)
    
    # Check if they sold any airdropped tokens
    balance_diff = initial_balance - current_balance
    sold_tokens = balance_diff > (airdrop_received * 0.1)  # Allow 10% variance for fees/rounding
    
    # Check if they still hold minimum for tier
    below_threshold = current_balance < threshold
    
    if sold_tokens or below_threshold:
        return {
            "eligible": False,
            "reason": "SOLD_TOKENS" if sold_tokens else "BELOW_THRESHOLD",
            "initial_balance": initial_balance,
            "current_balance": current_balance,
            "tokens_sold": max(0, initial_balance - current_balance),
            "threshold": threshold
        }
    
    return {
        "eligible": True,
        "reason": "HOLDING",
        "initial_balance": initial_balance,
        "current_balance": current_balance,
        "threshold": threshold
    }


def load_distribution_csv(week: int = None) -> list:
    """Load wallet data from distribution CSV."""
    wallets = []
    
    if not DISTRIBUTION_CSV.exists():
        print(f"⚠️ Distribution CSV not found: {DISTRIBUTION_CSV}")
        return wallets
    
    with open(DISTRIBUTION_CSV, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if week and int(row.get('week', 0)) != week:
                continue
            if row.get('wallet_address', '').startswith('['):
                continue  # Skip placeholders
            wallets.append(row)
    
    return wallets


def save_eligibility_report(results: list, week: int):
    """Save eligibility tracking report."""
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    
    # Save detailed JSON report
    report_path = SNAPSHOT_DIR / f"eligibility_week{week}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_path, 'w') as f:
        json.dump({
            "week": week,
            "checked_at": datetime.utcnow().isoformat(),
            "wallets": results
        }, f, indent=2)
    
    # Update master eligibility CSV
    all_results = []
    if ELIGIBILITY_CSV.exists():
        with open(ELIGIBILITY_CSV, 'r') as f:
            reader = csv.DictReader(f)
            all_results = list(reader)
    
    # Add new results
    for result in results:
        all_results.append({
            "wallet_address": result['wallet_address'],
            "tier": result['tier'],
            "week_checked": str(week),
            "initial_balance": str(result.get('initial_balance', 0)),
            "current_balance": str(result.get('current_balance', 0)),
            "eligible": str(result.get('eligible', False)).lower(),
            "reason": result.get('reason', 'UNKNOWN'),
            "checked_at": result.get('checked_at', datetime.utcnow().isoformat())
        })
    
    with open(ELIGIBILITY_CSV, 'w') as f:
        fieldnames = ['wallet_address', 'tier', 'week_checked', 'initial_balance', 'current_balance', 'eligible', 'reason', 'checked_at']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_results)
    
    print(f"\n✅ Eligibility report saved: {report_path}")


def monitor_wallets(week: int = None, check_all: bool = False):
    """
    Main monitoring function.
    
    Args:
        week: Check specific week's wallets
        check_all: Check all weeks
    """
    print("━━━ AGNTCBRO AIRDROP WALLET MONITOR ━━━\n")
    print(f"Token: {AGNTCBRO_MINT}")
    print(f"Time: {datetime.utcnow().isoformat()}\n")
    
    # Load wallets to check
    if check_all:
        wallets = load_distribution_csv()
        print(f"Checking all wallets from distribution...")
    elif week:
        wallets = load_distribution_csv(week)
        print(f"Checking Week {week} wallets...")
    else:
        # Default: check wallets that received distributions
        wallets = load_distribution_csv(week=1)
        print(f"Checking Week 1 wallets (default)...")
    
    if not wallets:
        print("❌ No wallets found to monitor")
        return
    
    print(f"Found {len(wallets)} wallets to check\n")
    
    # Load or create initial balances snapshot
    snapshot_path = SNAPSHOT_DIR / f"initial_balances.json"
    initial_balances = {}
    
    if snapshot_path.exists():
        with open(snapshot_path, 'r') as f:
            initial_balances = json.load(f)
    
    results = []
    eligible_count = 0
    ineligible_count = 0
    
    for i, wallet in enumerate(wallets, 1):
        address = wallet.get('wallet_address')
        tier = wallet.get('tier', 'Unknown')
        airdrop_amount = int(wallet.get('total_tokens', 0))
        
        print(f"[{i}/{len(wallets)}] Checking {address[:8]}... ({tier})")
        
        # Get current balance
        balance_result = get_wallet_balance(address)
        
        if not balance_result.get('success'):
            print(f"  ❌ Failed to fetch balance")
            results.append({
                "wallet_address": address,
                "tier": tier,
                "eligible": None,
                "reason": "RPC_ERROR",
                "error": balance_result.get('error'),
                "checked_at": datetime.utcnow().isoformat()
            })
            time.sleep(3)  # Rate limiting (longer on failure)
            continue
        
        current_balance = balance_result['balance']
        
        # Store initial balance if first check
        if address not in initial_balances:
            initial_balances[address] = {
                "initial_balance": current_balance,
                "airdrop_received": airdrop_amount,
                "tier": tier,
                "first_seen": datetime.utcnow().isoformat()
            }
            print(f"  📝 Initial balance recorded: {current_balance:,.0f} AGNTCBRO")
        
        initial_balance = initial_balances[address]['initial_balance']
        
        # Check eligibility
        eligibility = check_eligibility(
            {"tier": tier, "total_tokens": airdrop_amount},
            initial_balance,
            current_balance
        )
        
        status = "✅ ELIGIBLE" if eligibility['eligible'] else "❌ INELIGIBLE"
        print(f"  {status}: {current_balance:,.0f} AGNTCBRO")
        
        if not eligibility['eligible']:
            print(f"     Reason: {eligibility['reason']}")
            if 'tokens_sold' in eligibility:
                print(f"     Tokens sold: {eligibility['tokens_sold']:,.0f}")
            ineligible_count += 1
        else:
            eligible_count += 1
        
        results.append({
            "wallet_address": address,
            "tier": tier,
            "initial_balance": initial_balance,
            "current_balance": current_balance,
            "eligible": eligibility['eligible'],
            "reason": eligibility['reason'],
            "checked_at": datetime.utcnow().isoformat()
        })
        
        time.sleep(2)  # Rate limiting (increased for public RPC)
    
    # Save initial balances snapshot
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    with open(snapshot_path, 'w') as f:
        json.dump(initial_balances, f, indent=2)
    
    # Save eligibility report
    save_eligibility_report(results, week or 1)
    
    # Summary
    print("\n━━━ MONITORING SUMMARY ━━━")
    print(f"Total wallets checked: {len(wallets)}")
    print(f"✅ Eligible: {eligible_count}")
    print(f"❌ Ineligible: {ineligible_count}")
    print(f"⚠️ Errors: {len(wallets) - eligible_count - ineligible_count}")
    
    # List ineligible wallets
    if ineligible_count > 0:
        print("\n🚫 INELIGIBLE WALLETS:")
        for result in results:
            if result.get('eligible') == False:
                print(f"  • {result['wallet_address'][:12]}... - {result['reason']}")


def generate_week_distribution(week: int, eligible_wallets: list) -> list:
    """
    Generate distribution list for a specific week, excluding ineligible wallets.
    
    Args:
        week: Week number (1-4)
        eligible_wallets: List of wallet addresses still eligible
    
    Returns:
        List of dicts with wallet, tier, and amount for distribution
    """
    distributions = []
    
    for wallet in eligible_wallets:
        # Get tier and calculate amount
        # (Would need to load from original distribution CSV)
        tier = wallet.get('tier', 'Silver')
        
        amounts = {
            'Diamond': 250_000,
            'Gold': 125_000,
            'Silver': 62_500
        }
        
        distributions.append({
            "wallet_address": wallet['wallet_address'],
            "tier": tier,
            "week": week,
            "amount": amounts.get(tier, 62_500),
            "status": "pending"
        })
    
    return distributions


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="AGNTCBRO Airdrop Wallet Monitor")
    parser.add_argument("--week", type=int, help="Check specific week's wallets")
    parser.add_argument("--check-all", action="store_true", help="Check all weeks")
    parser.add_argument("--init-snapshot", action="store_true", help="Create initial balance snapshot only")
    
    args = parser.parse_args()
    
    if args.init_snapshot:
        # Just create initial snapshot without checking eligibility
        print("Creating initial balance snapshot...")
        wallets = load_distribution_csv(args.week)
        
        os.makedirs(SNAPSHOT_DIR, exist_ok=True)
        snapshot_path = SNAPSHOT_DIR / "initial_balances.json"
        initial_balances = {}
        
        if snapshot_path.exists():
            with open(snapshot_path, 'r') as f:
                initial_balances = json.load(f)
        
        for wallet in wallets:
            address = wallet.get('wallet_address')
            if address.startswith('['):
                continue
            
            result = get_wallet_balance(address)
            if result.get('success'):
                initial_balances[address] = {
                    "initial_balance": result['balance'],
                    "tier": wallet.get('tier'),
                    "first_seen": datetime.utcnow().isoformat()
                }
                print(f"✅ {address[:12]}... - {result['balance']:,.0f} AGNTCBRO")
            
            time.sleep(0.3)
        
        with open(snapshot_path, 'w') as f:
            json.dump(initial_balances, f, indent=2)
        
        print(f"\n✅ Initial snapshot saved: {snapshot_path}")
        print(f"   {len(initial_balances)} wallets recorded")
    else:
        monitor_wallets(args.week, args.check_all)