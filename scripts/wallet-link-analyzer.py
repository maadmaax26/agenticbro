#!/usr/bin/env python3
"""
Wallet Link Analyzer - Check if two wallets are connected
"""
import json
import urllib.request
import urllib.parse
from datetime import datetime
from collections import defaultdict

def rpc_call(method, params):
    """Make Solana RPC call"""
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
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())

def get_transactions(wallet, limit=50):
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
    return lamports / 1_000_000_000  # Convert to SOL

def analyze_wallet_link(wallets):
    """Analyze if wallets are linked"""
    print("=" * 70)
    print("🔍 WALLET LINK ANALYSIS")
    print("=" * 70)
    
    # Get balances
    print("\n📊 BALANCES:")
    print("-" * 70)
    for i, w in enumerate(wallets, 1):
        balance = get_balance(w)
        if balance is None:
            print(f"Wallet {i}: {w[:8]}...{w[-4:]} - INVALID/EMPTY")
        else:
            print(f"Wallet {i}: {w[:8]}...{w[-4:]} - {balance:.4f} SOL")
    
    # Get all transactions
    print("\n📝 COLLECTING TRANSACTIONS...")
    print("-" * 70)
    
    all_accounts = defaultdict(set)
    wallet_accounts = {}
    
    for wallet in wallets:
        print(f"Fetching transactions for {wallet[:8]}...{wallet[-4:]}...")
        txs = get_transactions(wallet, limit=50)
        wallet_accounts[wallet] = set()
        
        for tx in txs[:10]:  # Check first 10 transactions
            sig = tx.get("signature")
            details = get_transaction_details(sig)
            if details:
                message = details.get("transaction", {}).get("message", {})
                if isinstance(message, dict):
                    accounts = message.get("accountKeys", [])
                    for acc in accounts:
                        all_accounts[acc].add(wallet)
                        wallet_accounts[wallet].add(acc)
    
    # Find shared accounts
    print("\n🔗 SHARED ACCOUNTS ANALYSIS:")
    print("-" * 70)
    
    shared = []
    for acc, wallets_involved in all_accounts.items():
        if len(wallets_involved) > 1:
            shared.append((acc, wallets_involved))
    
    if not shared:
        print("❌ NO DIRECT LINKS FOUND")
        print("\nThe wallets do not appear in the same transactions.")
    else:
        print(f"✅ FOUND {len(shared)} SHARED ACCOUNTS/ADDRESSES:")
        print()
        for acc, wallets_involved in sorted(shared, key=lambda x: len(x[1]), reverse=True)[:20]:
            if acc == "11111111111111111111111111111111":
                print(f"   System Program (common - not suspicious)")
            elif acc == "ComputeBudget111111111111111111111111111111":
                print(f"   Compute Budget (common - not suspicious)")
            else:
                wallets_str = ", ".join([f"Wallet {wallets.index(w)+1}" for w in wallets_involved])
                print(f"   {acc[:20]}...")
                print(f"      Appears in: {wallets_str}")
    
    # Check for same funding source
    print("\n💰 FUNDING SOURCE CHECK:")
    print("-" * 70)
    
    # Get first transaction for each wallet to see funding source
    for wallet in wallets:
        txs = get_transactions(wallet, limit=1)
        if txs:
            first_tx = txs[-1]  # Oldest transaction
            details = get_transaction_details(first_tx.get("signature"))
            if details:
                message = details.get("transaction", {}).get("message", {})
                if isinstance(message, dict):
                    accounts = message.get("accountKeys", [])
                    if len(accounts) > 1:
                        # First account is usually the fee payer (funder)
                        print(f"Wallet {wallets.index(wallet)+1} ({wallet[:8]}...{wallet[-4:]}):")
                        print(f"   First transaction: {first_tx.get('signature', '')[:30]}...")
                        if len(accounts) > 1:
                            print(f"   Potential funder: {accounts[0][:20]}...")
    
    # Summary
    print("\n" + "=" * 70)
    print("📋 SUMMARY:")
    print("=" * 70)
    
    # Filter out system accounts from shared
    suspicious_shared = [s for s in shared if s[0] not in [
        "11111111111111111111111111111111",
        "ComputeBudget111111111111111111111111111111"
    ]]
    
    if suspicious_shared:
        print(f"⚠️  {len(suspicious_shared)} POTENTIAL LINKS FOUND")
        print("   These wallets may be connected through shared addresses.")
    elif shared:
        print("✅ Only common system accounts found (no direct links)")
        print("   Wallets appear to be UNRELATED")
    else:
        print("✅ NO LINKS FOUND")
        print("   Wallets appear to be UNRELATED")
    
    return suspicious_shared

if __name__ == "__main__":
    # Wallets to analyze
    wallets = [
        "63878UJuLZPNFTkU99xi4rPqBx4tnvQ5NMk677gwQGsi",
        "4WWvoHMqCWmapJaN91x7MPosnrqdLUnA1LASCBNFby4g",
        "4WMU9EY61NUJaT9qGo8o2VuJX4SgXiagz3hR7qvL9DL9"
    ]
    
    analyze_wallet_link(wallets)