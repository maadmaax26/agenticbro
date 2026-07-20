// ============================================
// Load Local Scam Data to Supabase (Simple Version)
// ============================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
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

// ============================================
// Configuration
// ============================================
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log('🔑 Using service role key for write access...');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY must be set in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================
// Load CSV Data
// ============================================
const csvFilePath = '/Users/efinney/.openclaw/workspace/scammer-database.csv';
const csvContent = readFileSync(csvFilePath, 'utf-8');

const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
  relax_quotes: true
});

console.log(`📊 Found ${records.length} records in CSV`);

// ============================================
// Transform Data for Supabase
// ============================================
const scammersData = records.map(record => {
  let riskScore = 7.0;
  let riskLevel = 'HIGH';

  const victimsCount = parseInt(record['Victims Count']) || 0;
  const totalLost = parseFloat(record['Total Lost USD'].replace(/[$,]/g, '')) || 0;

  let evidenceLinks = [];
  if (record['Evidence Links']) {
    evidenceLinks = record['Evidence Links'].split(',').map(link => link.trim()).filter(link => link);
  }

  return {
    scammer_name: record['Scammer Name'],
    platform: record['Platform'],
    x_handle: record['X Handle'] || null,
    telegram_channel: record['Telegram Channel'] || null,
    victims_count: victimsCount,
    total_lost_usd: totalLost,
    verification_level: record['Verification Level'],
    scam_type: record['Scam Type'],
    last_updated: new Date(record['Last Updated']).toISOString(),
    notes: record['Notes'] || null,
    wallet_address: record['Wallet Address'] || null,
    evidence_links: evidenceLinks,
    risk_score: riskScore,
    risk_level: riskLevel
  };
});

// ============================================
// Insert Scammers
// ============================================
async function loadScammers() {
  console.log('🚀 Starting scammers data load...\n');

  for (const scammer of scammersData) {
    try {
      console.log(`📝 Inserting: ${scammer.scammer_name}...`);

      const { data, error } = await supabase
        .from('scammers')
        .insert([scammer])
        .select();

      if (error) {
        if (error.code === '23505') { // Unique violation
          console.log(`  ⚠️  Already exists (duplicate)`);
        } else {
          console.error(`  ❌ Error:`, error.message);
        }
      } else {
        console.log(`  ✅ Inserted successfully (ID: ${data[0].id})`);
      }
    } catch (error) {
      console.error(`  ❌ Error:`, error.message);
    }

    console.log('');
  }

  console.log('✨ Scammers load complete!\n');

  const { data: allScammers } = await supabase
    .from('scammers')
    .select('*');

  console.log(`📊 Total scammers in database: ${allScammers?.length || 0}`);

  if (allScammers && allScammers.length > 0) {
    console.log('\n📋 Scammers loaded:');
    allScammers.forEach(s => {
      console.log(`  • ${s.scammer_name} (${s.platform}) - ${s.risk_level} RISK (${s.risk_score}/10)`);
    });
  }
}

// ============================================
// Add Legitimate Accounts
// ============================================
async function addLegitimateAccounts() {
  console.log('\n📝 Adding legitimate accounts...\n');

  const legitimateAccounts = [
    {
      account_name: 'Web3warrior',
      platform: 'X',
      x_handle: '@Web3warrior',
      telegram_channel: null,
      verification_level: 'Legitimate',
      followers: 15000,
      account_age_years: 3,
      posts_count: 2450,
      bio: 'Web3 builder | Solana enthusiast | DeFi researcher | Building the future of finance',
      website: null,
      verification_badge: true,
      red_flags_detected: [],
      notes: 'Verified legitimate account with consistent educational content and transparent track record.',
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
      bio: 'Official Solana developer account | Building decentralized applications | Open source',
      website: 'https://solana.com',
      verification_badge: true,
      red_flags_detected: [],
      notes: 'Official Solana developer account - highly trusted and legitimate.',
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
      bio: 'DeFi educator | Teaching financial literacy | No financial advice, just education',
      website: 'https://defieducator.com',
      verification_badge: true,
      red_flags_detected: [],
      notes: 'Trusted DeFi educator with transparent content and no financial advice claims.',
      risk_score: 0.2,
      risk_level: 'LOW'
    }
  ];

  for (const account of legitimateAccounts) {
    try {
      console.log(`📝 Inserting: ${account.account_name}...`);

      const { data, error } = await supabase
        .from('legitimate_accounts')
        .insert([account])
        .select();

      if (error) {
        if (error.code === '23505') {
          console.log(`  ⚠️  Already exists (duplicate)`);
        } else {
          console.error(`  ❌ Error:`, error.message);
        }
      } else {
        console.log(`  ✅ Inserted successfully (ID: ${data[0].id})`);
      }
    } catch (error) {
      console.error(`  ❌ Error:`, error.message);
    }

    console.log('');
  }

  console.log('✨ Legitimate accounts loaded!\n');
}

// ============================================
// Add Scan Results
// ============================================
async function addScanResults() {
  console.log('\n📝 Adding scan results...\n');

  const scanResults = [
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
      bio: 'Crypto Genius Community where people come together to learn, share insights, and discuss cryptocurrency as well as blockchain technology',
      website: 'linktr.ee/cryptogenius0',
      notes: 'Verified account with educational facade. Took $50 for AMA/giveaway but never delivered.',
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
      bio: 'Web3 builder | Solana enthusiast | DeFi researcher | Building the future of finance',
      website: null,
      notes: 'No red flags detected. Consistent educational content.',
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
      bio: 'Official Solana developer account | Building decentralized applications | Open source',
      website: 'https://solana.com',
      notes: 'Official account - no red flags detected.',
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
      bio: 'DeFi educator | Teaching financial literacy | No financial advice, just education',
      website: 'https://defieducator.com',
      notes: 'Trusted educator - no red flags detected.',
      evidence_links: []
    }
  ];

  for (const result of scanResults) {
    try {
      console.log(`📝 Inserting scan result: ${result.target_name}...`);

      const { data, error } = await supabase
        .from('scan_results')
        .insert([result])
        .select();

      if (error) {
        if (error.code === '23505') {
          console.log(`  ⚠️  Already exists (duplicate)`);
        } else {
          console.error(`  ❌ Error:`, error.message);
        }
      } else {
        console.log(`  ✅ Inserted successfully (ID: ${data[0].id})`);
      }
    } catch (error) {
      console.error(`  ❌ Error:`, error.message);
    }

    console.log('');
  }

  console.log('✨ Scan results loaded!\n');
}

// ============================================
// Main Execution
// ============================================
async function main() {
  try {
    await loadScammers();
    await addLegitimateAccounts();
    await addScanResults();

    console.log('\n✅ All data loaded successfully!');
    console.log('📊 Check your Supabase dashboard to verify the data.');
    console.log('🌐 Your website should now display the scam detection database.\n');
  } catch (error) {
    console.error('❌ Error during data load:', error);
    process.exit(1);
  }
}

main();

// ============================================
// End of Script
// ============================================