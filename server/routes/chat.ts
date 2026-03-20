/**
 * POST /api/chat
 *
 * Proxies to the local Ollama instance (qwen3.5:27b on Mac Studio) with:
 * - Dual-agent support: Cipher (analytical) and Alpha (aggressive)
 * - SubagentRouter: intent → DataAgent / SignalAgent / AnalysisAgent / ReportAgent
 * - Real-time data injection (live prices, funding rates)
 * - Per-wallet session memory + trading profile inference
 * - SSE streaming response
 *
 * Body: { walletAddress: string; message: string; agent?: 'cipher' | 'alpha' }
 * Streams: text/event-stream → { content, done, meta: { intent, subAgent, model, agent } }
 */

import { Router, Request, Response } from 'express'
import {
  appendToSession, clearSession, getSessionHistory,
  getSessionProfile, setSessionAgent, type AgentMode,
} from '../sessions.js'
import { buildRoutingContext, buildSystemPrompt } from '../router.js'
import { streamRealtimeAgent } from '../agents/realtimeDataAgent.js'

const router = Router()

const OLLAMA_HOST             = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
const OLLAMA_TIMEOUT          = parseInt(process.env.OLLAMA_TIMEOUT_MS ?? '30000', 10)
const OLLAMA_REALTIME_TIMEOUT = parseInt(process.env.OLLAMA_REALTIME_TIMEOUT_MS ?? '180000', 10)

// ─── POST /api/chat ───────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { walletAddress, message, agent: agentParam } = req.body as {
    walletAddress?: string
    message?:       string
    agent?:         AgentMode
  }

  if (!walletAddress || !message) {
    res.status(400).json({ error: 'walletAddress and message are required' })
    return
  }

  const agent: AgentMode = agentParam === 'alpha' ? 'alpha' : 'cipher'

  // Persist agent choice to session
  setSessionAgent(walletAddress, agent)

  // ── Route + inject live data ──────────────────────────────────────────────
  const profile = getSessionProfile(walletAddress)
  const ctx     = await buildRoutingContext(message, agent, profile)
  const systemPrompt = buildSystemPrompt(ctx, profile)

  // ── Build message array (cap history at 8 to keep context tight) ──────────
  const history  = getSessionHistory(walletAddress).slice(-8)
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history,
    { role: 'user' as const, content: message },
  ]

  appendToSession(walletAddress, [{ role: 'user', content: message }], agent)

  // ── SSE setup ─────────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Ack frame — client knows routing is complete, shows typing indicator immediately
  res.write(`data: ${JSON.stringify({
    ack: true,
    freshness: ctx.freshness,
    meta: {
      intent:   ctx.intent,
      subAgent: ctx.subAgent,
      model:    ctx.modelName,
      agent:    ctx.agent,
    },
  })}\n\n`)

  let fullContent = ''

  // AbortController — shared across all model paths
  const abort = new AbortController()

  // Hard deadline — cancelled as soon as the first token arrives
  const deadline = setTimeout(() => {
    console.warn('[chat] Ollama deadline exceeded, aborting')
    abort.abort()
  }, OLLAMA_TIMEOUT)

  // Clean up if client disconnects early
  res.on('close', () => abort.abort())

  try {
    // ── Path A: RealtimeDataAgent — FRESH queries ──────────────────────────
    if (ctx.targetModel === 'realtime') {
      console.log(`[chat] → RealtimeDataAgent (${ctx.modelName}) intent=${ctx.intent} assets=${ctx.assets.join(',')}`)

      // The base 30s deadline is far too short for realtime:
      // parallel data fetches (~5-10s) + model warmup + token streaming.
      // Clear it immediately and replace with the realtime-specific timeout (default 90s).
      clearTimeout(deadline)
      const realtimeDeadline = setTimeout(() => {
        console.warn('[chat] Realtime agent deadline exceeded, aborting')
        abort.abort()
      }, OLLAMA_REALTIME_TIMEOUT)

      const userAssistantHistory = history.filter(
        (m): m is { role: 'user' | 'assistant'; content: string } =>
          m.role === 'user' || m.role === 'assistant'
      )

      try {
        fullContent = await streamRealtimeAgent({
          query:     message,
          intent:    ctx.intent,
          subAgent:  ctx.subAgent,
          assets:    ctx.assets,
          agentMode: agent,
          history:   userAssistantHistory,
          res,
          abort,
        })
        appendToSession(walletAddress, [{ role: 'assistant', content: fullContent }], agent)
      } catch (realtimeErr) {
        // Write error into the SSE stream before ending — client must see it
        const isAbort = realtimeErr instanceof Error && realtimeErr.name === 'AbortError'
        const errMsg  = isAbort
          ? 'Request timed out — model may be loading. Try again in a moment.'
          : `Realtime agent error: ${realtimeErr instanceof Error ? realtimeErr.message.slice(0, 120) : String(realtimeErr)}`
        console.error('[chat] RealtimeAgent error:', realtimeErr)
        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
      } finally {
        clearTimeout(realtimeDeadline)
        res.end()
      }
      return
    }

    // ── Path B: Local / cloud Ollama (CACHED + STATIC + news) ─────────────
    const targetHost =
      ctx.targetModel === 'cloud'
        ? (process.env.OLLAMA_PRO_HOST ?? 'http://localhost:11434')
        : OLLAMA_HOST

    const ollamaRes = await fetch(`${targetHost}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  abort.signal,
      body: JSON.stringify({
        model:    ctx.modelName,
        messages,
        stream:   true,
        options: {
          temperature: ctx.agent === 'alpha' ? 0.7 : 0.5,
          num_ctx: 4096,
          num_predict: 1024,
        },
      }),
    })

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text()
      console.error('[chat] Ollama error:', ollamaRes.status, errText)
      res.write(`data: ${JSON.stringify({ error: `Ollama ${ollamaRes.status}: ${errText.slice(0, 120)}` })}\n\n`)
      res.end()
      return
    }

    if (!ollamaRes.body) {
      res.write(`data: ${JSON.stringify({ error: 'No response body from Ollama' })}\n\n`)
      res.end()
      return
    }

    const reader  = ollamaRes.body.getReader()
    const decoder = new TextDecoder()
    let firstToken = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text  = decoder.decode(value, { stream: true })
      const lines = text.split('\n').filter(l => l.trim())

      for (const line of lines) {
        try {
          const chunk = JSON.parse(line) as {
            message?: { content?: string }
            done?:    boolean
          }

          if (chunk.message?.content) {
            if (!firstToken) {
              clearTimeout(deadline)
              firstToken = true
            }
            fullContent += chunk.message.content
            res.write(`data: ${JSON.stringify({ content: chunk.message.content, done: false })}\n\n`)
          }

          if (chunk.done) {
            appendToSession(walletAddress, [{ role: 'assistant', content: fullContent }], agent)
            res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`)
          }
        } catch {
          // Malformed JSON chunk — skip
        }
      }
    }
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError'
    if (isAbort) {
      console.warn('[chat] request aborted (timeout or client disconnect)')
      res.write(`data: ${JSON.stringify({ error: 'Request timed out — model may be loading. Try again in a moment.' })}\n\n`)
    } else {
      console.error('[chat] fetch error:', err)
      res.write(`data: ${JSON.stringify({ error: 'Could not reach model — check server logs.' })}\n\n`)
    }
  } finally {
    clearTimeout(deadline)
    res.end()
  }
})

// ─── DELETE /api/chat/session ─────────────────────────────────────────────────

router.delete('/session', (req: Request, res: Response): void => {
  const { walletAddress } = req.body as { walletAddress?: string }
  if (!walletAddress) {
    res.status(400).json({ error: 'walletAddress is required' })
    return
  }
  clearSession(walletAddress)
  res.json({ cleared: true })
})

export default router
