/**
 * In-memory session manager for Whale Chat.
 *
 * Sessions are keyed by wallet address and store:
 * - Chat history (last 50 messages for Ollama context)
 * - Active agent persona ('cipher' | 'alpha')
 * - Trading style preferences detected from conversation
 * - Risk tolerance profile
 *
 * Sessions expire after 30 minutes of inactivity.
 */

export type AgentMode = 'cipher' | 'alpha'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface TradingProfile {
  preferredAssets:  string[]    // assets mentioned most
  riskTolerance:    'low' | 'medium' | 'high' | 'unknown'
  tradingStyle:     'scalp' | 'swing' | 'position' | 'unknown'
  leveragePreference: number    // 0 = spot, 1-100 = leverage
}

export interface Session {
  walletAddress:  string
  agent:          AgentMode
  history:        ChatMessage[]
  profile:        TradingProfile
  lastActivity:   number
}

const SESSIONS = new Map<string, Session>()
const TTL_MS      = 30 * 60 * 1000  // 30 minutes
const MAX_HISTORY = 50

const DEFAULT_PROFILE: TradingProfile = {
  preferredAssets:    [],
  riskTolerance:      'unknown',
  tradingStyle:       'unknown',
  leveragePreference: 0,
}

// ─── Auto-cleanup every 5 minutes ────────────────────────────────────────────

setInterval(() => {
  const now = Date.now()
  for (const [addr, session] of SESSIONS) {
    if (now - session.lastActivity > TTL_MS) {
      SESSIONS.delete(addr)
      console.log(`[sessions] Expired session for ${addr.slice(0, 8)}…`)
    }
  }
}, 5 * 60 * 1000)

// ─── Profile inference ────────────────────────────────────────────────────────

function inferProfile(history: ChatMessage[]): Partial<TradingProfile> {
  const text = history.map(m => m.content).join(' ').toLowerCase()
  const update: Partial<TradingProfile> = {}

  // Assets
  const assetHits: Record<string, number> = {}
  for (const a of ['btc', 'eth', 'sol', 'bnb', 'xrp', 'doge']) {
    const count = (text.match(new RegExp(a, 'g')) ?? []).length
    if (count > 0) assetHits[a.toUpperCase()] = count
  }
  const sorted = Object.entries(assetHits).sort(([, a], [, b]) => b - a)
  if (sorted.length > 0) update.preferredAssets = sorted.slice(0, 3).map(([k]) => k)

  // Style
  if (/scalp|1m|5m|quick flip/.test(text))       update.tradingStyle = 'scalp'
  else if (/swing|4h|daily|week/.test(text))       update.tradingStyle = 'swing'
  else if (/position|month|long.term/.test(text))  update.tradingStyle = 'position'

  // Risk
  if (/20x|50x|100x|degen|ape/.test(text))         update.riskTolerance = 'high'
  else if (/5x|10x|leverage/.test(text))            update.riskTolerance = 'medium'
  else if (/spot|no leverage|safe/.test(text))      update.riskTolerance = 'low'

  // Leverage
  const levMatch = text.match(/(\d+)x/)
  if (levMatch) update.leveragePreference = Math.min(parseInt(levMatch[1], 10), 100)

  return update
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getOrCreateSession(walletAddress: string, agent: AgentMode = 'cipher'): Session {
  let session = SESSIONS.get(walletAddress)
  if (!session) {
    session = {
      walletAddress,
      agent,
      history:  [],
      profile:  { ...DEFAULT_PROFILE },
      lastActivity: Date.now(),
    }
    SESSIONS.set(walletAddress, session)
    console.log(`[sessions] New session for ${walletAddress.slice(0, 8)}… agent=${agent}`)
  } else {
    session.lastActivity = Date.now()
    // Update agent if caller specifies one
    if (agent !== session.agent) {
      session.agent = agent
      console.log(`[sessions] Switched to ${agent} for ${walletAddress.slice(0, 8)}…`)
    }
  }
  return session
}

export function appendToSession(
  walletAddress: string,
  messages: ChatMessage[],
  agent?: AgentMode,
): void {
  const session = getOrCreateSession(walletAddress, agent)
  session.history.push(...messages)
  if (session.history.length > MAX_HISTORY) {
    session.history = session.history.slice(-MAX_HISTORY)
  }
  // Re-infer profile from full history every 10 messages
  if (session.history.length % 10 === 0) {
    Object.assign(session.profile, inferProfile(session.history))
  }
  session.lastActivity = Date.now()
}

export function setSessionAgent(walletAddress: string, agent: AgentMode): void {
  const session = getOrCreateSession(walletAddress, agent)
  session.agent = agent
}

export function getSessionAgent(walletAddress: string): AgentMode {
  return SESSIONS.get(walletAddress)?.agent ?? 'cipher'
}

export function clearSession(walletAddress: string): void {
  SESSIONS.delete(walletAddress)
}

export function getSessionHistory(walletAddress: string): ChatMessage[] {
  return SESSIONS.get(walletAddress)?.history ?? []
}

export function getSessionProfile(walletAddress: string): TradingProfile {
  return SESSIONS.get(walletAddress)?.profile ?? { ...DEFAULT_PROFILE }
}
