# Venice Models and Pricing (April 12, 2026)

Updated from: https://docs.venice.ai/overview/pricing

**Note:** All prices per 1M tokens unless otherwise noted. Prices in USD.

---

## Venice Text Models

### Chat Completions

| Model | ID | Input Price | Output Price | Cache Read | Cache Write | Context | Privacy |
|-------|----|-------------|--------------|------------|-------------|---------|----------|
| **GLM 4.7** | `zai-org-glm-4.7` | $0.55 | $2.65 | $0.11 | - | 198K | Private |
| **GLM 4.6** | `zai-org-glm-4.6` | $0.85 | $2.75 | $0.30 | - | 198K | Private |
| **GLM 5** | `zai-org-glm-5` | $1.00 | $3.20 | $0.20 | - | 198K | Private |
| GLM 4.7 Flash | `zai-org-glm-4.7-flash` | $0.13 | $0.50 | - | - | 128K | Private |
| GLM 4.7 Flash Heretic | `olafangensan-glm-4.7-flash-heretic` | $0.14 | $0.80 | - | - | 200K | Private |
| **Kimi K2.5** | `kimi-k2-5` | $0.56 | $3.50 | $0.11 | - | 256K | Private |
| Kimi K2 Thinking | `kimi-k2-thinking` | $0.75 | $3.20 | $0.38 | - | 256K | Private |
| MiniMax M2.5 | `minimax-m25` | $0.34 | $1.19 | $0.04 | - | 198K | Private |
| MiniMax M2.7 | `minimax-m27` | $0.38 | $1.50 | $0.07 | - | 198K | Anonymized |
| Venice Uncensored 1.1 | `venice-uncensored` | $0.20 | $0.90 | - | - | 32K | Private |
| Venice Role Play Uncensored | `venice-uncensored-role-play` | $0.50 | $2.00 | - | - | 128K | Private |

### Other Notable Models

| Model | ID | Input Price | Output Price | Context | Privacy |
|-------|----|-------------|--------------|---------|----------|
| Claude Opus 4.5 | `claude-opus-4-5` | $6.00 | $30.00 | 198K | Anonymized |
| Claude Sonnet 4.5 | `claude-sonnet-4-5` | $3.75 | $18.75 | 198K | Anonymized |
| GPT-5.4 (Beta) | `openai-gpt-54` | $3.13 | $18.80 | 1000K | Anonymized |
| GPT-5.2 | `openai-gpt-52` | $2.19 | $17.50 | 256K | Anonymized |
| DeepSeek V3.2 | `deepseek-v3.2` | $0.33 | $0.48 | 160K | Private |
| Gemini 3 Pro Preview | `gemini-3-pro-preview` | $2.50 | $15.00 | 198K | Anonymized |
| Grok 4.20 Beta (Beta) | `grok-4-20-beta` | $2.50 | $7.50 | 2000K | Anonymized |
| Qwen 3.5 9B | `qwen3-5-9b` | $0.05 | $0.15 | 256K | Private |
| Qwen 3 Coder 480b | `qwen3-coder-480b-a35b-instruct` | $0.75 | $3.00 | 256K | Private |
| Qwen 3 Next 80b | `qwen3-next-80b` | $0.35 | $1.90 | 256K | Private |

---

## Venice Media Models

### Image Generation

#### Pro (High Quality)

| Model | ID | Price | Privacy |
|-------|----|-------|---------|
| Recraft V4 Pro | `recraft-v4-pro` | $0.29/image | Anonymized |
| GPT Image 1.5 | `gpt-image-1-5` | $0.26/image | Anonymized |
| Nano Banana Pro | `nano-banana-pro` | 1K: $0.18, 2K: $0.23, 4K: $0.35 | Anonymized |
| Qwen Image 2 Pro | `qwen-image-2-pro` | $0.10/image | Anonymized |

#### Standard

| Model | ID | Price | Privacy |
|-------|----|-------|---------|
| Flux 2 Max | `flux-2-max` | $0.09/image | Anonymized |
| ImagineArt 1.5 Pro | `imagineart-1.5-pro` | $0.06/image | Anonymized |
| Qwen Image 2 | `qwen-image-2` | $0.05/image | Anonymized |
| Recraft V4 | `recraft-v4` | $0.05/image | Anonymized |
| SeedreamV4.5 | `seedream-v4` | $0.05/image | Anonymized |
| SeedreamV5 Lite | `seedream-v5-lite` | $0.05/image | Anonymized |
| Flux 2 Pro | `flux-2-pro` | $0.04/image | Anonymized |
| Grok Imagine | `grok-imagine` | $0.04/image | Anonymized |

#### Budget (Free/Affordable)

| Model | ID | Price | Privacy |
|-------|----|-------|---------|
| Background Remover | `bria-bg-remover` | $0.03/image | Anonymized |
| Anime (WAI) | `wai-Illustrious` | $0.01/image | Private |
| Chroma | `chroma` | $0.01/image | Private |
| HiDream | `hidream` | $0.01/image | Private |
| Lustify SDXL | `lustify-sdxl` | $0.01/image | Private |
| Lustify v7 | `lustify-v7` | $0.01/image | Private |
| Qwen Image | `qwen-image` | $0.01/image | Private |
| Venice SD35 | `venice-sd35` | $0.01/image | Private |
| Z-Image Turbo | `z-image-turbo` | $0.01/image | Private |

### Audio

#### Text-to-Speech

| Model | ID | Per 1M Characters | Privacy |
|-------|----|-------------------|---------|
| Kokoro Text to Speech | `tts-kokoro` | $3.50 | Private |
| Qwen 3 TTS 0.6B | `tts-qwen3-0-6b` | $87.50 | Private |
| Qwen 3 TTS 1.7B | `tts-qwen3-1-7b` | $112.50 | Private |

#### Speech-to-Text

| Model | ID | Per Audio Second | Privacy |
|-------|----|------------------|---------|
| Parakeet ASR | `nvidia/parakeet-tdt-0.6b-v3` | $0.0001 | Private |
| Whisper Large V3 | `openai/whisper-large-v3` | $0.0001 | Private |

### Music

#### Duration-Based

| Model | ID | Duration Pricing | Privacy |
|-------|----|------------------|---------|
| ACE-Step 1.5 | `ace-step-15` | 60s: $0.03, 90s: $0.04, 120s: $0.05, 150s: $0.06, 180s: $0.07, 210s: $0.08 | Anonymized |
| ElevenLabs Music | `elevenlabs-music` | 60s: $0.87, 120s: $1.73, 180s: $2.59, 240s: $3.45 | Anonymized |

#### Per-Generation

| Model | ID | Per Generation | Privacy |
|-------|----|----------------|---------|
| MiniMax Music 2.0 | `minimax-music-v2` | $0.04 | Anonymized |
| Stable Audio 2.5 | `stable-audio-25` | $0.24 | Anonymized |

#### Sound Effects (Per-Second)

| Model | ID | Per Second | Privacy |
|-------|----|-----------|---------|
| ElevenLabs Sound Effects | `elevenlabs-sound-effects-v2` | $0.0023 | Anonymized |
| MMAudio V2 | `mmaudio-v2-text-to-audio` | $0.0009 | Anonymized |

### Video

Video pricing varies by resolution and duration. Key models include:

| Model | ID | Type | Pricing | Privacy |
|-------|----|------|---------|---------|
| Sora 2 | `sora-2-image-to-video` | Image to Video | Variable | Anonymized |
| Sora 2 | `sora-2-text-to-video` | Text to Video | Variable | Anonymized |
| Sora 2 Pro | `sora-2-pro-image-to-video` | Image to Video | Variable | Anonymized |
| Veo 3.1 | `veo3.1-fast-text-to-video` | Text to Video | Variable | Anonymized |
| Kling 2.6 Pro | `kling-2-6-pro-text-to-video` | Text to Video | Variable | Anonymized |
| Wan 2.6 | `wan-2-6-text-to-video` | Text to Video | Variable | Anonymized |
| LTX Video 2.3 | `ltx-2-v2-3-full-text-to-video` | Text to Video | Variable | Anonymized |
| Longcat | `longcat-text-to-video` | Text to Video | Variable | Private |

---

## Additional Features

### Web Search and Scraping

| Feature | Config | Pricing |
|---------|--------|---------|
| Web Search | `enable_web_search: true` | $10.00 per 1K requests |
| Web Scraping | `enable_web_scraping: true` | $10.00 per 1K URLs |
| X Search (xAI) | `enable_x_search: true` | $10.00 per 1K results |

**Notes:**
- Web Scraping automatically detects up to 5 URLs per request
- X Search enables xAI's native search for supported Grok models
- These charges apply in addition to standard model token pricing

---

## Payment Options

### USD & Crypto
- Buy API credits with credit card or cryptocurrency
- Credits never expire
- Same rates for USD and crypto

### Stake DIEM
- Each Diem = $1/day of credits that refresh daily
- 1 Diem = 1 day of compute

### Pro Users
- Pro subscribers receive a one-time $10 API credit when upgrading
- Use it to test and build small apps

---

## Current Venice Configuration (April 12, 2026)

### Configured Models

| Model | Type | Context | Status |
|-------|----|---------|--------|
| venice/glm-4.7 | text-only | 128K | Configured |
| venice/kimi-k2-5 | text+image | 250K | Configured (alias: Kimi K2.5) |
| venice/zai-org-glm-4.7 | text-only | 193K | ✅ Active |

### Current Session
- **Model**: venice/zai-org-glm-4.7 (GLM 4.7)
- **Pricing**: $0.55 input, $2.65 output per 1M tokens
- **Context**: 193K tokens
- **Privacy**: Private
- **Status**: Active and connected

### Recommended Models for Cost Control

| Use Case | Recommended Model | Price | Why |
|----------|-------------------|-------|-----|
| General purpose | `zai-org-glm-4.7-flash` | $0.13 in, $0.50 out | Fast, cheap, good quality |
| High quality | `zai-org-glm-4.7` | $0.55 in, $2.65 out | Best quality, reasonable price |
| Multi-modal | `kimi-k2-5` | $0.56 in, $3.50 out | Text + images |
| Budget friendly | `venice-uncensored` | $0.20 in, $0.90 out | Cheap for simple tasks |
| Coding | `zai-org-glm-5` | $1.00 in, $3.20 out | Strong coding capabilities |