interface RoastOptions {
  walletStats: {
    winRate: number
    totalProfit: number
    totalLoss: number
    degenScore: number
    totalTrades: number
    gasSpent: number
    topToken: string
  }
  roastType?: 'portfolio' | 'trade' | 'general'
}

interface RoastResponse {
  text: string
  sentiment: 'positive' | 'negative' | 'neutral'
}

// Configuration
const AI_PROVIDER = (import.meta as any).env.VITE_AI_PROVIDER || 'ollama' // 'ollama' or 'openai'
const OLLAMA_API_URL = (import.meta as any).env.VITE_OLLAMA_API_URL || 'https://api.ollama.com'
const OLLAMA_MODEL = (import.meta as any).env.VITE_OLLAMA_MODEL || 'glm-4.7:cloud'
const OPENAI_API_KEY = (import.meta as any).env.VITE_OPENAI_API_KEY

export async function generateRoast(options: RoastOptions): Promise<RoastResponse> {
  if (AI_PROVIDER === 'ollama') {
    return generateRoastWithOllama(options)
  } else if (AI_PROVIDER === 'openai' && OPENAI_API_KEY) {
    return generateRoastWithOpenAI(options)
  } else {
    console.warn('No AI provider configured, using mock roast')
    return generateMockRoast(options)
  }
}

async function generateRoastWithOllama(options: RoastOptions): Promise<RoastResponse> {
  try {
    const systemPrompt = `You are AgenticBro, a concise AI wallet risk analyst. Your job is to explain wallet behavior and trust risk clearly for Web3 users.

Rules:
- Keep insights under 280 characters
- Be specific about wallet behavior, trading outcomes, losses, fees, and concentration risk
- Use plain risk language suitable for consumers and businesses
- Do not insult the user
- If the wallet performed well, describe what looks healthier
- If the wallet performed poorly, explain the main risk signal

Sentiment analysis:
- 34% win rate or lower: negative risk insight
- 35-50% win rate: neutral/mildly negative
- 50%+ win rate: positive but cautious
- $100+ gas spent: note fee drag
- High risk score (70+): emphasize high-risk wallet behavior`

    const userPrompt = JSON.stringify({
      winRate: options.walletStats.winRate,
      totalProfit: options.walletStats.totalProfit,
      totalLoss: options.walletStats.totalLoss,
      degenScore: options.walletStats.degenScore,
      totalTrades: options.walletStats.totalTrades,
      gasSpent: options.walletStats.gasSpent,
      topToken: options.walletStats.topToken,
      roastType: options.roastType || 'portfolio'
    })

    const response = await fetch(`${OLLAMA_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.9,
        stream: false
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    const data = await response.json()
    const roastText = data.choices[0]?.message?.content?.trim() || "This wallet needs more context before AgenticBro can produce a reliable trust insight."

    // Determine sentiment
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral'
    if (options.walletStats.winRate < 40 || options.walletStats.totalLoss > options.walletStats.totalProfit) {
      sentiment = 'negative'
    } else if (options.walletStats.winRate >= 50) {
      sentiment = 'positive'
    }

    return { text: roastText, sentiment }
  } catch (error) {
    console.error('Failed to generate roast with Ollama, falling back to mock:', error)
    return generateMockRoast(options)
  }
}

async function generateRoastWithOpenAI(options: RoastOptions): Promise<RoastResponse> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  try {
    const systemPrompt = `You are AgenticBro, a concise AI wallet risk analyst. Your job is to explain wallet behavior and trust risk clearly for Web3 users.

Rules:
- Keep insights under 280 characters
- Be specific about wallet behavior, trading outcomes, losses, fees, and concentration risk
- Use plain risk language suitable for consumers and businesses
- Do not insult the user
- If the wallet performed well, describe what looks healthier
- If the wallet performed poorly, explain the main risk signal

Sentiment analysis:
- 34% win rate or lower: negative risk insight
- 35-50% win rate: neutral/mildly negative
- 50%+ win rate: positive but cautious
- $100+ gas spent: note fee drag
- High risk score (70+): emphasize high-risk wallet behavior`

    const userPrompt = JSON.stringify({
      winRate: options.walletStats.winRate,
      totalProfit: options.walletStats.totalProfit,
      totalLoss: options.walletStats.totalLoss,
      degenScore: options.walletStats.degenScore,
      totalTrades: options.walletStats.totalTrades,
      gasSpent: options.walletStats.gasSpent,
      topToken: options.walletStats.topToken,
      roastType: options.roastType || 'portfolio'
    })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.9,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const roastText = data.choices[0].message.content?.trim() || "This wallet needs more context before AgenticBro can produce a reliable trust insight."

    // Determine sentiment
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral'
    if (options.walletStats.winRate < 40 || options.walletStats.totalLoss > options.walletStats.totalProfit) {
      sentiment = 'negative'
    } else if (options.walletStats.winRate >= 50) {
      sentiment = 'positive'
    }

    return { text: roastText, sentiment }
  } catch (error) {
    console.error('Failed to generate roast with OpenAI, falling back to mock:', error)
    return generateMockRoast(options)
  }
}

function generateMockRoast(options: RoastOptions): RoastResponse {
  const { walletStats } = options
  const mockRoasts = [
    {
      condition: (stats: any) => stats.gasSpent > 100,
      text: "High fee drag detected: this wallet has spent enough on gas to materially reduce net performance.",
      sentiment: 'negative' as const
    },
    {
      condition: (stats: any) => stats.winRate < 35,
      text: `${options.walletStats.winRate}% win rate indicates weak trade selection. AgenticBro would flag this wallet for elevated execution risk.`,
      sentiment: 'negative' as const
    },
    {
      condition: (stats: any) => stats.degenScore >= 80,
      text: "High wallet risk intensity detected. Frequent speculative activity may require stronger transaction review before trust is assigned.",
      sentiment: 'negative' as const
    },
    {
      condition: (stats: any) => stats.totalLoss > stats.totalProfit * 2,
      text: "Losses materially exceed gains. AgenticBro would treat this wallet history as a caution signal until newer activity improves.",
      sentiment: 'negative' as const
    },
    {
      condition: (stats: any) => stats.winRate >= 50,
      text: "Positive wallet performance detected, but continued monitoring is recommended before treating this as a low-risk signal.",
      sentiment: 'neutral' as const
    },
    {
      condition: (stats: any) => stats.totalTrades > 50,
      text: `${options.walletStats.totalTrades} trades suggests high activity. Review concentration, fee drag, and counterparty exposure before relying on this wallet.`,
      sentiment: 'negative' as const
    },
  ]

  const matchingRoast = mockRoasts.find(r => r.condition(walletStats))
  return matchingRoast || {
    text: "AgenticBro found mixed wallet signals. More history, counterparties, and token context would improve the trust assessment.",
    sentiment: 'neutral'
  }
}
