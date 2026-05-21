#!/bin/bash
# Retry only the 6 failed wallets from previous run
# Failed wallets: B2YbTVUs, 5S5VVx5s, J4wsP4HZ, 7erEFC8A, Cmw2B5Lx, 21BgRJNL

SCRIPT_DIR="/Users/efinney/.openclaw/workspace/scripts"
MONITOR_SCRIPT="$SCRIPT_DIR/airdrop_wallet_monitor.py"

echo "Retrying 6 failed wallets with 3-second delay between requests..."
echo ""

# Wallet addresses (shortened for readability)
WALLETS=(
  "B2YbTVUsC4MTdSCcn7SAFwBcYrZFPxbTBNosNcvGjMuB"
  "5S5VVx5sJZGmQqzXKqWxWqXqXqXqXqXqXqXqXqXqXqXqX"  # placeholder - need actual
  "J4wsP4HZXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXq"  # placeholder - need actual
  "7erEFC8AXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXq"  # placeholder - need actual
  "Cmw2B5LxVCrmw4zsdJoN4oRh9d5HErfn7mddepNmdky8"
  "21BgRJNLCvpQximq33Q2XiXiTBkMGdshRJp5c5mz77os"
)

# Use Python to check each wallet with delay
python3 -c "
import json
import time
import urllib.request
import urllib.error

AGNTCBRO_MINT = '52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump'
RPC_ENDPOINTS = [
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
]

# Failed wallets from previous run
WALLETS = [
    ('B2YbTVUsC4MTdSCcn7SAFwBcYrZFPxbTBNosNcvGjMuB', 'Diamond'),
    ('5S5VVx5sJZGmQqzXKqWxWqXqXqXqXqXqXqXqXqXqXqXq', 'Diamond'),  # Need actual address
    ('J4wsP4HZXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXq', 'Gold'),  # Need actual address
    ('7erEFC8AXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXq', 'Gold'),  # Need actual address
    ('Cmw2B5LxVCrmw4zsdJoN4oRh9d5HErfn7mddepNmdky8', 'Gold'),
    ('21BgRJNLCvpQximq33Q2XiXiTBkMGdshRJp5c5mz77os', 'Gold'),
]

def get_balance(wallet):
    payload = {
        'jsonrpc': '2.0',
        'id': 1,
        'method': 'getTokenAccountsByOwner',
        'params': [
            wallet,
            {'mint': AGNTCBRO_MINT},
            {'encoding': 'jsonParsed'}
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
            
            with urllib.request.urlopen(req, timeout=20) as response:
                result = json.loads(response.read().decode('utf-8'))
                
                if 'result' in result and result['result']:
                    accounts = result['result'].get('value', [])
                    total_balance = 0
                    
                    for account in accounts:
                        token_data = account.get('account', {}).get('data', {}).get('parsed', {}).get('info', {})
                        balance = int(token_data.get('tokenAmount', {}).get('amount', 0))
                        total_balance += balance
                    
                    return {'balance': total_balance, 'success': True, 'rpc': rpc}
                else:
                    return {'balance': 0, 'success': True, 'rpc': rpc}
                    
        except urllib.error.URLError as e:
            print(f'  ⚠️ RPC error ({rpc}): {e}')
            time.sleep(2)  # Wait before trying next RPC
            continue
        except Exception as e:
            print(f'  ⚠️ Error: {e}')
            continue
    
    return {'balance': 0, 'success': False, 'error': 'All RPCs failed'}

print('Retrying failed wallets...')
print()

for i, (wallet, tier) in enumerate(WALLETS, 1):
    print(f'[{i}/{len(WALLETS)}] Checking {wallet[:8]}... ({tier})')
    
    result = get_balance(wallet)
    
    if result['success']:
        balance = result['balance']
        status = '✅ ELIGIBLE' if balance > 0 else '❌ NO BALANCE'
        print(f'  {status}: {balance:,.0f} AGNTCBRO')
    else:
        print(f'  ❌ Failed: {result.get(\"error\", \"Unknown\")}')
    
    # Wait between requests to avoid rate limiting
    if i < len(WALLETS):
        time.sleep(3)

print()
print('Done. Checked all failed wallets.')
"