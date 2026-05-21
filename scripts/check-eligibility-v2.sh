#!/bin/bash
# Check all 21 wallets with 4s delay between calls
MINT="52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
RPC="https://api.mainnet-beta.solana.com"

WALLETS=(
"6aSrey36pvkAKAVvsKL84X4CkDEY4bQCp5hFh8NVcN4j:Diamond:91367587"
"ZzBAYTFDehbwrgzzgN8ecYUyHwokDFxfgbA945ZqGf3:Diamond:81155778"
"B2YbTVUsC4MTdSCcn7SAFwBcYrZFPxbTBNosNcvGjMuB:Diamond:66142895"
"CBReL95M1gS3SaeK7m38mpLKWmeAYk5KqyF9ND4Ta84y:Gold:38795653"
"36J6TkbFc3QLEtT5V6H9hjXFKcRU5RKxqtbvtq55GEKc:Gold:22730401"
"EZwbHQ54PwcsL9iHsaEG1ruMEjVHed8iBmv1esA1rs8n:Gold:19624691"
"Cmw2B5LxVCrmw4zsdJoN4oRh9d5HErfn7mddepNmdky8:Gold:19128554"
"63878UJuLZPNFTkU99xi4rPqBx4tnvQ5NMk677gwQGsi:Gold:10691783"
"21BgRJNLCvpQximq33Q2XiXiTBkMGdshRJp5c5mz77os:Gold:10641507"
"DJwK6keJYc8EZdSTySCjXBFN2QbWN6Xaf8iKiGWSckbh:Gold:10000000"
"2XipXuKRtwgiV9ZYRg9t485Xw4jH9pTZ6pWJdqYWR6xB:Silver:7735980"
"4vpq2KYHw9L1xZQSZddUWFYTrssYaup1ZAUH7JDjyhDa:Silver:7680839"
"GUc6q8eyBbppMa7qdNzCUDeVVqzEcqr33QvuZ63QfMQJ:Silver:7666423"
"5q7xgZuVPz7Jfip1L6sGgiSzTwxDpLQPzijzMmHeFRU4:Silver:7630909"
"H3XibQLNUhxzCfCSuXLDk91C4syvvVxu1BM4VpjzbT25:Silver:6888810"
"7v24h67inspXXHkwUf96937WK3oJfXAFtDDsk7DEsbK4:Silver:6394078"
"BzK9pyjGhvSDcqWHRBt5P52Eh3sEWkrAhKT24gYRUp2C:Silver:6383753"
"HcHud5ttvTkT4H3RSHQ2D8GCDd6ar5zB94mPz8pekMba:Silver:5802662"
"GtYdoFGojHz54RXaWw3LQkjF89tdjjETfHv8kW4LRPaH:Silver:5367303"
"ARzPMLivPH9GsRnwZWymXcPJX9Br1oEH5od3WzoKmX5Y:Silver:4225429"
"BZbk5WEKLcbc7SUaS76jCUmhJiLvkNXbYcWrcJ3K1x4W:Silver:4038126"
)

echo "━━━ AGNTCBRO ELIGIBILITY CHECK ━━━"
echo "Checking 21 wallets..."
echo ""

ELIGIBLE=0
INELIGIBLE=0
ERRORS=0

for entry in "${WALLETS[@]}"; do
  addr="${entry%%:*}"
  rest="${entry#*:}"
  tier="${rest%%:*}"
  snapshot="${rest#*:}"
  
  printf "%-12s (%-7s snap:%-12s) " "${addr:0:10}" "$tier" "$snapshot"
  
  RESP=$(curl -s -X POST "$RPC" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getTokenAccountsByOwner\",\"params\":[\"$addr\",{\"mint\":\"$MINT\"},{\"encoding\":\"jsonParsed\"}]}" \
    --max-time 15 2>/dev/null)
  
  BAL=$(echo "$RESP" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  if d.get('result') and d['result'].get('value'):
    total=sum(int(a['account']['data']['parsed']['info']['tokenAmount']['amount']) for a in d['result']['value'])
    print(total)
  else:
    print('0')
except:
  print('-1')
" 2>/dev/null)

  if [ "$BAL" = "-1" ]; then
    echo "❌ ERROR"
    ERRORS=$((ERRORS+1))
  else
    HUMAN=$((BAL / 1000000))
    case "$tier" in
      Diamond) THRESH=50000000;;
      Gold) THRESH=10000000;;
      Silver) THRESH=4000000;;
    esac
    
    MIN_HOLD=$((snapshot - snapshot / 10))
    
    if [ "$BAL" -ge "$THRESH" ] && [ "$BAL" -ge "$MIN_HOLD" ]; then
      echo "✅ ELIGIBLE (${HUMAN}M AGNTCBRO)"
      ELIGIBLE=$((ELIGIBLE+1))
    else
      if [ "$BAL" -lt "$MIN_HOLD" ]; then
        echo "❌ SOLD (${HUMAN}M < ${snapshot})"
      else
        echo "❌ BELOW_THRESHOLD (${HUMAN}M)"
      fi
      INELIGIBLE=$((INELIGIBLE+1))
    fi
  fi
  
  sleep 4
done

echo ""
echo "━━━ SUMMARY ━━━"
echo "✅ Eligible:   $ELIGIBLE/21"
echo "❌ Ineligible: $INELIGIBLE/21"
echo "⚠️  Errors:    $ERRORS/21"