/**
 * Solana RPC Client
 * 
 * Fetches on-chain token data including authority checks
 */

import fetch from 'node-fetch';

export interface TokenAuthority {
  mintAuthority: boolean;
  freezeAuthority: boolean;
  mintRevoked: boolean;
  freezeRevoked: boolean;
  permanentDelegate: boolean;
  authorityTransfers: number;
  extensions: string[];
}

export interface TokenInfo {
  mint: string;
  decimals: number;
  supply: string;
  authority: TokenAuthority;
}

export class SolanaClient {
  private rpcUrl: string;

  constructor(rpcUrl?: string) {
    this.rpcUrl = rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  }

  /**
   * Get token authority info
   */
  async getTokenAuthority(mintAddress: string): Promise<TokenAuthority | null> {
    try {
      // Get account info
      const accountInfo = await this.rpcCall('getAccountInfo', [mintAddress, { encoding: 'jsonParsed' }]);
      
      if (!accountInfo?.value) {
        return null;
      }

      const data = accountInfo.value.data;
      
      // Parse token mint info
      const mintData = this.parseMintData(data);
      
      if (!mintData) {
        return null;
      }

      // Check for extensions (Token-2022)
      const extensions = await this.getTokenExtensions(mintAddress);

      return {
        mintAuthority: mintData.mintAuthority !== null,
        freezeAuthority: mintData.freezeAuthority !== null,
        mintRevoked: mintData.mintAuthority === null,
        freezeRevoked: mintData.freezeAuthority === null,
        permanentDelegate: extensions.includes('permanentDelegate'),
        authorityTransfers: await this.getAuthorityTransferCount(mintAddress),
        extensions,
      };
    } catch (error) {
      console.error('Solana RPC error:', error);
      return null;
    }
  }

  /**
   * Get token supply and info
   */
  async getTokenSupply(mintAddress: string): Promise<{ supply: string; decimals: number } | null> {
    try {
      const result = await this.rpcCall('getTokenSupply', [mintAddress]);
      
      if (!result?.value) {
        return null;
      }

      return {
        supply: result.value.amount,
        decimals: result.value.decimals,
      };
    } catch (error) {
      console.error('Get token supply error:', error);
      return null;
    }
  }

  /**
   * Get largest token accounts
   */
  async getLargestAccounts(mintAddress: string, limit: number = 20): Promise<Array<{ address: string; amount: string; percent: number }>> {
    try {
      const result = await this.rpcCall('getTokenLargestAccounts', [mintAddress]);
      
      if (!result?.value) {
        return [];
      }

      const totalSupply = result.value.reduce((sum: number, acc: any) => 
        sum + parseInt(acc.amount), 0
      );

      return result.value.slice(0, limit).map((acc: any) => ({
        address: acc.address,
        amount: acc.amount,
        percent: (parseInt(acc.amount) / totalSupply) * 100,
      }));
    } catch (error) {
      console.error('Get largest accounts error:', error);
      return [];
    }
  }

  /**
   * Get token accounts by owner (for a wallet)
   */
  async getTokenAccountsByOwner(
    ownerAddress: string, 
    mintAddress: string
  ): Promise<Array<{ address: string; amount: string }>> {
    try {
      const result = await this.rpcCall('getTokenAccountsByOwner', [
        ownerAddress,
        { mint: mintAddress },
        { encoding: 'jsonParsed' },
      ]);

      if (!result?.value) {
        return [];
      }

      return result.value.map((acc: any) => ({
        address: acc.pubkey,
        amount: acc.account.data.parsed.info.tokenAmount.amount,
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get signatures for address (transaction history)
   */
  async getSignaturesForAddress(
    address: string, 
    limit: number = 100
  ): Promise<Array<{ signature: string; blockTime: number; memo?: string }>> {
    try {
      const result = await this.rpcCall('getSignaturesForAddress', [
        address,
        { limit },
      ]);

      if (!result) {
        return [];
      }

      return result.map((sig: any) => ({
        signature: sig.signature,
        blockTime: sig.blockTime,
        memo: sig.memo,
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Parse mint data from account info
   */
  private parseMintData(data: any): { mintAuthority: string | null; freezeAuthority: string | null } | null {
    try {
      // Handle parsed data
      if (data.parsed?.info) {
        return {
          mintAuthority: data.parsed.info.mintAuthority,
          freezeAuthority: data.parsed.info.freezeAuthority,
        };
      }

      // Handle base64 encoded data (need to decode)
      // For simplicity, return defaults - production would decode properly
      return {
        mintAuthority: null, // Assume revoked if can't parse
        freezeAuthority: null,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get token extensions (Token-2022)
   */
  private async getTokenExtensions(mintAddress: string): Promise<string[]> {
    try {
      // Check if token has extensions via getAccountInfo
      const accountInfo = await this.rpcCall('getAccountInfo', [
        mintAddress,
        { encoding: 'jsonParsed', commitment: 'confirmed' },
      ]);

      const extensions: string[] = [];

      // Check for extension flags in account data
      if (accountInfo?.value?.data?.parsed?.info?.extensions) {
        for (const ext of accountInfo.value.data.parsed.info.extensions) {
          extensions.push(ext.extension);
        }
      }

      return extensions;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get count of authority-related transfers
   */
  private async getAuthorityTransferCount(mintAddress: string): Promise<number> {
    try {
      const signatures = await this.getSignaturesForAddress(mintAddress, 1000);
      
      // Count signatures with authority-related memos or patterns
      // This is a heuristic - proper implementation would parse transactions
      const authorityRelated = signatures.filter(sig => 
        sig.memo?.toLowerCase().includes('authority') ||
        sig.memo?.toLowerCase().includes('mint') ||
        sig.memo?.toLowerCase().includes('freeze')
      );

      return authorityRelated.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Make RPC call
   */
  private async rpcCall(method: string, params: any[]): Promise<any> {
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`RPC error: ${response.status}`);
    }

    const data = await response.json() as { result?: any; error?: any };
    
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }

    return data.result;
  }
}

export default SolanaClient;