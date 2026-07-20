# Agentic Bro Tech Stack

Agentic Bro runs a hybrid AI infrastructure optimized for real-time scam detection at consumer scale. The frontend is React + TypeScript + Tailwind, served via Vercel with Supabase PostgreSQL for the 278+ verified scammer database and Edge Functions for API routes.

The AI layer uses Ollama for local inference on a Mac Studio DePIN node — running qwen3.5:4b, glm-5.1:cloud, and kimi-k2.6:cloud models. Local inference ensures sub-2-second scan times, zero API costs for free tiers, and privacy-preserving analysis (user data never leaves the device). Cloud models handle complex multi-step reasoning when needed.

Blockchain integration uses Helius RPC for Solana transaction decoding, token metadata analysis, and permanent delegate detection. The 90-point risk scoring engine is TypeScript-based with weighted flag detection. Chrome CDP handles X/Twitter scanning at scale. Web fetch covers Instagram, TikTok, Facebook, and Telegram profile analysis.

The token scanner detects honeypots, hidden mint authority, and Token-2022 extension abuse. The transaction decoder parses System, SPL, Token-2022, Metaplex, Jupiter, Raydium, and Orca instructions into human-readable steps. Phone verification uses carrier lookup APIs to trace VOIP and spoofed numbers.

All scan engines feed into a unified scoring API. Results are cached in Supabase with 5 free scans/month for public users and unlimited access for $AGNTCBRO holders.