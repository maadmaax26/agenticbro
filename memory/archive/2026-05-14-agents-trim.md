# Archived AGENTS.md content (trimmed 2026-05-14)

## Troubleshooting (archived)
| Issue | Solution |
|-------|----------|
| Model cooldown cascade | Kill heavy models (`keep_alive:0`), wait for unload, retry |
| Telegram getUpdates conflict | Kill duplicate bot processes, restart gateway |
| Gateway token mismatch | `openclaw gateway restart` |
| Python blocked by exec preflight | Use `bash` wrapper scripts |
| Instagram login wall | Returns `PROFILE_LOGIN_REQUIRED` — use Chrome CDP instead |
| qwen3-coder:30b blocking VRAM | Force unload: `curl .../api/generate {"keep_alive":0}` |

## Key Decisions (archived — full list)
- **bash wrappers only** for all scanner scripts
- **accountId format:** `1003751594817` (no minus sign)
- **Chrome CDP port:** 18801
- **No system messages in group**
- **All cron jobs use `ollama/qwen3.5:9b`**
- **Nightly review uses `qwen3.5:9b`** — 180s timeout, escalation to kimi-k2.6:cloud
- **Reasoning OFF by default**
- **NO marketing pitches** — shut down immediately
- **Educational scam prevention hashtags ALLOWED** — #ScamPrevention, #CryptoSafety, #AGNTCBRO
- **NO offering work/services**
- **NO paid trending, boosts, growth hacking, fake engagement**
- **NO posting $AGNTCBRO price**
- **DO NOT yield on normal messages** — only on actual spam
- **NO post templates in group** — only in direct chat with Madmax
- **NO repeating same phrases** — be natural
- **NO warning tables/DON'T lists** — brief and positive
- **NO "don't buy don't sell"** — slogan is "Scan first, trust later!"
- **NO auto-scanning members** — only on explicit request
- **GroupAnonymousBot (1087968824)** is a real member, don't scan
- **NEVER scan-format responses in group** — only in DMs on request
- **NEVER use the name "Ben"**
- **Keep group messages SHORT** — 1-4 sentences
- **Ban "NO Buy" / "Don't Buy" members**
- **Auto-welcome new members** via Rose Bot announcements
- **ALL scan results include disclaimer** — educational, not financial advice, scan date
- **Scan reports show score values** — Risk X/10, flag points, behavioral pattern, disclaimer
- **Always specify platform** in scans
- **Only post in group:** natural conversation, greetings, educational scam tips

## Deprecated Cron Config
- ~~All cron jobs use `ollama/qwen3.5:4b`~~ — Now qwen3.5:9b for nightly review
- ~~Nightly review uses `ollama/qwen3.5:4b`~~ — Now 180s timeout with escalation