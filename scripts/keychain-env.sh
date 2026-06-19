#!/bin/bash
# keychain-env.sh — Load secrets from macOS Keychain instead of .env files
# Usage: source scripts/keychain-env.sh
#
# Secrets are stored via:
#   security add-generic-password -s "<service>" -a "agenticbro" -w "<value>"
#
# To update a secret:
#   security delete-generic-password -s "<service>" -a "agenticbro"
#   security add-generic-password -s "<service>" -a "agenticbro" -w "<new_value>"

_keychain_load() {
  local service="$1"
  local varname="$2"
  local value
  value=$(security find-generic-password -s "$service" -a "agenticbro" -w 2>/dev/null)
  if [ -n "$value" ]; then
    export "$varname"="$value"
  else
    echo "⚠️  Could not load $service from keychain" >&2
  fi
}

# Stripe
_keychain_load "stripe_secret_key" "STRIPE_SECRET_KEY"

# Supabase
_keychain_load "supabase_url" "SUPABASE_URL"
_keychain_load "supabase_url" "VITE_SUPABASE_URL"
_keychain_load "supabase_publishable_key" "VITE_SUPABASE_PUBLISHABLE_KEY"
_keychain_load "supabase_anon_key" "VITE_SUPABASE_ANON_KEY"
_keychain_load "supabase_secret_api_key" "SUPABASE_SECRET_API_KEY"

# Wallet
_keychain_load "airdrop_wallet_private_key" "AIRDROP_WALLET_PRIVATE_KEY"

# Telegram
_keychain_load "telegram_bot_token" "TELEGRAM_BOT_TOKEN"

# Nous Portal API
_keychain_load "nous_api_key" "NOUS_API_KEY"

# Static / non-secret values (not in keychain, set directly)
export TELEGRAM_BOT_USERNAME="@Jeeevs222_bot"
export TELEGRAM_ACCOUNT_ID="8798669748"

unset -f _keychain_load

echo "✅ All secrets loaded from macOS Keychain"