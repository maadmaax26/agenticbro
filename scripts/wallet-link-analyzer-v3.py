#!/usr/bin/env python3
"""
Wallet Link Analyzer v3 - Heavy Rate Limiting + Retry
"""
import json
import urllib.request
import time
from datetime import datetime
from collections import defaultdict

# Rate limiting
LAST_CALL_TIME = 0
MIN_INTERVAL = 1.0  # 1 second between calls
RETRY_DELAY = 5  # 5 seconds on rate limit

def rpc_call(method, params, retries=3):
    """Make Solana RPC call with rate limiting and retry"""
    global LAST_CALL_TIME
    
    for attempt in range(retries):
        # Rate limit
        elapsed = time.time() - LAST_CALL_TIME
        if elapsed < MIN_INTERVAL:
            time.sleep(MIN_INTERVAL - elapsed)
        
        data = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params
        }
        req = urllib.request.Request(
            "https://api.mainnet-beta.solana.com",
            data=json.dumps(data).encode(),
            headers={"Content-Type": "application/json"}
        )
        
        try:
            LAST_CALL_TIME = time.time()
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries - 1:
                print(f"  ⚠️ Rate limited, waiting {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY)
                continue
            raise
    
    return None

def get_balance(wallet):
    """Get SOL balance"""
    result = rpc_call("getAccountInfo", [wallet, {"encoding": "base64"}])
    value = result.get("result", {}).get("value", {})
    if value is None:
        return None
    lamports = value.get("lamports", 0)
    return lamports / 1_000_000_000

def get_transactions(wallet, limit=10):
    """Get recent transactions (reduced limit)"""
    result = rpc_call("getSignaturesForAddress", [wallet, {"limit": limit}])
    return result.get("result", [])

def get_transaction_details(sig):
    """Get transaction details"""
    result = rpc_call("getTransaction", [sig, {"encoding": "json"}])
    return result.get("result")

def analyze_wallets(wallets):
    """Analyze wallets for connections"""
    print("=" * 70)
    print("🔍 WALLET LINK ANALYZER v3 (Heavy Rate Limiting)")
    print("=" * 70)
    print()
    
    # Get balances
    print("📊 BALANCES:")
    print("-" * 70)
    for i, w in enumerate(wallets, 1):
        balance = get_balance(w)
        if balance is None:
            print(f"Wallet {i}: {w[:12]}...{w[-4:]} - INVALID/EMPTY")
        else:
            print(f"Wallet {i}: {w[:12]}...{w[-4:]} - {balance:.6f} SOL")
    print()
    
    # Analyze transfers
    print("🔗 ANALYZING TRANSFERS...")
    print("-" * 70)
    
    all_interactions = []
    
    for wallet_idx, wallet in enumerate(wallets):
        print(f"\nWallet {wallet_idx + 1} ({wallet[:12]}...{wallet[-4:]}):")
        
        # Get last 10 transactions
        txs = get_transactions(wallet, limit=10)
        print(f"  Found {len(txs)} transactions")
        
        for tx in txs[:5]:  # Only check first 5 to avoid rate limit
            sig = tx.get("signature")
            block_time = tx.get("blockTime", 0)
            dt = datetime.fromtimestamp(block_time).strftime('%Y-%m-%d %H:%M')
            
            print(f"  Checking {sig[:20]}... ({dt})")
            
            details = get_transaction_details(sig)
            if details:
                message = details.get("transaction", {}).get("message", {})
                meta = details.get("meta", {})
                
                if isinstance(message, dict):
                    accounts = message.get("accountKeys", [])
                    pre_bal = meta.get("preBalances", [])
                    post_bal = meta.get("postBalances", [])
                    
                    # Find all wallets involved
                    for i, acc in enumerate(accounts):
                        if acc in wallets and i < len(pre_bal) and i < len(post_bal):
                            diff = (post_bal[i] - pre_bal[i]) / 1_000_000_000
                            
                            if diff < 0:  # This wallet sent
                                # Find receiver
                                for j, other_acc in enumerate(accounts):
                                    if other_acc in wallets and other_acc != acc and j < len(pre_bal):
                                        other_diff = (post_bal[j] - pre_bal[j]) / 1_000_000_000
                                        if other_diff > 0:  # Other wallet received
                                            all_interactions.append({
                                                "signature": sig,
                                                "timestamp": datetime.fromtimestamp(block_time).strftime('%Y-%m-%d %H:%M:%S'),
                                                "from_wallet": acc,
                                                "to_wallet": other_acc,
                                                "amount_sol": abs(diff)
                                            })
                                            print(f"    💸 TRANSFER FOUND: {abs(diff):.6f} SOL")
    
    print()
    
    # Results
    print("=" * 70)
    print("📋 RESULTS")
    print("=" * 70)
    print()
    
    if all_interactions:
        print(f"⚠️  FOUND {len(all_interactions)} DIRECT TRANSFERS:")
        print()
        
        # Remove duplicates
        unique_transfers = {}
        for t in all_interactions:
            key = (t["from_wallet"], t["to_wallet"], t["signature"])
            if key not in unique_transfers:
                unique_transfers[key] = t
        
        for t in sorted(unique_transfers.values(), key=lambda x: x["timestamp"]):
            from_idx = wallets.index(t["from_wallet"]) + 1
            to_idx = wallets.index(t["to_wallet"]) + 1
            
            print(f"📅 {t['timestamp']}")
            print(f"   Wallet {from_idx} → Wallet {to_idx}")
            print(f"   💸 {t['amount_sol']:.6f} SOL")
            print(f"   TX: {t['signature'][:40]}...")
            print()
        
        print("⚠️  CONCLUSION: These wallets ARE CONNECTED")
        print("   Same owner or coordinated activity detected.")
    else:
        print("✅ NO DIRECT TRANSFERS FOUND")
        print()
        print("   Wallets did NOT send funds directly to each other.")
        print("   They appear UNRELATED.")
    
    return all_interactions

if __name__ == "__main__":
    wallets = [
        "63878UJuLZPNFTkU99xi4rPqBx4tnvQ5NMk677gwQGsi",
        "4WWvoHMqCWmapJaN91x7MPosnrqdLUnA1LASCBNFby4g",
        "4WMU9EY61NUJaT9qGo8o2VuJX4SgXiagz3hR7qvL9DL9"
    ]
    
    analyze_wallets(wallets)