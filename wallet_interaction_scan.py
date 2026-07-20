#!/usr/bin/env python3
"""Wallet Interaction Scanner - Analyze wallet interactions over past 30 days"""

import sys
import json
import asyncio
from datetime import datetime, timedelta

try:
    from solders.pubkey import Pubkey
    from solders.rpc.async_client import AsyncClient
except ImportError:
    print("⚠️  Installing required libraries...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "solders", "-q"])
    from solders.pubkey import Pubkey
    from solders.rpc.async_client import AsyncClient

# Wallet addresses
WALLETS = [
    "2eRfNDdkRpn1MY6xDmJ7KQg3MiicCfC5vXoSLToz5R2U",
    "63878UJuLZPNFTkU99xi4rPqBx4tnvQ5NMk677gwQGsi"
]

# Known program IDs
PROGRAMS = {
    "11111111111111111111111111111111": "System Program",
    "TokenkegQfeZyiNwAJbNbGKPFXHCuFGaR": "SPL Token",
    "TokenzQdBNbLqP5VEhMhQ9nHmfFHvYEE9v3q": "Token-2022",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25ef7sNH1gq9X": "Associated Token Program",
    "***REMOVED***": "Jupiter",
    "675kPT9YHRvQz2vXz4y2a2RqXvGfJGTdz9Ef8VcB8nkQ": "Raydium",
    "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaWM7hMMFQfE": "Raydium CLMM",
    "whirLbMiicVdio4qvUfM5KAg6Ct8VbpYd9w6YiHsQKE": "Orca",
    "MarBmsSgKXdrN9ex2ym5Qkd1MstRs7GUyGhYrHHQHRk": "Marinade",
    "metaqbxxU9qKXhPVAmEL3qJQ3RLDH3mQ": "Metaplex",
    "ComputeBudget111111111111111111111111111111": "Compute Budget",
}

def shorten_addr(addr):
    return f"{addr[:8]}...{addr[-4:]}" if addr else "Unknown"

async def scan_wallet(client, wallet_address):
    """Scan wallet transactions for past 30 days"""
    pubkey = Pubkey.from_string(wallet_address)
    
    print(f"\n{'='*60}")
    print(f"📊 SCANNING: {wallet_address}")
    print(f"{'='*60}")
    
    # Get signatures (last 100 transactions)
    sigs = await client.get_signatures_for_address(pubkey, limit=100)
    
    if not sigs.value:
        print("No transactions found")
        return {}
    
    interactions = {}
    tx_count = 0
    recent_txs = []
    
    for sig_info in sigs.value:
        block_time = sig_info.block_time
        if not block_time:
            continue
            
        tx_time = datetime.fromtimestamp(block_time)
        if tx_time < datetime.now() - timedelta(days=30):
            continue
        
        tx_count += 1
        recent_txs.append({
            'sig': str(sig_info.signature),
            'time': tx_time,
            'status': 'Failed' if sig_info.err else 'Success'
        })
        
        # Get transaction details
        try:
            tx = await client.get_transaction(sig_info.signature, max_supported_transaction_version=0)
            
            if not tx.value:
                continue
            
            meta = tx.value.transaction.meta
            message = tx.value.transaction.transaction.message
            account_keys = list(message.account_keys)
            
            for i, account in enumerate(account_keys):
                addr = str(account.pubkey)
                
                # Skip self and programs
                if addr == wallet_address or addr in PROGRAMS:
                    continue
                    
                if addr not in interactions:
                    interactions[addr] = {
                        'count': 0,
                        'first_seen': tx_time,
                        'last_seen': tx_time,
                        'sol_received': 0,
                        'sol_sent': 0,
                    }
                
                interactions[addr]['count'] += 1
                if tx_time < interactions[addr]['first_seen']:
                    interactions[addr]['first_seen'] = tx_time
                if tx_time > interactions[addr]['last_seen']:
                    interactions[addr]['last_seen'] = tx_time
                
                # Track SOL transfers
                if meta and i < len(meta.pre_balances) and i < len(meta.post_balances):
                    pre_bal = meta.pre_balances[i]
                    post_bal = meta.post_balances[i]
                    diff = (post_bal - pre_bal) / 1_000_000_000
                    
                    if diff > 0:
                        interactions[addr]['sol_received'] += diff
                    else:
                        interactions[addr]['sol_sent'] += abs(diff)
                        
        except Exception as e:
            continue
    
    print(f"\n📝 Transactions in past 30 days: {tx_count}")
    
    return interactions, recent_txs

async def main():
    # Connect to Solana
    client = AsyncClient("https://api.mainnet-beta.solana.com")
    
    all_interactions = {}
    all_txs = {}
    
    for wallet in WALLETS:
        interactions, txs = await scan_wallet(client, wallet)
        all_interactions[wallet] = interactions
        all_txs[wallet] = txs
    
    await client.close()
    
    # Print results
    print("\n" + "="*80)
    print("📊 WALLET INTERACTION SUMMARY (Past 30 Days)")
    print("="*80)
    
    for wallet, interactions in all_interactions.items():
        print(f"\n🔑 Wallet: {wallet}")
        print("-" * 60)
        
        if not interactions:
            print("No interactions found")
            continue
        
        # Sort by interaction count
        sorted_interactions = sorted(
            interactions.items(),
            key=lambda x: x[1]['count'],
            reverse=True
        )
        
        print(f"\n{'Address':<20} {'Tx':>6} {'SOL In':>10} {'SOL Out':>10}")
        print("-" * 60)
        
        for addr, data in sorted_interactions[:15]:
            print(f"{shorten_addr(addr):<20} {data['count']:>6} {data['sol_received']:>10.4f} {data['sol_sent']:>10.4f}")
        
        print(f"\n📈 Total unique addresses: {len(interactions)}")
        
        # Top receivers
        top_receivers = sorted(
            interactions.items(),
            key=lambda x: x[1]['sol_sent'],
            reverse=True
        )[:5]
        
        if top_receivers and top_receivers[0][1]['sol_sent'] > 0:
            print(f"\n💸 Top SOL Sent To:")
            for addr, data in top_receivers:
                if data['sol_sent'] > 0:
                    print(f"  {shorten_addr(addr)}: {data['sol_sent']:.4f} SOL")
    
    # Find common interactions
    if len(all_interactions) == 2:
        wallets = list(all_interactions.keys())
        w1_addrs = set(all_interactions[wallets[0]].keys())
        w2_addrs = set(all_interactions[wallets[1]].keys())
        common = w1_addrs & w2_addrs
        
        if common:
            print("\n" + "="*80)
            print("🔗 COMMON INTERACTIONS (Both wallets interacted with)")
            print("="*80)
            for addr in list(common)[:10]:
                w1_data = all_interactions[wallets[0]].get(addr, {})
                w2_data = all_interactions[wallets[1]].get(addr, {})
                print(f"  {shorten_addr(addr)}")
                print(f"    Wallet 1: {w1_data.get('count', 0)} txs")
                print(f"    Wallet 2: {w2_data.get('count', 0)} txs")
        else:
            print("\n❌ No common interactions found between wallets")

if __name__ == "__main__":
    asyncio.run(main())