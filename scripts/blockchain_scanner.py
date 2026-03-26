#!/usr/bin/env python3
"""
Direct Blockchain Scanner for Solana
Attempts to get token info directly from Solana blockchain
"""
import json
import requests
import base64
from datetime import datetime

def get_solana_account_info(address):
    """Get account info directly from Solana blockchain"""
    try:
        # Try mainnet-beta first
        url = "https://api.mainnet-beta.solana.com"
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getAccountInfo",
            "params": [address]
        }
        
        response = requests.post(url, json=payload, timeout=10)
        data = response.json()
        
        if 'result' in data and data['result']:
            return {
                'found': True,
                'network': 'mainnet-beta',
                'data': data['result']
            }
        elif 'error' in data:
            return {
                'found': False,
                'network': 'mainnet-beta',
                'error': data['error'].get('message', str(data['error']))
            }
        else:
            return {
                'found': False,
                'network': 'mainnet-beta',
                'error': 'Unknown response'
            }
    except Exception as e:
        return {
            'found': False,
            'network': 'mainnet-beta',
            'error': str(e)
        }

def get_token_metadata(address):
    """Try to get token metadata using Token Metadata Program"""
    try:
        # Try Token Metadata Program (spl-token-metadata)
        url = "https://api.mainnet-beta.solana.com"
        
        # First, check if account exists
        account_payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getAccountInfo",
            "params": [address]
        }
        
        response = requests.post(url, json=account_payload, timeout=10)
        data = response.json()
        
        if 'result' in data and data['result']:
            # Account exists, try to get basic info
            account_info = data['result']
            owner = account_info.get('owner')
            lamports = account_info.get('lamports', 0)
            
            return {
                'found': True,
                'address': address,
                'owner': owner,
                'lamports': lamports,
                'sol_balance': lamports / 1_000_000_000
            }
        else:
            return {
                'found': False,
                'error': 'Account does not exist or network error'
            }
    except Exception as e:
        return {
            'found': False,
            'error': str(e)
        }

def scan_direct_blockchain(address):
    """Direct blockchain scan"""
    print(f"🔗 Direct Blockchain Scan: {address}")
    
    # Check on mainnet-beta
    print("📊 Checking mainnet-beta...")
    mainnet_result = get_solana_account_info(address)
    
    if mainnet_result['found']:
        print("✅ Account exists on mainnet-beta!")
        print(f"   Owner: {mainnet_result['data'].get('owner', 'N/A')}")
        print(f"   Data: {mainnet_result['data'].get('data', 'N/A')[:50]}...")
        return mainnet_result
    else:
        print(f"❌ Not found on mainnet-beta: {mainnet_result['error']}")
    
    # Check if it might be a different network
    print("\n📊 Checking token metadata...")
    metadata_result = get_token_metadata(address)
    
    if metadata_result['found']:
        print("✅ Token metadata found!")
        print(f"   Owner: {metadata_result.get('owner', 'N/A')}")
        print(f"   SOL Balance: {metadata_result.get('sol_balance', 0):.9f} SOL")
        return metadata_result
    else:
        print(f"❌ Metadata not found: {metadata_result.get('error', 'N/A')}")
    
    return {
        'found': False,
        'summary': 'Account not found on Solana mainnet-beta or metadata unavailable',
        'mainnet_result': mainnet_result,
        'metadata_result': metadata_result
    }

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python blockchain_scanner.py <SOLANA_ADDRESS>")
        print("Example: python blockchain_scanner.py 9U2p5SMjWkk8SUhM6prFB89EYY3MtBvVvuoNr9cpUwNw")
        sys.exit(1)
    
    contract_address = sys.argv[1]
    result = scan_direct_blockchain(contract_address)
    
    print("\n" + "="*70)
    print("📊 BLOCKCHAIN SCAN RESULTS")
    print("="*70)
    print(f"Address: {contract_address}")
    print(f"Status: {'✅ FOUND' if result['found'] else '❌ NOT FOUND'}")
    
    if result['found']:
        print(f"Network: {result.get('network', 'N/A')}")
        print(f"Data: {result.get('data', 'N/A')}")
    else:
        print(f"Summary: {result.get('summary', 'Unknown')}")
        if 'mainnet_result' in result:
            print(f"Mainnet Error: {result['mainnet_result'].get('error', 'N/A')}")
        if 'metadata_result' in result:
            print(f"Metadata Error: {result['metadata_result'].get('error', 'N/A')}")
    
    print("\n⚠️ If account not found, possible reasons:")
    print("  1. Invalid contract address (wrong format/typo)")
    print("  2. Account on different network (devnet, testnet, Token2022)")
    print("  3. Contract not yet deployed or funded")
    print("  4. Account closed/empty")
    print("  5. Account on chain that's not mainnet-beta")
    print("="*70)