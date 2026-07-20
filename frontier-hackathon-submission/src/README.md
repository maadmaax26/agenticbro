# Agentic Bro — Wallet Protection

## Core Modules

### 1. Transaction Decoder (`src/transaction-decoder/`)

Decodes Solana transactions into human-readable steps before signing.

**Features:**
- Parses System, SPL, Token-2022, Metaplex, Jupiter, Raydium, Orca instructions
- Converts raw blockchain data into plain language
- Shows token transfers, fees, destination addresses
- Identifies dangerous patterns (drainers, hidden fees, malicious approvals)

**Tech:** TypeScript, @solana/web3.js, Helius RPC

### 2. Risk Scoring Engine (`src/risk-scorer/`)

90-point unified scoring system for transaction and profile analysis.

**Features:**
- Weighted flag detection (25pts for drainers, 15pts for Token-2022 exploits)
- Real-time analysis via local LLM inference
- Behavioral pattern recognition
- Cross-platform consistency

**Tech:** Python, Ollama, TypeScript

### 3. Website Scanner (`src/website-scanner/`)

URL security assessment before wallet connection.

**Features:**
- Wallet drainer script detection
- Phishing pattern recognition
- Fake airdrop identification
- Regulatory warning cross-reference (FCA, SEC)

**Tech:** TypeScript, web_fetch, web_search

### 4. Profile Scanner (`src/profile-scanner/`)

Multi-platform social media risk assessment.

**Features:**
- X (Twitter), Instagram, TikTok, Facebook, Telegram scanning
- AI-powered behavioral analysis
- Community-reported scammer database (278+ entries)
- Chrome CDP for X, HTTP for other platforms

**Tech:** TypeScript, Chrome CDP, web_fetch

### 5. Token Impersonation Detector (`src/token-impersonation/`)

Detects fake tokens with identical names/logos on Solana.

**Features:**
- Metadata comparison (name, symbol, logo, description)
- Freeze/mint authority analysis
- Rug-pull indicator detection
- Verified token cross-reference

**Tech:** TypeScript, Helius RPC, Token-2022 standard

---

## Architecture

```
User Input (URL/Username/Transaction)
    ↓
[Router] → Profile Scanner / Website Scanner / Transaction Decoder / Token Detector
    ↓
[Analysis Engine] → Risk Scoring (90-point unified)
    ↓
[LLM Layer] → Ollama (local) / Cloud models (fallback)
    ↓
[Response] → Human-readable risk report with actionable steps
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add: HELIUS_RPC_URL, SUPABASE_URL, SUPABASE_KEY

# Run locally
npm run dev

# Build for production
npm run build
```

---

## License

MIT — All grant-funded deliverables open-sourced

**Scan first, trust later. 🔐**
