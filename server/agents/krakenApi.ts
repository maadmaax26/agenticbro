/**
 * Kraken API Integration
 *
 * Provides realtime cryptocurrency market data via Kraken's public API
 * Used as fallback/alternative to Binance API for WhaleChat
 *
 * API Documentation: https://docs.kraken.com/rest/
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KrakenTicker {
  pair: string;
  price: number;
  change24h: number;
  volume24h: number;
}

export interface KrakenFunding {
  pair: string;
  fundingRate: number;
  nextFundingTime: number;
}

export interface KrakenLiquidation {
  symbol: string;
  longLiq: number;   // Estimated long liquidations (USD)
  shortLiq: number;  // Estimated short liquidations (USD)
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Kraken asset pairs mapping
const KRAKEN_PAIRS: Record<string, string> = {
  'BTC':  'XXBTZUSD',
  'ETH':  'XETHZUSD', 
  'SOL':  'SOLUSD',
  'BNB':  'BNBUSD',
  'XRP':  'XXRPZUSD',
  'DOGE': 'XDGUSD',
};

// Asset names mapping
const KRAKEN_ASSETS: Record<string, string> = {
  'XXBT': 'BTC',
  'XETH': 'ETH',
  'SOL': 'SOL',
  'XRP': 'XRP',
  'XDG': 'DOGE',
};

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Fetch current ticker prices from Kraken
 */
export async function fetchKrakenTickers(): Promise<KrakenTicker[]> {
  try {
    console.log('[kraken] Fetching ticker prices...');
    
    const pairs = Object.values(KRAKEN_PAIRS).join(',');
    const res = await fetch(
      `https://api.kraken.com/0/public/Ticker?pair=${pairs}`,
      { 
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'AgenticBro/1.0'
        }
      }
    );

    if (!res.ok) {
      throw new Error(`Kraken API ${res.status}: ${res.statusText}`);
    }

    const data = await res.json() as {
      error: string[];
      result: Record<string, any>;
    };

    if (data.error && data.error.length > 0) {
      throw new Error(`Kraken API error: ${data.error.join(', ')}`);
    }

    if (!data.result) {
      throw new Error('No ticker data received from Kraken');
    }

    const tickers: KrakenTicker[] = [];

    for (const [pairKey, tickerData] of Object.entries(data.result)) {
      try {
        // Extract base asset from pair key (e.g., XXBTZUSD -> XXBT)
        const baseAsset = pairKey.slice(0, 4);
        const asset = KRAKEN_ASSETS[baseAsset] || pairKey.slice(0, 4);
        
        const c = tickerData.c; // [last trade closed, last trade closed]
        const price = parseFloat(c[0] || '0');
        const o = tickerData.o; // [open, open]
        const open = parseFloat(o[0] || '0');
        const v = tickerData.v; // [volume today, volume 24h]
        const volume24h = parseFloat(v[1] || '0');

        if (price > 0) {
          const change24h = open > 0 ? ((price - open) / open) * 100 : 0;
          
          tickers.push({
            pair: asset,
            price,
            change24h,
            volume24h,
          });
        }
      } catch (err) {
        console.warn(`[kraken] Failed to parse ticker ${pairKey}:`, err);
      }
    }

    console.log(`[kraken] Successfully fetched ${tickers.length} ticker prices`);
    return tickers;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[kraken] Error fetching tickers: ${errMsg}`);
    return [];
  }
}

/**
 * Fetch BTC price from Kraken
 */
export async function fetchKrakenBTCPrice(): Promise<number | null> {
  try {
    console.log('[kraken] Fetching BTC price...');
    
    const res = await fetch(
      `https://api.kraken.com/0/public/Ticker?pair=XXBTZUSD`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'AgenticBro/1.0'
        }
      }
    );

    if (!res.ok) {
      throw new Error(`Kraken API ${res.status}: ${res.statusText}`);
    }

    const data = await res.json() as {
      error: string[];
      result: Record<string, any>;
    };

    if (data.error && data.error.length > 0) {
      throw new Error(`Kraken API error: ${data.error.join(', ')}`);
    }

    const ticker = data.result?.XXBTZUSD;
    if (!ticker) {
      throw new Error('No BTC ticker data received');
    }

    const price = parseFloat(ticker.c[0] || '0');
    console.log(`[kraken] BTC price: ${price}`);
    return price > 0 ? price : null;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[kraken] Error fetching BTC price: ${errMsg}`);
    return null;
  }
}

/**
 * Fetch order book data from Kraken
 */
export async function fetchKrakenOrderbook(pair: string = 'BTC'): Promise<any | null> {
  try {
    const krakenPair = KRAKEN_PAIRS[pair];
    if (!krakenPair) {
      console.warn(`[kraken] No Kraken pair mapping for ${pair}`);
      return null;
    }

    console.log(`[kraken] Fetching order book for ${pair}...`);
    
    const res = await fetch(
      `https://api.kraken.com/0/public/Depth?pair=${krakenPair}&count=20`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'AgenticBro/1.0'
        }
      }
    );

    if (!res.ok) {
      throw new Error(`Kraken API ${res.status}: ${res.statusText}`);
    }

    const data = await res.json() as {
      error: string[];
      result: Record<string, { asks: any[]; bids: any[] }>;
    };

    if (data.error && data.error.length > 0) {
      throw new Error(`Kraken API error: ${data.error.join(', ')}`);
    }

    const orderbook = data.result?.[krakenPair];
    if (!orderbook) {
      throw new Error('No order book data received');
    }

    console.log(`[kraken] Successfully fetched order book for ${pair}`);
    return orderbook;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[kraken] Error fetching order book: ${errMsg}`);
    return null;
  }
}

/**
 * Estimate liquidation data from order book and market data
 * Kraken doesn't provide direct liquidation data, so we estimate from orderbook depth
 */
export async function fetchKrakenEstimatedLiquidations(pair: string = 'BTC'): Promise<KrakenLiquidation | null> {
  try {
    const orderbook = await fetchKrakenOrderbook(pair);
    if (!orderbook) {
      return null;
    }

    // Simple estimation: large orders at significant price levels could cause liquidations
    // This is a rough estimation - real liquidation data would need exchange-specific APIs
    
    const asks = orderbook.asks || []; // Sell orders (could trigger long liquidations)
    const bids = orderbook.bids || []; // Buy orders (could trigger short liquidations)

    // Estimate liquidation pressure from orderbook depth
    let longLiqPressure = 0;
    let shortLiqPressure = 0;

    // Look for large sell walls (potential long liquidation zones)
    for (const ask of asks.slice(0, 10)) {
      const price = parseFloat(ask[0]);
      const volume = parseFloat(ask[1]);
      // Large sell walls suggest strong resistance, could trigger long liquidations
      if (volume > 100) { // Threshold in BTC units
        longLiqPressure += volume * price;
      }
    }

    // Look for large buy walls (potential short liquidation zones)
    for (const bid of bids.slice(0, 10)) {
      const price = parseFloat(bid[0]);
      const volume = parseFloat(bid[1]);
      // Large buy walls suggest strong support, could trigger short liquidations
      if (volume > 100) { // Threshold in BTC units
        shortLiqPressure += volume * price;
      }
    }

    return {
      symbol: pair,
      longLiq: Math.round(longLiqPressure),
      shortLiq: Math.round(shortLiqPressure),
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[kraken] Error estimating liquidations: ${errMsg}`);
    return null;
  }
}

/**
 * Health check for Kraken API
 */
export async function checkKrakenHealth(): Promise<boolean> {
  try {
    const price = await fetchKrakenBTCPrice();
    return price !== null && price > 0;
  } catch {
    return false;
  }
}

// ─── Integration Functions ───────────────────────────────────────────────────

/**
 * Get comprehensive market data from Kraken
 */
export async function getKrakenMarketData(assets: string[]): Promise<{
  prices: KrakenTicker[];
  btcPrice: number | null;
  liquidations: KrakenLiquidation[];
}> {
  console.log('[kraken] Fetching comprehensive market data...');

  const tickers = await fetchKrakenTickers();
  const btcPrice = await fetchKrakenBTCPrice();
  
  // Fetch liquidations for requested assets
  const liquidationPromises = assets.filter(a => a === 'BTC').map(
    asset => fetchKrakenEstimatedLiquidations(asset)
  );
  const liquidationResults = await Promise.allSettled(liquidationPromises);
  const liquidations = liquidationResults
    .filter((r): r is PromiseFulfilledResult<KrakenLiquidation> => 
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => r.value);

  console.log('[kraken] Market data fetch complete:', {
    tickers: tickers.length,
    btcPrice,
    liquidations: liquidations.length
  });

  return {
    prices: tickers,
    btcPrice,
    liquidations,
  };
}