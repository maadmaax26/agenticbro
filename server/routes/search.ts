/**
 * POST /api/search
 *
 * Routes research/news queries to the cloud Ollama instance (glm-4.7:cloud)
 * via Tailscale (OLLAMA_PRO_HOST = http://100.103.131.34:11434).
 *
 * Like /api/chat, this injects a real-time context block (live prices + today's
 * date) before the query so the model doesn't default to 2023 training data.
 *
 * Body: { query: string; assets?: string[] }
 * Returns: { content: string; sources: string[]; intent: string }
 */

import { Router, Request, Response } from 'express'
import { buildRoutingContext, buildSystemPrompt, extractAssets } from '../router.js'

const router = Router()

const OLLAMA_PRO_HOST  = process.env.OLLAMA_PRO_HOST  ?? 'http://localhost:11434'
const OLLAMA_PRO_MODEL = process.env.OLLAMA_PRO_MODEL ?? 'glm-4.7:cloud'
const OLLAMA_PRO_KEY   = process.env.OLLAMA_PRO_API_KEY ?? ''

// ─── POST /api/search ─────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { query, assets: assetsOverride } = req.body as {
    query?:  string
    assets?: string[]
  }

  if (!query) {
    res.status(400).json({ error: 'query is required' })
    return
  }

  // ── Build context block with live data ─────────────────────────────────────
  const assets = assetsOverride ?? extractAssets(query)
  const ctx    = await buildRoutingContext(query)
  const systemPrompt = buildSystemPrompt(ctx)

  const now = new Date()

  // Augment the user query with an explicit date reminder so the cloud model
  // doesn't try to recall news from training data
  const augmentedQuery = `Today's date is ${now.toUTCString()}.

${query}

Use the live market data in your system prompt for any price references.
List your sources at the end as: SOURCES: source1, source2, ...`

  console.log(`[search] intent=${ctx.intent} assets=${assets.join(',')} model=${OLLAMA_PRO_MODEL}`)

  try {
    const ollamaRes = await fetch(`${OLLAMA_PRO_HOST}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(OLLAMA_PRO_KEY ? { Authorization: `Bearer ${OLLAMA_PRO_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: OLLAMA_PRO_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: augmentedQuery },
        ],
        stream: false,
        options: { temperature: 0.3, num_ctx: 4096, num_predict: 768 },
      }),
    })

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text()
      console.error('[search] Ollama Pro error:', ollamaRes.status, errText)
      res.status(502).json({ error: `Ollama Pro returned ${ollamaRes.status}` })
      return
    }

    const data = await ollamaRes.json() as {
      message?: { content?: string }
    }

    const rawContent = data?.message?.content ?? ''

    // Extract SOURCES: line if the model included one
    const sourcesMatch = rawContent.match(/SOURCES:\s*(.+)/i)
    const sources = sourcesMatch
      ? sourcesMatch[1].split(',').map((s: string) => s.trim()).filter(Boolean)
      : []

    const content = rawContent.replace(/SOURCES:.*/is, '').trim()

    res.json({ content, sources, intent: ctx.intent })
  } catch (err) {
    console.error('[search] fetch error:', err)
    res.status(503).json({ error: `Could not reach Ollama Pro at ${OLLAMA_PRO_HOST}` })
  }
})

export default router
