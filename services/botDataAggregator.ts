/**
 * Bot Data Aggregator Service
 *
 * Collects signals, status, and metrics from all trading bots
 * Normalizes data and stores in Supabase
 */

import { createClient } from '@supabase/supabase-js';

// Types
export type BotSource = 'hyperliquid' | 'kraken' | 'mes' | 'polymarket';
export type SignalType = 'entry' | 'exit' | 'alert' | 'fill' | 'error';

export interface BotSignal {
  id: string;
  source: BotSource;
  type: SignalType;
  timestamp: Date;
  data: {
    [key: string]: any;
  };
}

export interface BotStatus {
  bot: BotSource;
  status: 'running' | 'stopped' | 'error';
  uptime: number; // percentage
  lastUpdate: Date;
  metrics: {
    winRate?: number;
    profitFactor?: number;
    dailyProfit?: number;
    openPositions?: number;
    sessionDD?: number;
    errors?: number;
  };
  positions?: Array<{
    symbol: string;
    side: 'long' | 'short';
    size: number;
    entryPrice: number;
    currentPrice?: number;
    pnl?: number;
  }>;
}

export interface PortfolioHealth {
  score: number;
  components: {
    profit: number; // 0-30
    winRate: number; // 0-25
    risk: number; // 0-20
    health: number; // 0-15
    efficiency: number; // 0-10
  };
  status: 'optimal' | 'good' | 'warning' | 'critical';
  lastCalculated: Date;
}

// Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export class BotDataAggregator {
  /**
   * Get all signals from all bots since a given timestamp
   */
  async getSignals(since?: Date): Promise<BotSignal[]> {
    const query = supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false });

    if (since) {
      query.gte('created_at', since.toISOString());
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching signals:', error);
      return [];
    }

    return data.map((signal: any) => ({
      id: signal.id,
      source: signal.source as BotSource,
      type: signal.type as SignalType,
      timestamp: new Date(signal.created_at),
      data: signal.data,
    }));
  }

  /**
   * Get current status of all bots
   */
  async getBotStatus(): Promise<BotStatus[]> {
    const { data, error } = await supabase
      .from('bot_status')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching bot status:', error);
      return [];
    }

    // Get the latest status for each bot
    const latestStatus: { [bot: string]: any } = {};

    for (const status of data || []) {
      if (!latestStatus[status.bot] || new Date(status.created_at) > new Date(latestStatus[status.bot].created_at)) {
        latestStatus[status.bot] = status;
      }
    }

    return Object.values(latestStatus).map((status: any) => ({
      bot: status.bot as BotSource,
      status: status.status.status as 'running' | 'stopped' | 'error',
      uptime: status.status.uptime || 0,
      lastUpdate: new Date(status.created_at),
      metrics: status.status.metrics || {},
      positions: status.status.positions || [],
    }));
  }

  /**
   * Get signals from a specific bot
   */
  async getSignalsByBot(bot: BotSource, limit: number = 50): Promise<BotSignal[]> {
    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .eq('source', bot)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Error fetching signals for ${bot}:`, error);
      return [];
    }

    return data.map((signal: any) => ({
      id: signal.id,
      source: signal.source as BotSource,
      type: signal.type as SignalType,
      timestamp: new Date(signal.created_at),
      data: signal.data,
    }));
  }

  /**
   * Get recent alerts
   */
  async getAlerts(limit: number = 20): Promise<BotSignal[]> {
    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .eq('type', 'alert')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching alerts:', error);
      return [];
    }

    return data.map((signal: any) => ({
      id: signal.id,
      source: signal.source as BotSource,
      type: signal.type as SignalType,
      timestamp: new Date(signal.created_at),
      data: signal.data,
    }));
  }

  /**
   * Calculate portfolio health score
   */
  async calculateHealthScore(): Promise<PortfolioHealth> {
    const botStatuses = await this.getBotStatus();

    // Aggregate metrics
    let totalProfit = 0;
    let totalWinRate = 0;
    let totalUptime = 0;
    let totalDD = 0;
    let profitFactor = 0;
    let activeBots = 0;

    for (const bot of botStatuses) {
      if (bot.status === 'running') {
        activeBots++;
        totalProfit += bot.metrics.dailyProfit || 0;
        totalWinRate += bot.metrics.winRate || 0;
        totalUptime += bot.uptime;
        totalDD += bot.metrics.sessionDD || 0;
        profitFactor += bot.metrics.profitFactor || 0;
      }
    }

    if (activeBots === 0) {
      return {
        score: 0,
        components: { profit: 0, winRate: 0, risk: 0, health: 0, efficiency: 0 },
        status: 'critical',
        lastCalculated: new Date(),
      };
    }

    // Calculate component scores
    const avgProfit = totalProfit / activeBots;
    const avgWinRate = totalWinRate / activeBots;
    const avgUptime = totalUptime / activeBots;
    const avgDD = totalDD / activeBots;
    const avgProfitFactor = profitFactor / activeBots;

    // Profit score (0-30)
    const profitScore = Math.min(30, Math.max(0, (avgProfit / 1000) * 30));

    // Win rate score (0-25)
    const winRateScore = Math.min(25, (avgWinRate / 100) * 25);

    // Risk score (0-20) - lower DD = higher score
    const riskScore = Math.min(20, Math.max(0, 20 - (avgDD * 10)));

    // Health score (0-15) - higher uptime = higher score
    const healthScore = Math.min(15, (avgUptime / 100) * 15);

    // Efficiency score (0-10) - higher profit factor = higher score
    const efficiencyScore = Math.min(10, (avgProfitFactor / 3) * 10);

    const totalScore = profitScore + winRateScore + riskScore + healthScore + efficiencyScore;

    // Determine status
    let status: 'optimal' | 'good' | 'warning' | 'critical';
    if (totalScore >= 75) status = 'optimal';
    else if (totalScore >= 50) status = 'good';
    else if (totalScore >= 25) status = 'warning';
    else status = 'critical';

    return {
      score: Math.round(totalScore),
      components: {
        profit: Math.round(profitScore),
        winRate: Math.round(winRateScore),
        risk: Math.round(riskScore),
        health: Math.round(healthScore),
        efficiency: Math.round(efficiencyScore),
      },
      status,
      lastCalculated: new Date(),
    };
  }

  /**
   * Get historical data for charts
   */
  async getHistoricalData(
    timeframe: 'hour' | 'day' | 'week' = 'day'
  ): Promise<{ timestamp: Date; value: number }[]> {
    const { data, error } = await supabase
      .from('bot_status')
      .select('created_at, status')
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error fetching historical data:', error);
      return [];
    }

    // Group by timeframe and aggregate profit
    const groupedData: { [key: string]: number[] } = {};

    for (const status of data || []) {
      const timestamp = new Date(status.created_at);
      let key: string;

      if (timeframe === 'hour') {
        key = timestamp.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      } else if (timeframe === 'day') {
        key = timestamp.toISOString().slice(0, 10); // YYYY-MM-DD
      } else {
        key = timestamp.toISOString().slice(0, 7); // YYYY-MM
      }

      if (!groupedData[key]) {
        groupedData[key] = [];
      }

      const profit = status.status?.metrics?.dailyProfit || 0;
      groupedData[key].push(profit);
    }

    // Calculate averages
    return Object.entries(groupedData).map(([key, values]) => ({
      timestamp: new Date(key),
      value: values.reduce((sum, v) => sum + v, 0) / values.length,
    }));
  }

  /**
   * Store a new signal (called by bots)
   */
  async storeSignal(signal: Omit<BotSignal, 'id'>): Promise<void> {
    const { error } = await supabase.from('signals').insert({
      source: signal.source,
      type: signal.type,
      data: signal.data,
      created_at: signal.timestamp,
    });

    if (error) {
      console.error('Error storing signal:', error);
    }
  }

  /**
   * Update bot status (called by bots)
   */
  async updateBotStatus(status: BotStatus): Promise<void> {
    const { error } = await supabase.from('bot_status').insert({
      bot: status.bot,
      status: {
        status: status.status,
        uptime: status.uptime,
        metrics: status.metrics,
        positions: status.positions,
      },
      created_at: new Date(),
    });

    if (error) {
      console.error('Error updating bot status:', error);
    }
  }
}

// Singleton instance
export const botDataAggregator = new BotDataAggregator();