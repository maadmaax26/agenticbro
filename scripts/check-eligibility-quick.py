#!/usr/bin/env python3
"""Quick eligibility check for the 21 wallets from the updated airdrop list."""
import json, urllib.request, time
from datetime import datetime, timezone

AGNTCBRO_MINT = "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
RPC_ENDPOINTS = [
    "https://solana-api.projectserum.com",
    "https://api.mainnet-beta.solana.com",
]
DECIMALS = 6

WALLETS = [
    ("6aSrey36pvkAKAVvsKL84X4CkDEY4bQCp5hFh8NVcN4j", "Diamond", 91367587),
    ("ZzBAYTFDehbwrgzzgN8ecYUyHwokDFxfgbA945ZqGf3", "Diamond", 81155778),
    ("B2YbTVUsC4MTdSCcn7SAFwBcYrZFPxbTBNosNcvGjMuB", "Diamond", 66142895),
    ("CBReL95M1gS3SaeK7m38mpLKWmeAYk5KqyF9ND4Ta84y", "Gold", 38795653),
    ("36J6TkbFc3QLEtT5V6H9hjXFKcRU5RKxqtbvtq55GEKc", "Gold", 22730401),
    ("EZwbHQ54PwcsL9iHsaEG1ruMEjVHed8iBmv1esA1rs8n", "Gold", 19624691),
    ("Cmw2B5LxVCrmw4zsdJoN4oRh9d5HErfn7mddepNmdky8", "Gold", 19128554),
    ("63878UJuLZPNFTkU99xi4rPqBx4tnvQ5NMk677gwQGsi", "Gold", 10691783),
    ("21BgRJNLCvpQximq33Q2XiXiTBkMGdshRJp5c5mz77os", "Gold", 10641507),
    ("DJwK6keJYc8EZdSTySCjXBFN2QbWN6Xaf8iKiGWSckbh", "Gold", 10000000),
    ("2XipXuKRtwgiV9ZYRg9t485Xw4jH9pTZ6pWJdqYWR6xB", "Silver", 7735980),
    ("4vpq2KYHw9L1xZQSZddUWFYTrssYaup1ZAUH7JDjyhDa", "Silver", 7680839),
    ("GUc6q8eyBbppMa7qdNzCUDeVVqzEcqr33QvuZ63QfMQJ", "Silver", 7666423),
    ("5q7xgZuVPz7Jfip1L6sGgiSzTwxDpLQPzijzMmHeFRU4", "Silver", 7630909),
    ("H3XibQLNUhxzCfCSuXLDk91C4syvvVxu1BM4VpjzbT25", "Silver", 6888810),
    ("7v24h67inspXXHkwUf96937WK3oJfXAFtDDsk7DEsbK4", "Silver", 6394078),
    ("BzK9pyjGhvSDcqWHRBt5P52Eh3sEWkrAhKT24gYRUp2C", "Silver", 6383753),
    ("HcHud5ttvTkT4H3RSHQ2D8GCDd6ar5zB94mPz8pekMba", "Silver", 5802662),
    ("GtYdoFGojHz54RXaWw3LQkjF89tdjjETfHv8kW4LRPaH", "Silver", 5367303),
    ("ARzPMLivPH9GsRnwZWymXcPJX9Br1oEH5od3WzoKmX5Y", "Silver", 4225429),
    ("BZbk5WEKLcbc7SUaS76jCUmhJiLvkNXbYcWrcJ3K1x4W", "Silver", 4038126),
]

TIER_MIN = {"Diamond": 50_000_000, "Gold": 10_000_000, "Silver": 4_000_000}

def get_balance(addr):
    payload = json.dumps({
        "jsonrpc": "2.0", "id": 1,
        "method": "getTokenAccountsByOwner",
        "params": [addr, {"mint": AGNTCBRO_MINT}, {"encoding": "jsonParsed"}]
    }).encode()
    for rpc in RPC_ENDPOINTS:
        try:
            req = urllib.request.Request(rpc, data=payload, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=20) as r:
                result = json.loads(r.read().decode())
                if result.get("result") and result["result"].get("value"):
                    total = sum(int(a["account"]["data"]["parsed"]["info"]["tokenAmount"]["amount"]) for a in result["result"]["value"])
                    return total
                return 0
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"  ⚠️ Rate limited on {rpc.split('//')[1][:20]}, trying next...")
                time.sleep(3)
                continue
            print(f"  ⚠️ HTTP error on {rpc.split('//')[1][:20]}: {e}")
            continue
        except Exception as e:
            print(f"  ⚠️ Error on {rpc.split('//')[1][:20]}: {e}")
            continue
    print(f"  ❌ All RPCs failed for {addr[:8]}")
    return -1

print("━" * 60)
print("AGNTCBRO AIRDROP ELIGIBILITY CHECK")
print(f"Time: {datetime.now(timezone.utc).isoformat()}")
print(f"Wallets: {len(WALLETS)} | Token: {AGNTCBRO_MINT[:8]}...")
print("━" * 60)

eligible = []
ineligible = []
errors = []

for i, (addr, tier, snapshot_bal) in enumerate(WALLETS, 1):
    print(f"\n[{i}/{len(WALLETS)}] {addr[:8]}... ({tier}, snapshot: {snapshot_bal:,})")
    bal = get_balance(addr)
    time.sleep(3)  # rate limit - 3s between requests

    if bal < 0:
        print(f"  ❌ ERROR - could not fetch balance")
        errors.append((addr, tier, snapshot_bal))
        continue

    human_bal = bal / 10**DECIMALS
    threshold = TIER_MIN[tier]

    # Check eligibility
    still_holding = bal >= snapshot_bal * 0.9  # allow 10% variance
    above_threshold = bal >= threshold

    if still_holding and above_threshold:
        status = "✅ ELIGIBLE"
        eligible.append((addr, tier, snapshot_bal, bal))
    else:
        reason = []
        if not still_holding:
            reason.append(f"SOLD ({snapshot_bal:,} → {bal:,})")
        if not above_threshold:
            reason.append(f"BELOW_THRESHOLD ({bal:,} < {threshold:,})")
        status = f"❌ INELIGIBLE ({', '.join(reason)})"
        ineligible.append((addr, tier, snapshot_bal, bal, reason))

    print(f"  {status}")
    print(f"  Current: {human_bal:,.0f} AGNTCBRO | Snapshot: {snapshot_bal:,}")

print("\n" + "━" * 60)
print("ELIGIBILITY SUMMARY")
print("━" * 60)
print(f"✅ Eligible:   {len(eligible)}/{len(WALLETS)}")
print(f"❌ Ineligible: {len(ineligible)}/{len(WALLETS)}")
print(f"⚠️  Errors:    {len(errors)}/{len(WALLETS)}")

if ineligible:
    print(f"\n🚫 INELIGIBLE WALLETS:")
    for addr, tier, snap, bal, reason in ineligible:
        print(f"  • {addr[:12]}... ({tier}) - {', '.join(reason)}")

if eligible:
    print(f"\n✅ ELIGIBLE WALLETS:")
    for addr, tier, snap, bal in eligible:
        print(f"  • {addr[:12]}... ({tier}) - holding {bal:,}")

print(f"\nTotal eligible tokens to distribute:")
tier_amounts = {"Diamond": 250000, "Gold": 125000, "Silver": 62500}
total = sum(tier_amounts[t] for a, t, s, b in eligible)
print(f"  {total:,} AGNTCBRO")