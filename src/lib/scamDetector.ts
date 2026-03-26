import axios from 'axios'

interface ScamToken {
  mintAddress: string
  name: string
  symbol: string
  description: string
  scamType: string
  confidence: number
}

interface ScamWallet {
  address: string
  type: string
  description: string
  confidence: number
  relatedTokens?: string[]
}

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

export class ScamDetector {
  /**
   * Check if a token is flagged as a scam
   */
  static async isScamToken(mintAddress: string): Promise<boolean> {
    try {
      const response = await axios.get<ScamToken[]>(`${API_BASE_URL}/api/scam/tokens`)
      return response.data.some(token => 
        token.mintAddress.toLowerCase() === mintAddress.toLowerCase()
      )
    } catch (error) {
      console.error('Error checking scam token:', error)
      return this.basicTokenCheck(mintAddress)
    }
  }

  /**
   * Check if a wallet address is flagged as a scam
   */
  static async isScamAddress(walletAddress: string): Promise<boolean> {
    try {
      const response = await axios.get<ScamWallet[]>(`${API_BASE_URL}/api/scam/wallets`)
      return response.data.some(wallet => 
        wallet.address.toLowerCase() === walletAddress.toLowerCase()
      )
    } catch (error) {
      console.error('Error checking scam wallet:', error)
      return this.basicAddressCheck(walletAddress)
    }
  }

  /**
   * Check if one token is impersonating another
   */
  static async checkTokenImpersonation(token1: string, token2: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/token-impersonation-scan`,
        { token1, token2 }
      )
      return response.data.isImpersonation || false
    } catch (error) {
      console.error('Error checking impersonation:', error)
      return false
    }
  }

  /**
   * Analyze a transaction for scam indicators
   */
  static async analyzeTransaction(walletAddress: string, transactionData: any): Promise<any> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/scan/wallet`,
        { walletAddress, transactionData }
      )
      return response.data
    } catch (error) {
      console.error('Error analyzing transaction:', error)
      return null
    }
  }

  /**
   * Get details about a scam token
   */
  static async getScamDetails(mintAddress: string): Promise<ScamToken | null> {
    try {
      const response = await axios.get<ScamToken[]>(`${API_BASE_URL}/api/scam/tokens`)
      const scamToken = response.data.find(token => 
        token.mintAddress.toLowerCase() === mintAddress.toLowerCase()
      )
      return scamToken || null
    } catch (error) {
      console.error('Error getting scam details:', error)
      return null
    }
  }

  /**
   * Get details about a scam wallet
   */
  static async getScamWalletDetails(walletAddress: string): Promise<ScamWallet | null> {
    try {
      const response = await axios.get<ScamWallet[]>(`${API_BASE_URL}/api/scam/wallets`)
      const scamWallet = response.data.find(wallet => 
        wallet.address.toLowerCase() === walletAddress.toLowerCase()
      )
      return scamWallet || null
    } catch (error) {
      console.error('Error getting scam wallet details:', error)
      return null
    }
  }

  /**
   * Scan a token address for scam indicators
   */
  static async scanToken(tokenAddress: string): Promise<any> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/token-impersonation-scan`,
        { contractAddress: tokenAddress }
      )
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
      const response = await axios.post(
        `${API_BASE_URL}/api/scan/wallet`,
        { walletAddress }
      )
      return response.data
    } catch (error) {
      console.error('Error scanning wallet:', error)
      throw new Error('Wallet scan failed')
    }
  }

  /**
   * Basic token check for suspicious patterns
   */
  private static basicTokenCheck(mintAddress: string): boolean {
    const suspiciousPatterns = [
      /^.{1,3}$/,        // Very short token names
      /[0-9]{10,}/,      // Numbers only or very long numbers
    ]
    return suspiciousPatterns.some(pattern => pattern.test(mintAddress))
  }

  /**
   * Basic address check for suspicious patterns
   */
  private static basicAddressCheck(walletAddress: string): boolean {
    const scamPatterns = [
      /^[A-Za-z0-9]{32}$/, // Very short addresses
      /^[A-Za-z0-9]{64}$/ // Long addresses (suspicious)
    ]
    return scamPatterns.some(pattern => pattern.test(walletAddress))
  }

  /**
   * Get list of all known scam tokens
   */
  static async getScamTokens(): Promise<ScamToken[]> {
    try {
      const response = await axios.get<ScamToken[]>(`${API_BASE_URL}/api/scam/tokens`)
      return response.data
    } catch (error) {
      console.error('Error fetching scam tokens:', error)
      return []
    }
  }

  /**
   * Get list of all known scam wallets
   */
  static async getScamWallets(): Promise<ScamWallet[]> {
    try {
      const response = await axios.get<ScamWallet[]>(`${API_BASE_URL}/api/scam/wallets`)
      return response.data
    } catch (error) {
      console.error('Error fetching scam wallets:', error)
      return []
    }
  }
}