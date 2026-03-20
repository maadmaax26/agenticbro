/**
 * AgenticBro Whale Tier — Express Proxy Server
 *
 * Routes:
 *   POST /api/chat          → local Ollama (qwen3.5:27b on Mac Studio)
 *   POST /api/search        → Ollama Pro cloud (glm-4.7:cloud)
 *   GET  /api/market/*      → CoinGecko + Binance + Bybit
 *   GET  /api/onchain/*     → Helius API (Solana on-chain)
 *   GET  /api/telegram/*    → Telegram MTProto alpha intelligence
 *
 * Start:  npx tsx watch server/index.ts
 * Port:   3001
 */

// ─── Load .env.local before anything else ────────────────────────────────────
// tsx/Node does not auto-load .env.local (that's Vite-only). We parse it
// manually so all process.env vars are available to every route module.
import { readFileSync } from 'fs'
import { resolve } from 'path'
;(function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    for (const raw of content.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '') // strip optional quotes
      if (key && !process.env[key]) process.env[key] = val              // don't overwrite shell exports
    }
  } catch { /* .env.local not present — fine in CI/production */ }
})()

import express, { Request, Response } from 'express'
import cors from 'cors'
import chatRouter from './routes/chat.js'
import searchRouter from './routes/search.js'
import marketRouter from './routes/market.js'
import onchainRouter from './routes/onchain.js'
import telegramRouter from './routes/telegram.js'

const app = express()
const PORT = parseInt(process.env.SERVER_PORT ?? '3001', 10)

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'http://localhost:5173',
      'http://localhost:4173',
      'https://agenticbro.app',
      'https://www.agenticbro.app',
      'https://maadmaax26.github.io',
    ]
    // Also allow any Vercel preview / production deployment
    if (!origin || allowed.includes(origin) || /\.vercel\.app$/.test(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked: ${origin}`))
    }
  },
  credentials: true,
}))

app.use(express.json({ limit: '2mb' }))

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/chat',     chatRouter)
app.use('/api/search',   searchRouter)
app.use('/api/market',   marketRouter)
app.use('/api/onchain',  onchainRouter)
app.use('/api/telegram', telegramRouter)

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[server] AgenticBro proxy running on http://localhost:${PORT}`)
  console.log(`[server] Ollama host:     ${process.env.OLLAMA_HOST ?? 'http://localhost:11434'}`)
  console.log(`[server] Ollama Pro host: ${process.env.OLLAMA_PRO_HOST ?? '(not set)'}`)
  console.log(`[server] Helius key:      ${process.env.HELIUS_API_KEY ? '✓ set' : '✗ missing'}`)
  console.log(`[server] Telegram:        ${process.env.TELEGRAM_SESSION_STRING ? '✓ configured' : '✗ not set (mock data mode)'}`)
})
