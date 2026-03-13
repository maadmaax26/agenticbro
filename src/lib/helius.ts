interface WalletStats {
  totalTrades: number
  winRate: number
  totalProfit: number
  totalLoss: number
  avgTradeSize: number
  gasSpent: number
  topToken: string
  degenScore: number
}

export async function fetchWalletStats(walletAddress: string): Promise<WalletStats> {
  const apiKey = (import.meta as any).env.VITE_HELIUS_API_KEY

  if (!apiKey) {
    console.warn('Helius API key not configured, using mock data')
    return getMockWalletStats()
  }

  try {
    // Fetch last 7 days of transactions
    const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
    const response = await fetch(
      `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${apiKey}&from=${sevenDaysAgo}`
    )

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.statusText}`)
    }

    const transactions = await response.json()

    // Analyze transactions
    const stats = analyzeTransactions(transactions)
    return stats
  } catch (error) {
    console.error('Failed to fetch wallet stats from Helius, falling back to mock:', error)
    return getMockWalletStats()
  }
}

function analyzeTransactions(_transactions: any[]): WalletStats {
  // TODO: Implement real transaction analysis
  // This would:
  // 1. Filter for swap transactions (Jupiter, Raydium, etc.)
  // 2. Calculate PnL for each trade (compare in/out values)
  // 3. Calculate win rate (profitable trades / total trades)
  // 4. Calculate degen score based on:
  //    - Number of small-cap tokens
  //    - Gas efficiency
  //    - Trade frequency
  //    - Time of day trades (degen hours = 2am-5am)

  return getMockWalletStats()
}

function getMockWalletStats(): WalletStats {
  return {
    totalTrades: Math.floor(Math.random() * 100) + 20,
    winRate: Math.floor(Math.random() * 60) + 20,
    totalProfit: Math.random() * 5000,
    totalLoss: Math.random() * 8000,
    avgTradeSize: Math.random() * 200 + 50,
    gasSpent: Math.random() * 300 + 50,
    topToken: ['BONK', 'WIF', 'POPCAT', 'MYRO', 'SLERF'][Math.floor(Math.random() * 5)],
    degenScore: Math.floor(Math.random() * 40) + 60
  }
}