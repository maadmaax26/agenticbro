#!/usr/bin/env python3
"""
AGNTCBRO Airdrop Week 2 Distribution
Sends AGNTCBRO tokens to all eligible recipients using Solana RPC.

Usage:
    python3 distribute_week2.py --dry-run  # Preview transfers
    python3 distribute_week2.py --execute # Execute transfers
"""

import json
import time
import urllib.request
import urllib.error
import base58
from datetime import datetime

# Configuration
AGNTCBRO_MINT = "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
RPC_ENDPOINT = "https://api.mainnet-beta.solana.com"

# Distribution amounts (in natural units, not lamports)
DIAMOND_AMOUNT = 250_000  # 250K tokens
GOLD_AMOUNT = 125_000     # 125K tokens
DECIMALS = 6

# Recipients from eligibility check
RECIPIENTS = [
    # Diamond Tier (250,000 each)
    ("6aSrey36pvkAKAVvsKL84X4CkDEY4bQCp5hFh8NVcN4j", "Diamond", DIAMOND_AMOUNT),
    ("ZzBAYTFDehbwrgzzgN8ecYUyHwokDFxfgbA945ZqGf3", "Diamond", DIAMOND_AMOUNT),
    ("B2YbTVUsC4MTdSCcn7SAFwBcYrZFPxbTBNosNcvGjMuB", "Diamond", DIAMOND_AMOUNT),
    ("Em65he1pkAB3eGiMhd76qUujefmJ2KVwwXqxdT2YzMmE", "Diamond", DIAMOND_AMOUNT),
    ("3NJWD1M1uG9mwWLkGWFQ3LqqDCh1pJSDGfQXmb3fdADH", "Diamond", DIAMOND_AMOUNT),
    ("5S5VVx5shTBEZfqxBiePif4Y5mmFo1FMxZgLiuHfphz3", "Diamond", DIAMOND_AMOUNT),
    ("UpFr5jN23yd6D2neDSqnG3QnkSmpWN6xXpJq7cpWsxf", "Diamond", DIAMOND_AMOUNT),
    # Gold Tier (125,000 each)
    ("9SFtm4S5QNDdMuWwgpy8E7ZhqRfgmjNtE1JLqkzPKj9F", "Gold", GOLD_AMOUNT),
    ("J4wsP4HZHDL5SPa7kZBQGcyksrCdHoYgVFigiW1qFGuC", "Gold", GOLD_AMOUNT),
    ("CBReL95M1gS3SaeK7m38mpLKWmeAYk5KqyF9ND4Ta84y", "Gold", GOLD_AMOUNT),
    ("9i94aZP57tD8Lz5RxZqXoHPZKvv1i2dX6LQzK5z8EyzH", "Gold", GOLD_AMOUNT),
    ("7erEFC8AoEQW1WL5pfF15ArRRQ4uycTTA6hyncjxVLJD", "Gold", GOLD_AMOUNT),
    ("36J6TkbFc3QLEtT5V6H9hjXFKcRU5RKxqtbvtq55GEKc", "Gold", GOLD_AMOUNT),
    ("EZwbHQ54PwcsL9iHsaEG1ruMEjVHed8iBmv1esA1rs8n", "Gold", GOLD_AMOUNT),
    ("Cmw2B5LxVCrmw4zsdJoN4oRh9d5HErfn7mddepNmdky8", "Gold", GOLD_AMOUNT),
    ("A4R3nauxCbbddvm54UP6GD64SoY8BVftDJLd1hMA4yNB", "Gold", GOLD_AMOUNT),
    ("63878UJuLZPNFTkU99xi4rPqBx4tnvQ5NMk677gwQGsi", "Gold", GOLD_AMOUNT),
    ("21BgRJNLCvpQximq33Q2XiXiTBkMGdshRJp5c5mz77os", "Gold", GOLD_AMOUNT),
    ("DJwK6keJYc8EZdSTySCjXBFN2QbWN6Xaf8iKiGWSckbh", "Gold", GOLD_AMOUNT),
]

def lamports_from_natural(amount: int, decimals: int = 6) -> int:
    """Convert natural token amount to lamports."""
    return amount * (10 ** decimals)

def get_balance(wallet: str) -> int:
    """Get AGNTCBRO balance for a wallet."""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTokenAccountsByOwner",
        "params": [
            wallet,
            {"mint": AGNTCBRO_MINT},
            {"encoding": "jsonParsed"}
        ]
    }
    
    try:
        req = urllib.request.Request(
            RPC_ENDPOINT,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
            
            if 'result' in result and result['result']:
                accounts = result['result'].get('value', [])
                total = 0
                for account in accounts:
                    token_data = account.get('account', {}).get('data', {}).get('parsed', {}).get('info', {})
                    total += int(token_data.get('tokenAmount', {}).get('amount', 0))
                return total
            return 0
    except Exception as e:
        print(f"  ⚠️ Error fetching balance: {e}")
        return -1

def main():
    import argparse
    parser = argparse.ArgumentParser(description='AGNTCBRO Week 2 Distribution')
    parser.add_argument('--dry-run', action='store_true', help='Preview transfers without executing')
    parser.add_argument('--execute', action='store_true', help='Execute transfers')
    parser.add_argument('--check-balance', type=str, help='Check balance of a wallet')
    args = parser.parse_args()
    
    if args.check_balance:
        print(f"Checking balance of {args.check_balance[:8]}...")
        balance = get_balance(args.check_balance)
        if balance >= 0:
            print(f"  Balance: {balance / 10**DECIMALS:,.0f} AGNTCBRO")
        return
    
    print("━━━ AGNTCBRO AIRDROP WEEK 2 ━━━")
    print(f"Time: {datetime.utcnow().isoformat()}")
    print(f"Token: {AGNTCBRO_MINT}")
    print()
    
    # Calculate totals
    diamond_total = sum(r[2] for r in RECIPIENTS if r[1] == "Diamond")
    gold_total = sum(r[2] for r in RECIPIENTS if r[1] == "Gold")
    total_tokens = diamond_total + gold_total
    
    print("━━━ DISTRIBUTION SUMMARY ━━━")
    print(f"Diamond Tier: {len([r for r in RECIPIENTS if r[1] == 'Diamond'])} wallets × {DIAMOND_AMOUNT:,} = {diamond_total:,} AGNTCBRO")
    print(f"Gold Tier: {len([r for r in RECIPIENTS if r[1] == 'Gold'])} wallets × {GOLD_AMOUNT:,} = {gold_total:,} AGNTCBRO")
    print(f"Total: {total_tokens:,} AGNTCBRO")
    print()
    
    if args.dry_run:
        print("━━━ DRY RUN MODE ━━━")
        print("No transfers will be executed.")
        print()
        
        print("━━━ RECIPIENTS ━━━")
        for i, (wallet, tier, amount) in enumerate(RECIPIENTS, 1):
            print(f"[{i:2d}] {wallet[:8]}... ({tier:7s}): {amount:,} AGNTCBRO")
        
        print()
        print(f"To execute transfers, run:")
        print(f"  python3 distribute_week2.py --execute")
        print()
        print("⚠️  REQUIREMENTS:")
        print("  1. Distribution wallet private key in ~/.config/solana/id.json")
        print("  2. At least 3,250,000 AGNTCBRO in distribution wallet")
        print("  3. At least 0.05 SOL for transaction fees")
        print()
        print("DISTRIBUTION WALLET ADDRESS:")
        print("  J5jv4d6Y7o1T5YMNmbWzhULcXQasvw7BUGaRkoZTdd26")
        return
    
    if args.execute:
        print("━━━ EXECUTING TRANSFERS ━━━")
        print()
        print("⚠️  This will send AGNTCBRO from your wallet to 19 recipients.")
        print("⚠️  Make sure you have:")
        print("    • 3,250,000 AGNTCBRO in the wallet")
        print("    • ~0.05 SOL for transaction fees")
        print()
        
        # Check wallet balance first
        print("Checking distribution wallet balance...")
        dist_wallet = "J5jv4d6Y7o1T5YMNmbWzhULcXQasvw7BUGaRkoZTdd26"
        balance = get_balance(dist_wallet)
        if balance < 0:
            print("❌ Could not check wallet balance")
            return
        
        print(f"  Distribution wallet: {balance / 10**DECIMALS:,.0f} AGNTCBRO")
        
        required = lamports_from_natural(total_tokens)
        if balance < required:
            print(f"❌ Insufficient balance. Need {total_tokens:,} AGNTCBRO, have {balance / 10**DECIMALS:,.0f}")
            return
        
        print(f"✅ Sufficient balance ({total_tokens:,} AGNTCBRO required)")
        print()
        
        # TODO: Implement actual transfer using @solana/web3.js or similar
        # For now, output instructions for manual transfer
        print("━━━ MANUAL TRANSFER INSTRUCTIONS ━━━")
        print()
        print("The distribution wallet needs to be loaded in Phantom/Backpack to execute transfers.")
        print()
        print("Option 1: Use the CSV file with a batch sender:")
        print("  File: /workspace/airdrop-week2-transfers.csv")
        print()
        print("Option 2: Manual transfers via Phantom:")
        print(f"  Token: {AGNTCBRO_MINT}")
        print(f"  Diamond wallets (7): {DIAMOND_AMOUNT:,} AGNTCBRO each")
        print(f"  Gold wallets (12): {GOLD_AMOUNT:,} AGNTCBRO each")
        print()
        print("After completing transfers, update the distribution status file.")
        return
    
    # Default: show summary
    print("Run with --dry-run to preview transfers")
    print("Run with --execute to execute transfers")

if __name__ == "__main__":
    main()