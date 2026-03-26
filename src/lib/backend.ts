import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

/**
 * Backend service wrapper for Agentic Bro API
 */
export class BackendService {
  /**
   * Scan a token address for impersonation attempts
   */
  static async scanToken(tokenAddress: string): Promise<any> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/token-impersonation-scan`, {
        contractAddress: tokenAddress
      })
      return response.data
    } catch (error) {
      console.error('Error scanning token:', error)
      throw new Error('Token scan failed')
    }
  }

  /**
   * Scan a wallet address for scam indicators
   */
  static async scanWallet(walletAddress: string): Promise<any> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/scan/wallet`, {
        walletAddress
      })
      return response.data
    } catch (error) {
      console.error('Error scanning wallet:', error)
      throw new Error('Wallet scan failed')
    }
  }

  /**
   * Get list of scam tokens from database
   */
  static async getScamTokens(): Promise<any[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/scam/tokens`)
      return response.data
    } catch (error) {
      console.error('Error fetching scam tokens:', error)
      return []
    }
  }

  /**
   * Get list of scam wallets from database
   */
  static async getScamWallets(): Promise<any[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/scam/wallets`)
      return response.data
    } catch (error) {
      console.error('Error fetching scam wallets:', error)
      return []
    }
  }

  /**
   * Get dashboard data summary
   */
  static async getDashboardData(): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/dashboard`)
      return response.data
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      return null
    }
  }

  /**
   * Investigate a scammer (X/Telegram)
   */
  static async investigateScammer(username: string, platform: string): Promise<any> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/scam-detect`, {
        username,
        platform
      })
      return response.data
    } catch (error) {
      console.error('Error investigating scammer:', error)
      throw new Error('Scammer investigation failed')
    }
  }

  /**
   * Get token impersonation scan reports
   */
  static async getScanReports(): Promise<any[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/token-impersonation-scan/reports`)
      return response.data.reports || []
    } catch (error) {
      console.error('Error fetching scan reports:', error)
      return []
    }
  }

  /**
   * Get specific scan report
   */
  static async getScanReport(filename: string): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/token-impersonation-scan/report/${filename}`)
      return response.data.report
    } catch (error) {
      console.error('Error fetching scan report:', error)
      return null
    }
  }

  /**
   * Add scammer to database
   */
  static async addScammer(scammerData: any): Promise<any> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/scam/add`, scammerData)
      return response.data
    } catch (error) {
      console.error('Error adding scammer:', error)
      throw new Error('Failed to add scammer')
    }
  }

  /**
   * Health check for backend
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/health`)
      return response.data?.status === 'ok'
    } catch (error) {
      console.error('Backend health check failed:', error)
      return false
    }
  }

  /**
   * Get market data
   */
  static async getMarketData(token?: string): Promise<any> {
    try {
      const url = token 
        ? `${API_BASE_URL}/api/market/token/${token}`
        : `${API_BASE_URL}/api/market/tokens`
      
      const response = await axios.get(url)
      return response.data
    } catch (error) {
      console.error('Error fetching market data:', error)
      return null
    }
  }

  /**
   * Get on-chain data
   */
  static async getOnchainData(address: string): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/onchain/${address}`)
      return response.data
    } catch (error) {
      console.error('Error fetching on-chain data:', error)
      return null
    }
  }

  /**
   * Get Telegram group intelligence
   */
  static async getTelegramIntelligence(): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/telegram/intel`)
      return response.data
    } catch (error) {
      console.error('Error fetching Telegram intelligence:', error)
      return null
    }
  }
}