#!/usr/bin/env python3
"""
Wallet Link Analyzer v2 - With Rate Limiting
"""
import json
import urllib.request
import time
from datetime import datetime
from collections import defaultdict

# Rate limiting
LAST_CALL_TIME = 0
MIN_INTERVAL = 0.3  # 300ms between calls

def rpc_call(method, params):
    """Make Solana RPC call with rate limiting"""
    global LAST_CALL_TIME
    
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
    
    LAST_CALL_TIME = time.time()
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode())

def get_transactions(wallet, limit=30):
    """Get recent transactions for a wallet"""
    result = rpc_call("getSignaturesForAddress", [wallet, {"limit": limit}])
    return result.get("result", [])

def get_transaction_details(sig):
    """Get details of a transaction"""
    result = rpc_call("getTransaction", [sig, {"encoding": "json"}])
    return result.get("result")

def get_balance(wallet):
    """Get SOL balance"""
    result = rpc_call("getAccountInfo", [wallet, {"encoding": "base64"}])
    value = result.get("result", {}).get("value", {})
    if value is None:
        return None
    lamports = value.get("lamports", 0)
    return lamports / 1_000_000_000

def analyze_wallets(wallets):
    """Analyze wallets for connections"""
    print("=" * 70)
    print("🔍 WALLET LINK ANALYZER v2 (Rate Limited)")
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
    
    # Collect all transactions
    print("📝 COLLECTING TRANSACTIONS (with rate limiting)...")
    print("-" * 70)
    
    all_interactions = []
    wallet_tx_counts = {}
    
    for wallet in wallets:
        print(f"Fetching transactions for {wallet[:12]}...{wallet[-4:]}...")
        txs = get_transactions(wallet, limit=20)
        wallet_tx_counts[wallet] = len(txs)
        
        for tx in txs:
            sig = tx.get("signature")
            block_time = tx.get("blockTime", 0)
            
            details = get_transaction_details(sig)
            if details:
                message = details.get("transaction", {}).get("message", {})
                meta = details.get("meta", {})
                
                if isinstance(message, dict):
                    accounts = message.get("accountKeys", [])
                    pre_bal = meta.get("preBalances", [])
                    post_bal = meta.get("postBalances", [])
                    
                    # Check for transfers between our wallets
                    for i, acc in enumerate(accounts):
                        if acc in wallets and i < len(pre_bal) and i < len(post_bal):
                            diff = (post_bal[i] - pre_bal[i]) / 1_000_000_000
                            if diff != 0:
                                # Find other wallets in this tx
                                for j, other_acc in enumerate(accounts):
                                    if other_acc in wallets and other_acc != acc and j < len(pre_bal):
                                        other_diff = (post_bal[j] - pre_bal[j]) / 1_000_000_000
                                        if other_diff != 0 and diff * other_diff < 0:  # Opposite signs = transfer
                                            # Found a transfer
                                            sender = acc if diff < 0 else other_acc
                                            receiver = other_acc if diff < 0 else acc
                                            amount = abs(diff)
                                            
                                            all_interactions.append({
                                                "signature": sig,
                                                "timestamp": datetime.fromtimestamp(block_time).strftime('%Y-%m-%d %H:%M:%S'),
                                                "from_wallet": sender,
                                                "to_wallet": receiver,
                                                "amount_sol": amount,
                                                "type": "TRANSFER"
                                            })
    
    print()
    
    # Print results
    print("=" * 70)
    print("🔗 TRANSFER ANALYSIS")
    print("=" * 70)
    print()
    
    if not all_interactions:
        print("❌ No direct transfers found between wallets")
        print()
        print("Wallets did NOT send funds directly to each other.")
    else:
        print(f"✅ FOUND {len(all_interactions)} DIRECT TRANSFERS:")
        print()
        
        for interaction in sorted(all_interactions, key=lambda x: x["timestamp"]):
            from_idx = wallets.index(interaction["from_wallet"]) + 1
            to_idx = wallets.index(interaction["to_wallet"]) + 1
            
            print(f"📅 {interaction['timestamp']}")
            print(f"   From: Wallet {from_idx} ({interaction['from_wallet'][:12]}...{interaction['from_wallet'][-4:]})")
            print(f"   To:   Wallet {to_idx} ({interaction['to_wallet'][:12]}...{interaction['to_wallet'][-4:]})")
            print(f"   💸 Amount: {interaction['amount_sol']:.6f} SOL")
            print(f"   TX: {interaction['signature'][:30]}...")
            print()
    
    # Summary
    print("=" * 70)
    print("📋 SUMMARY")
    print("=" * 70)
    print()
    
    print(f"Wallets analyzed: {len(wallets)}")
    print(f"Transactions scanned: {sum(wallet_tx_counts.values())}")
    print()
    
    if all_interactions:
        print(f"⚠️  DIRECT TRANSFERS FOUND: {len(all_interactions)}")
        print()
        print("These wallets ARE CONNECTED. Same owner likely.")
        print()
        
        # Group by direction
        transfers = defaultdict(float)
        for i in all_interactions:
            key = (i["from_wallet"], i["to_wallet"])
            transfers[key] += i["amount_sol"]
        
        print("Total transfers by direction:")
        for (f, t), amt in transfers.items():
            from_idx = wallets.index(f) + 1
            to_idx = wallets.index(t) + 1
            print(f"   Wallet {from_idx} → Wallet {to_idx}: {amt:.6f} SOL")
    else:
        print("✅ No direct transfers found between wallets")
        print()
        print("Wallets appear UNRELATED (no direct fund flow)")
    
    return all_interactions

if __name__ == "__main__":
    wallets = [
        "63878UJuLZPNFTkU99xi4rPqBx4tnvQ5NMk677gwQGsi",
        "4WWvoHMqCWmapJaN91x7MPosnrqdLUnA1LASCBNFby4g",
        "4WMU9EY61NUJaT9qGo8o2VuJX4SgXiagz3hR7qvL9DL9"
    ]
    
    analyze_wallets(wallets)