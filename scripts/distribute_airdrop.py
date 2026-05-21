#!/usr/bin/env python3
"""
AGNTCBRO Airdrop Distribution — Eligibility Verified (May 14, 2026)
11 eligible wallets only. 10 wallets removed (sold all tokens).

Usage:
    python3 distribute_airdrop.py --dry-run   # Preview transfers
    python3 distribute_airdrop.py --execute   # Execute transfers
    python3 distribute_airdrop.py --check     # Verify balances
"""

import json, urllib.request, urllib.error, time
from datetime import datetime, timezone

AGNTCBRO_MINT = "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
DISTRIBUTION_WALLET = "J5jv4d6Y7o1T5YMNmbWzhULcXQasvw7BUGaRkoZTdd26"
RPC_ENDPOINT = "https://api.mainnet-beta.solana.com"
DECIMALS = 6

# Eligibility-verified recipients (May 14, 2026)
# 10 wallets REMOVED — sold all tokens (balance = 0)
DIAMOND_AMOUNT = 250_000
GOLD_AMOUNT = 125_000
SILVER_AMOUNT = 62_500

RECIPIENTS = [
    # Diamond Tier (250,000 per quarter)
    ("6aSrey36pvkAKAVvsKL84X4CkDEY4bQCp5hFh8NVcN4j", "Diamond", DIAMOND_AMOUNT, 92378865),
    ("ZzBAYTFDehbwrgzzgN8ecYUyHwokDFxfgbA945ZqGf3", "Diamond", DIAMOND_AMOUNT, 81405778),
    # Gold Tier (125,000 per quarter)
    ("36J6TkbFc3QLEtT5V6H9hjXFKcRU5RKxqtbvtq55GEKc", "Gold", GOLD_AMOUNT, 22855400),
    ("EZwbHQ54PwcsL9iHsaEG1ruMEjVHed8iBmv1esA1rs8n", "Gold", GOLD_AMOUNT, 19749691),
    ("Cmw2B5LxVCrmw4zsdJoN4oRh9d5HErfn7mddepNmdky8", "Gold", GOLD_AMOUNT, 19253554),
    ("21BgRJNLCvpQximq33Q2XiXiTBkMGdshRJp5c5mz77os", "Gold", GOLD_AMOUNT, 11466507),
    ("DJwK6keJYc8EZdSTySCjXBFN2QbWN6Xaf8iKiGWSckbh", "Gold", GOLD_AMOUNT, 10125000),
    # Silver Tier (62,500 per quarter)
    ("GUc6q8eyBbppMa7qdNzCUDeVVqzEcqr33QvuZ63QfMQJ", "Silver", SILVER_AMOUNT, 7728922),
    ("HcHud5ttvTkT4H3RSHQ2D8GCDd6ar5zB94mPz8pekMba", "Silver", SILVER_AMOUNT, 18151326),
    ("GtYdoFGojHz54RXaWw3LQkjF89tdjjETfHv8kW4LRPaH", "Silver", SILVER_AMOUNT, 5429803),
    ("ARzPMLivPH9GsRnwZWymXcPJX9Br1oEH5od3WzoKmX5Y", "Silver", SILVER_AMOUNT, 4287929),
]

# REMOVED (sold all tokens, balance = 0):
# B2YbTVUsC4MTdSCcn7SAFwBcYrZFPxbTBNosNcvGjMuB (Diamond)
# CBReL95M1gS3SaeK7m38mpLKWmeAYk5KqyF9ND4Ta84y (Gold)
# 63878UJuLZPNFTkU99xi4rPqBx4tnvQ5NMk677gwQGsi (Gold)
# 2XipXuKRtwgiV9ZYRg9t485Xw4jH9pTZ6pWJdqYWR6xB (Silver)
# 4vpq2KYHw9L1xZQSZddUWFYTrssYaup1ZAUH7JDjyhDa (Silver)
# 5q7xgZuVPz7Jfip1L6sGgiSzTwxDpLQPzijzMmHeFRU4 (Silver)
# H3XibQLNUhxzCfCSuXLDk91C4syvvVxu1BM4VpjzbT25 (Silver)
# 7v24h67inspXXHkwUf96937WK3oJfXAFtDDsk7DEsbK4 (Silver)
# BzK9pyjGhvSDcqWHRBt5P52Eh3sEWkrAhKT24gYRUp2C (Silver)
# BZbk5WEKLcbc7SUaS76jCUmhJiLvkNXbYcWrcJ3K1x4W (Silver)


def lamports_from_natural(amount, decimals=6):
    return amount * (10 ** decimals)


def get_balance(wallet):
    payload = json.dumps({
        "jsonrpc": "2.0", "id": 1,
        "method": "getTokenAccountsByOwner",
        "params": [wallet, {"mint": AGNTCBRO_MINT}, {"encoding": "jsonParsed"}]
    }).encode()
    try:
        req = urllib.request.Request(
            RPC_ENDPOINT, data=payload,
            headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=15) as r:
            result = json.loads(r.read().decode())
            if result.get("result") and result["result"].get("value"):
                return sum(int(a["account"]["data"]["parsed"]["info"]["tokenAmount"]["amount"])
                           for a in result["result"]["value"])
            return 0
    except Exception as e:
        print(f"  ⚠️ Error: {e}")
        return -1


def check_all():
    print("━" * 50)
    print("AGNTCBRO AIRDROP — ELIGIBILITY VERIFICATION")
    print(f"Date: {datetime.now(timezone.utc).isoformat()}")
    print(f"Wallets: {len(RECIPIENTS)} eligible")
    print("━" * 50)

    for i, (wallet, tier, amount, snapshot) in enumerate(RECIPIENTS, 1):
        bal = get_balance(wallet)
        time.sleep(2)
        human = bal / 10**DECIMALS if bal >= 0 else "ERROR"
        status = "✅" if bal >= snapshot * 0.9 else "❌ SOLD"
        print(f"[{i:2d}/{len(RECIPIENTS)}] {wallet[:8]}... ({tier:7s}) {status} {human:,.0f} AGNTCBRO")


def dry_run():
    print("━" * 50)
    print("AGNTCBRO AIRDROP — DRY RUN")
    print(f"Date: {datetime.now(timezone.utc).isoformat()}")
    print(f"Distribution wallet: {DISTRIBUTION_WALLET}")
    print("━" * 50)

    diamond_count = sum(1 for _, t, _, _ in RECIPIENTS if t == "Diamond")
    gold_count = sum(1 for _, t, _, _ in RECIPIENTS if t == "Gold")
    silver_count = sum(1 for _, t, _, _ in RECIPIENTS if t == "Silver")
    total = diamond_count * DIAMOND_AMOUNT + gold_count * GOLD_AMOUNT + silver_count * SILVER_AMOUNT

    print(f"\n💎 Diamond: {diamond_count} × {DIAMOND_AMOUNT:,} = {diamond_count * DIAMOND_AMOUNT:,}")
    print(f"🥇 Gold:    {gold_count} × {GOLD_AMOUNT:,} = {gold_count * GOLD_AMOUNT:,}")
    print(f"🥈 Silver:  {silver_count} × {SILVER_AMOUNT:,} = {silver_count * SILVER_AMOUNT:,}")
    print(f"   Total:   {len(RECIPIENTS)} wallets × 1 quarter = {total:,} AGNTCBRO")
    print()

    for i, (wallet, tier, amount, snapshot) in enumerate(RECIPIENTS, 1):
        print(f"[{i:2d}] {wallet[:12]}... ({tier:7s}): {amount:,} AGNTCBRO")

    print(f"\n⚠️  To execute, run: python3 distribute_airdrop.py --execute")
    print(f"⚠️  Requires: {total:,} AGNTCBRO in distribution wallet + ~0.01 SOL fees")


def execute():
    print("━" * 50)
    print("AGNTCBRO AIRDROP — EXECUTE")
    print("━" * 50)
    print()
    print("⚠️  MANUAL TRANSFER REQUIRED")
    print("This script verifies balances but does NOT execute on-chain transfers.")
    print()
    print("Distribution wallet:", DISTRIBUTION_WALLET)
    print()
    print("Transfer the following amounts using Phantom/Backpack batch send:")
    print()

    for i, (wallet, tier, amount, snapshot) in enumerate(RECIPIENTS, 1):
        print(f"{i}. {wallet} — {amount:,} AGNTCBRO ({tier})")

    total = sum(a for _, _, a, _ in RECIPIENTS)
    print(f"\nTotal to distribute: {total:,} AGNTCBRO")
    print(f"Transaction fees: ~0.01 SOL")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="AGNTCBRO Airdrop Distribution (Verified May 14, 2026)")
    parser.add_argument("--dry-run", action="store_true", help="Preview transfers")
    parser.add_argument("--execute", action="store_true", help="Show transfer instructions")
    parser.add_argument("--check", action="store_true", help="Verify all wallet balances")
    args = parser.parse_args()

    if args.check:
        check_all()
    elif args.dry_run:
        dry_run()
    elif args.execute:
        execute()
    else:
        dry_run()


if __name__ == "__main__":
    main()