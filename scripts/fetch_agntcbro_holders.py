import urllib.request
import json
import time

MINT = "52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"

# More endpoints with better mobile/client headers
RPC_ENDPOINTS = [
    "https://solana-rpc.publicnode.com",
    "https://rpc.ankr.com/solana", 
    "https://api.mainnet-beta.solana.com",
    "https://rpc.solana.com",
    "https://solana.api.rpcpool.com",
]

headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "AgenticBro/1.0",
}

def rpc_call(method, params, rpc_url):
    payload = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params
    }).encode()
    req = urllib.request.Request(rpc_url, data=payload, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())

# Step 1: Get largest token accounts
print("Fetching largest token accounts...")
accounts = None
for rpc in RPC_ENDPOINTS:
    try:
        data = rpc_call("getTokenLargestAccounts", [MINT], rpc)
        if data.get("result"):
            accounts = data["result"]["value"]
            print(f"✅ Got {len(accounts)} accounts from {rpc}")
            break
    except Exception as e:
        print(f"  {rpc}: {e}")
        time.sleep(1)
        continue

if not accounts:
    print("❌ All RPCs failed. Trying DexScreener holder data...")
    # Fallback: DexScreener pair info
    try:
        url = "https://api.dexscreener.com/latest/dex/tokens/52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
        req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            ds = json.loads(resp.read())
            for p in ds.get("pairs", [])[:1]:
                print(f"  Token: {p.get('baseToken',{}).get('symbol','?')}")
                print(f"  Price: ${p.get('priceUsd','?')}")
                print(f"  Market Cap: ${p.get('marketCap','?'):,}" if isinstance(p.get('marketCap'), (int,float)) else f"  Market Cap: {p.get('marketCap','?')}")
    except Exception as e:
        print(f"  DexScreener error: {e}")
    exit(1)

# Step 2: Resolve owners
print("\nResolving token account owners...")
holders = []
for acct in accounts[:20]:
    token_acct = acct["address"]
    amt_raw = acct["amount"]
    dec = acct.get("decimals", 0)
    ui_amount = int(amt_raw) / (10 ** dec) if dec > 0 else int(amt_raw)
    
    # Get account info to find owner
    owner = "?"
    for rpc in RPC_ENDPOINTS:
        try:
            data = rpc_call("getAccountInfo", [token_acct, {"encoding": "jsonParsed"}], rpc)
            if data.get("result") and data["result"].get("value"):
                info = data["result"]["value"]["data"]["parsed"]["info"]
                owner = info.get("owner", "?")
            break
        except:
            continue
    time.sleep(0.5)  # Rate limit courtesy
    holders.append({"owner": owner, "amount": ui_amount, "token_account": token_acct})
    print(f"  {owner[:8]}...{owner[-4:]}  →  {ui_amount:>15,.0f} AGNTCBRO")

# Step 3: Classify tiers
print("\n" + "="*70)
print("AGNTCBRO AIRDROP TIER CLASSIFICATION")
print("="*70)

# Known system accounts to exclude
EXCLUDE_PATTERNS = ["pAMMBay", "1111111", "Sysvar", "pump"]

diamond = []; gold = []; silver = []; bronze = []; holder_plus = []; sub = []

for h in holders:
    owner = h["owner"]
    amt = h["amount"]
    excluded = any(pat in owner for pat in EXCLUDE_PATTERNS)
    if excluded:
        h["excluded"] = True
        continue
    
    if amt >= 50_000_000:
        diamond.append(h)
    elif amt >= 10_000_000:
        gold.append(h)
    elif amt >= 5_000_000:
        silver.append(h)
    elif amt >= 4_000_000:
        bronze.append(h)
    elif amt >= 1_000_000:
        holder_plus.append(h)
    else:
        sub.append(h)

print(f"\n💎 DIAMOND (50M+ tokens): {len(diamond)} wallets")
for h in diamond:
    print(f"   {h['owner']}  {h['amount']:>15,.0f}")

print(f"\n🥇 GOLD (10M-50M tokens): {len(gold)} wallets")
for h in gold:
    print(f"   {h['owner']}  {h['amount']:>15,.0f}")

print(f"\n🥈 SILVER (5M-10M tokens): {len(silver)} wallets")
for h in silver:
    print(f"   {h['owner']}  {h['amount']:>15,.0f}")

print(f"\n🥉 BRONZE (4M-5M tokens): {len(bronze)} wallets")
for h in bronze:
    print(f"   {h['owner']}  {h['amount']:>15,.0f}")

print(f"\n🪙 HOLDER (1M-4M tokens): {len(holder_plus)} wallets — below 4M min")
for h in holder_plus:
    print(f"   {h['owner']}  {h['amount']:>15,.0f}")

print(f"\n  SUB-HOLDER (<1M tokens): {len(sub)} wallets — no airdrop")

# Airdrop calculations
total_airdrop = 0
diamond_total = len(diamond) * 135000
gold_total = len(gold) * 60000
silver_total = len(silver) * 33750
bronze_total = len(bronze) * 15000
total_airdrop = diamond_total + gold_total + silver_total + bronze_total

print(f"\n{'='*70}")
print(f"AIRDROP ALLOCATION (from top 20 accounts)")
print(f"{'='*70}")
print(f"💎 Diamond:  {len(diamond)} × 135,000 = {diamond_total:>12,}")
print(f"🥇 Gold:     {len(gold)} × 60,000  = {gold_total:>12,}")
print(f"🥈 Silver:   {len(silver)} × 33,750  = {silver_total:>12,}")
print(f"🥉 Bronze:   {len(bronze)} × 15,000  = {bronze_total:>12,}")
print(f"─────────────────────────────────────")
print(f"   Total:    {len(diamond)+len(gold)+len(silver)+len(bronze)} wallets    {total_airdrop:>12,} AGNTCBRO")
print(f"\n⚠️  Pool available: 30,000,000 AGNTCBRO")
print(f"⚠️  NOTE: Only top 20 accounts shown. Full snapshot needs all holders.")
print(f"⚠️  Wallet age (7+ days) and social tasks must be verified separately.")