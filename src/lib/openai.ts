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
const AI_PROVIDER = import.meta.env.VITE_AI_PROVIDER || 'ollama' // 'ollama' or 'openai'
const OLLAMA_API_URL = import.meta.env.VITE_OLLAMA_API_URL || 'https://api.ollama.com'
const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'glm-4.7:cloud'
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY

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
    const systemPrompt = `You are AIBRO, a sarcastic AI degen advisor. Your job is to roast people's crypto portfolios brutally but humorously.

Rules:
- Keep roasts under 280 characters (tweetable)
- Be specific about their losses and degen behavior
- Use crypto slang and references
- Make it funny, not just mean
- If they did well, give backhanded compliments
- If they did poorly, emphasize the pain

Sentiment analysis:
- 34% win rate or lower: very negative roast
- 35-50% win rate: neutral/mildly negative
- 50%+ win rate: backhanded compliment
- $100+ gas spent: roast them for gas fees
- High degen score (70+): emphasize degen behavior`

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
    const roastText = data.choices[0]?.message?.content?.trim() || "Your portfolio is so confusing even I can't roast it properly."

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
    const systemPrompt = `You are AIBRO, a sarcastic AI degen advisor. Your job is to roast people's crypto portfolios brutally but humorously.

Rules:
- Keep roasts under 280 characters (tweetable)
- Be specific about their losses and degen behavior
- Use crypto slang and references
- Make it funny, not just mean
- If they did well, give backhanded compliments
- If they did poorly, emphasize the pain

Sentiment analysis:
- 34% win rate or lower: very negative roast
- 35-50% win rate: neutral/mildly negative
- 50%+ win rate: backhanded compliment
- $100+ gas spent: roast them for gas fees
- High degen score (70+): emphasize degen behavior`

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
    const roastText = data.choices[0].message.content?.trim() || "Your portfolio is so confusing even I can't roast it properly."

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
      text: "You spent more in gas fees than my college tuition. That's not trading, that's charity work for validators.",
      sentiment: 'negative' as const
    },
    {
      condition: (stats: any) => stats.winRate < 35,
      text: `${stats.winRate}% win rate? That's not bad for a blindfolded toddler throwing darts at a ticker tape. Maybe try staking SOL like a normal human.`,
      sentiment: 'negative' as const
    },
    {
      condition: (stats: any) => stats.degenScore >= 80,
      text: "Your degen score is higher than your IQ. You're not investing, you're gambling with extra steps and worse odds.",
      sentiment: 'negative' as const
    },
    {
      condition: (stats: any) => stats.totalLoss > stats.totalProfit * 2,
      text: "You didn't just get rugged, you sponsored multiple rugs. Your portfolio is more balanced than your therapist after your trading sessions.",
      sentiment: 'negative' as const
    },
    {
      condition: (stats: any) => stats.winRate >= 50,
      text: "Congratulations on actually making money! Too bad you're still degen enough to lose it all next week.",
      sentiment: 'neutral' as const
    },
    {
      condition: (stats: any) => stats.totalTrades > 50,
      text: `${stats.totalTrades} trades? That's not investing, that's an unpaid internship for liquidity providers.`,
      sentiment: 'negative' as const
    },
  ]

  const matchingRoast = mockRoasts.find(r => r.condition(walletStats))
  return matchingRoast || {
    text: "Your portfolio is a mystery wrapped in an enigma, wrapped in terrible decisions. Keep grinding, maybe you'll figure it out eventually.",
    sentiment: 'neutral'
  }
}