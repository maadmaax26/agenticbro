#!/bin/bash
# Solana RPC Load Balancer
# Round-robin across Chainstack (primary) and Public Solana (fallback)
# Usage: source this script, then call: solana_rpc_call <method> <params_json>
#
# Chainstack: 25 req/s, dedicated node, better reliability
# Public:     ~10 req/s, no SLA, shared infrastructure
#
# Strategy: Round-robin across healthy endpoints, skip failed ones

set -uo pipefail

# RPC endpoints — Chainstack primary, public fallback
CHAINSTACK_RPC="https://solana-mainnet.core.chainstack.com/2d4021c108e26f5851c45fe49a6dbf10"
PUBLIC_RPC="https://api.mainnet-beta.solana.com"

# State file for round-robin index (persists across calls)
RPC_STATE_DIR="/tmp/solana-rpc-state"
RPC_INDEX_FILE="$RPC_STATE_DIR/round_robin_index"
RPC_HEALTH_FILE="$RPC_STATE_DIR/health"
mkdir -p "$RPC_STATE_DIR" 2>/dev/null

# Endpoints array
RPC_ENDPOINTS=("$CHAINSTACK_RPC" "$PUBLIC_RPC")

# Get current round-robin index (default 0 = Chainstack first)
get_rpc_index() {
    if [ -f "$RPC_INDEX_FILE" ]; then
        cat "$RPC_INDEX_FILE" 2>/dev/null || echo 0
    else
        echo 0
    fi
}

# Advance round-robin index
advance_rpc_index() {
    local idx=$(get_rpc_index)
    local next=$(( (idx + 1) % ${#RPC_ENDPOINTS[@]} ))
    echo "$next" > "$RPC_INDEX_FILE"
}

# Check if an endpoint is healthy
check_rpc_health() {
    local endpoint="$1"
    local result
    result=$(curl -s --max-time 5 -X POST "$endpoint" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' 2>/dev/null)
    echo "$result" | grep -q '"result":"ok"'
}

# Get next healthy RPC endpoint (round-robin with fallback)
get_next_rpc() {
    local idx=$(get_rpc_index)
    local tried=0
    local endpoint
    
    while [ $tried -lt ${#RPC_ENDPOINTS[@]} ]; do
        endpoint="${RPC_ENDPOINTS[$idx]}"
        if check_rpc_health "$endpoint"; then
            echo "$endpoint"
            advance_rpc_index
            return 0
        fi
        # Mark this endpoint as unhealthy
        idx=$(( (idx + 1) % ${#RPC_ENDPOINTS[@]} ))
        tried=$((tried + 1))
    done
    
    # All endpoints failed — fall back to Chainstack (best chance)
    echo "$CHAINSTACK_RPC"
    return 1
}

# Make an RPC call with automatic load balancing and retry
# Usage: solana_rpc_call <method> <params_json> [max_retries]
solana_rpc_call() {
    local method="$1"
    local params="$2"
    local max_retries="${3:-2}"
    local attempt=0
    local response
    
    while [ $attempt -lt $max_retries ]; do
        local endpoint=$(get_next_rpc)
        response=$(curl -s --max-time 15 -X POST "$endpoint" \
            -H "Content-Type: application/json" \
            -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$method\",\"params\":$params}" 2>/dev/null)
        
        # Check for valid response
        if echo "$response" | grep -q '"result"'; then
            echo "$response"
            return 0
        fi
        
        # Check for rate limit or server error — try next endpoint
        if echo "$response" | grep -qE '"code":\s*-32429|429|rate.limit'; then
            attempt=$((attempt + 1))
            sleep 1
            continue
        fi
        
        # Other error — retry
        attempt=$((attempt + 1))
        sleep 1
    done
    
    # Final attempt failed, return whatever we got
    echo "$response"
    return 1
}

# Simple: just get the current best RPC endpoint (for scripts that do their own curl calls)
# Usage: RPC=$(get_solana_rpc)
get_solana_rpc() {
    get_next_rpc
}

# If called directly (not sourced), show status
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "━━━ Solana RPC Load Balancer ━━━"
    echo ""
    echo "Endpoints:"
    echo "  1. Chainstack: $CHAINSTACK_RPC"
    echo "  2. Public:     $PUBLIC_RPC"
    echo ""
    echo "Current round-robin index: $(get_rpc_index)"
    echo ""
    
    for endpoint in "${RPC_ENDPOINTS[@]}"; do
        name="Unknown"
        [[ "$endpoint" == *chainstack* ]] && name="Chainstack"
        [[ "$endpoint" == *mainnet-beta* ]] && name="Public"
        
        if check_rpc_health "$endpoint"; then
            echo "  ✅ $name: Healthy"
        else
            echo "  ❌ $name: Unhealthy"
        fi
    done
    
    echo ""
    echo "Selected endpoint: $(get_solana_rpc)"
fi