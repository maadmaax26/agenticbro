import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types (based on SQL schema in README)
export interface User {
  id: string
  wallet_address: string
  created_at: string
  updated_at: string
}

export interface Roast {
  id: string
  user_id: string
  roast_text: string
  roast_type: 'portfolio' | 'trade' | 'general'
  created_at: string
  sentiment_score: number | null
}

export interface AnalyticsEvent {
  id: string
  event_type: 'wallet_connect' | 'roast_generated' | 'share'
  user_id: string | null
  metadata: Record<string, any>
  created_at: string
}