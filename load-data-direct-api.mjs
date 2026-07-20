// ============================================
// Direct API Insert to Supabase
// ============================================

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ============================================
// Load .env.local manually
// ============================================
function loadEnvLocal() {
  try {
    const content = readFileSync(resolve('.env.local'), 'utf-8');
    for (const raw of content.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch (error) {
    console.error('Error loading .env.local:', error.message);
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 Direct API Insert to Supabase...\n');

// ============================================
// Helper function to make API requests
// ============================================
async function supabaseRequest(table, data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

// ============================================
// Insert Scammer
// ============================================
async function insertScammer() {
  console.log('📝 Inserting scammer: Crypto_Genius09');
  
  try {
    const result = await supabaseRequest('scammers', [{
      scammer_name: 'Crypto_Genius09',
      platform: 'X',
      x_handle: '@Crypto_Genius09',
      telegram_channel: null,
      victims_count: 1,
      total_lost_usd: 50.00,
      verification_level: 'Verified',
      scam_type: 'AMA/Giveaway Fraud',
      last_updated: '2026-03-25',
      notes: 'Failed to host scheduled AMA after receiving $50 payment for giveaway.',
      wallet_address: null,
      evidence_links: ['https://x.com/Crypto_Genius09'],
      risk_score: 7.0,
      risk_level: 'HIGH'
    }]);
    
    console.log('✅ Scammer inserted successfully!');
    console.log('   ID:', result[0].id);
    return result[0].id;
  } catch (error) {
    console.error('❌ Error inserting scammer:', error.message);
    return null;
  }
}

// ============================================
// Insert Legitimate Accounts
// ============================================
async function insertLegitimateAccounts() {
  console.log('\n📝 Inserting legitimate accounts...');
  
  const accounts = [
    {
      account_name: 'Web3warrior',
      platform: 'X',
      x_handle: '@Web3warrior',
      telegram_channel: null,
      verification_level: 'Legitimate',
      followers: 15000,
      account_age_years: 3,
      posts_count: 2450,
      bio: 'Web3 builder | Solana enthusiast',
      website: null,
      verification_badge: true,
      red_flags_detected: [],
      notes: 'Verified legitimate account',
      risk_score: 0.5,
      risk_level: 'LOW'
    },
    {
      account_name: 'SolanaDevs',
      platform: 'X',
      x_handle: '@SolanaDevs',
      telegram_channel: null,
      verification_level: 'Legitimate',
      followers: 500000,
      account_age_years: 5,
      posts_count: 10000,
      bio: 'Official Solana developer account',
      website: 'https://solana.com',
      verification_badge: true,
      red_flags_detected: [],
      notes: 'Official account',
      risk_score: 0.0,
      risk_level: 'LOW'
    },
    {
      account_name: 'DeFi_Educator',
      platform: 'X',
      x_handle: '@DeFi_Educator',
      telegram_channel: 't.me/defieducator',
      verification_level: 'Legitimate',
      followers: 75000,
      account_age_years: 4,
      posts_count: 3200,
      bio: 'DeFi educator',
      website: 'https://defieducator.com',
      verification_badge: true,
      red_flags_detected: [],
      notes: 'Trusted educator',
      risk_score: 0.2,
      risk_level: 'LOW'
    }
  ];
  
  for (const account of accounts) {
    try {
      console.log(`   Inserting: ${account.account_name}`);
      const result = await supabaseRequest('legitimate_accounts', [account]);
      console.log(`   ✅ ${account.account_name} inserted successfully!`);
    } catch (error) {
      console.error(`   ❌ Error:`, error.message);
    }
  }
}

// ============================================
// Insert Scan Results
// ============================================
async function insertScanResults() {
  console.log('\n📝 Inserting scan results...');
  
  const results = [
    {
      target_name: 'Crypto_Genius09',
      platform: 'X',
      target_handle: '@Crypto_Genius09',
      scan_type: 'X Profile',
      guaranteed_returns: false,
      private_alpha: false,
      unrealistic_claims: false,
      urgency_tactics: false,
      no_track_record: false,
      requests_crypto: true,
      no_verification: false,
      fake_followers: false,
      new_account: false,
      vip_upsell: false,
      risk_score: 1.11,
      risk_level: 'MEDIUM',
      verification_level: 'Verified',
      followers: 20000,
      account_age_years: 6,
      posts_count: 544,
      verification_badge: true,
      bio: 'Crypto Genius Community',
      website: 'linktr.ee/cryptogenius0',
      notes: 'Took $50 for AMA but never delivered',
      evidence_links: ['https://x.com/Crypto_Genius09']
    },
    {
      target_name: 'Web3warrior',
      platform: 'X',
      target_handle: '@Web3warrior',
      scan_type: 'X Profile',
      guaranteed_returns: false,
      private_alpha: false,
      unrealistic_claims: false,
      urgency_tactics: false,
      no_track_record: false,
      requests_crypto: false,
      no_verification: false,
      fake_followers: false,
      new_account: false,
      vip_upsell: false,
      risk_score: 0.5,
      risk_level: 'LOW',
      verification_level: 'Legitimate',
      followers: 15000,
      account_age_years: 3,
      posts_count: 2450,
      verification_badge: true,
      bio: 'Web3 builder',
      website: null,
      notes: 'No red flags detected',
      evidence_links: []
    },
    {
      target_name: 'SolanaDevs',
      platform: 'X',
      target_handle: '@SolanaDevs',
      scan_type: 'X Profile',
      guaranteed_returns: false,
      private_alpha: false,
      unrealistic_claims: false,
      urgency_tactics: false,
      no_track_record: false,
      requests_crypto: false,
      no_verification: false,
      fake_followers: false,
      new_account: false,
      vip_upsell: false,
      risk_score: 0.0,
      risk_level: 'LOW',
      verification_level: 'Legitimate',
      followers: 500000,
      account_age_years: 5,
      posts_count: 10000,
      verification_badge: true,
      bio: 'Official Solana developer account',
      website: 'https://solana.com',
      notes: 'No red flags detected',
      evidence_links: []
    },
    {
      target_name: 'DeFi_Educator',
      platform: 'X',
      target_handle: '@DeFi_Educator',
      scan_type: 'X Profile',
      guaranteed_returns: false,
      private_alpha: false,
      unrealistic_claims: false,
      urgency_tactics: false,
      no_track_record: false,
      requests_crypto: false,
      no_verification: false,
      fake_followers: false,
      new_account: false,
      vip_upsell: false,
      risk_score: 0.2,
      risk_level: 'LOW',
      verification_level: 'Legitimate',
      followers: 75000,
      account_age_years: 4,
      posts_count: 3200,
      verification_badge: true,
      bio: 'DeFi educator',
      website: 'https://defieducator.com',
      notes: 'Trusted educator',
      evidence_links: []
    }
  ];
  
  for (const result of results) {
    try {
      console.log(`   Inserting: ${result.target_name}`);
      const apiResult = await supabaseRequest('scan_results', [result]);
      console.log(`   ✅ ${result.target_name} inserted successfully!`);
    } catch (error) {
      console.error(`   ❌ Error:`, error.message);
    }
  }
}

// ============================================
// Main Execution
// ============================================
async function main() {
  try {
    await insertScammer();
    await insertLegitimateAccounts();
    await insertScanResults();
    
    console.log('\n✅ All data loaded successfully!');
    console.log('🌐 Refresh your website and click "🔍 Scam Database" to see the data!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();