#!/bin/bash
set -e

echo "=== Honcho Setup with Grok-4.3 ==="

# 1. Clone Honcho if not present
if [ ! -d "$HOME/honcho" ]; then
  echo "Cloning Honcho..."
  git clone https://github.com/plastic-labs/honcho.git "$HOME/honcho"
fi

cd "$HOME/honcho"

# 2. Prepare files
cp -n .env.template .env 2>/dev/null || true
cp -n docker-compose.yml.example docker-compose.yml 2>/dev/null || true

# 3. Retrieve key from Keychain
echo "Retrieving xAI key from Keychain..."
XAI_KEY=$(security find-generic-password -s "honcho-xai-api" -a "openclaw" -w)

if [ -z "$XAI_KEY" ]; then
  echo "ERROR: Could not retrieve key from Keychain"
  exit 1
fi

# 4. Write configuration
echo "Writing Grok configuration to .env..."

cat >> .env << EOF

# === Grok-4.3 Configuration (added by setup script) ===
LLM_OPENAI_API_KEY=$XAI_KEY

DERIVER_MODEL_CONFIG__TRANSPORT=openai
DERIVER_MODEL_CONFIG__MODEL=grok-4.3
DERIVER_MODEL_CONFIG__OVERRIDES__BASE_URL=https://api.x.ai/v1

SUMMARY_MODEL_CONFIG__TRANSPORT=openai
SUMMARY_MODEL_CONFIG__MODEL=grok-4.3
SUMMARY_MODEL_CONFIG__OVERRIDES__BASE_URL=https://api.x.ai/v1

DIALECTIC_LEVELS__minimal__MODEL_CONFIG__TRANSPORT=openai
DIALECTIC_LEVELS__minimal__MODEL_CONFIG__MODEL=grok-4.3
DIALECTIC_LEVELS__minimal__MODEL_CONFIG__OVERRIDES__BASE_URL=https://api.x.ai/v1

DIALECTIC_LEVELS__low__MODEL_CONFIG__TRANSPORT=openai
DIALECTIC_LEVELS__low__MODEL_CONFIG__MODEL=grok-4.3
DIALECTIC_LEVELS__low__MODEL_CONFIG__OVERRIDES__BASE_URL=https://api.x.ai/v1

DIALECTIC_LEVELS__medium__MODEL_CONFIG__TRANSPORT=openai
DIALECTIC_LEVELS__medium__MODEL_CONFIG__MODEL=grok-4.3
DIALECTIC_LEVELS__medium__MODEL_CONFIG__OVERRIDES__BASE_URL=https://api.x.ai/v1

DIALECTIC_LEVELS__high__MODEL_CONFIG__TRANSPORT=openai
DIALECTIC_LEVELS__high__MODEL_CONFIG__MODEL=grok-4.3
DIALECTIC_LEVELS__high__MODEL_CONFIG__OVERRIDES__BASE_URL=https://api.x.ai/v1

DIALECTIC_LEVELS__max__MODEL_CONFIG__TRANSPORT=openai
DIALECTIC_LEVELS__max__MODEL_CONFIG__MODEL=grok-4.3
DIALECTIC_LEVELS__max__MODEL_CONFIG__OVERRIDES__BASE_URL=https://api.x.ai/v1

DREAM_DEDUCTION_MODEL_CONFIG__TRANSPORT=openai
DREAM_DEDUCTION_MODEL_CONFIG__MODEL=grok-4.3
DREAM_DEDUCTION_MODEL_CONFIG__OVERRIDES__BASE_URL=https://api.x.ai/v1

DREAM_INDUCTION_MODEL_CONFIG__TRANSPORT=openai
DREAM_INDUCTION_MODEL_CONFIG__MODEL=grok-4.3
DREAM_INDUCTION_MODEL_CONFIG__OVERRIDES__BASE_URL=https://api.x.ai/v1

EMBEDDING_MODEL_CONFIG__TRANSPORT=openai
EMBEDDING_MODEL_CONFIG__MODEL=text-embedding-3-small
EOF

echo "Configuration written."

# 5. Start Honcho
echo "Starting Honcho with Docker Compose..."
docker compose up -d --build

echo "=== Honcho setup complete ==="
echo "Check status with: docker compose ps"
echo "View logs with: docker compose logs -f"