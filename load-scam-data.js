// ============================================
// Load Local Scam Data to Supabase
// ============================================
// Purpose: Load scammer data from CSV to Supabase tables
// Created: March 25, 2026
// ============================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const csv = require('csv-parse/sync');

// ============================================
// Configuration
// ============================================
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// Load CSV Data
// ============================================
const csvFilePath = '/Users/efinney/.openclaw/workspace/scammer-database.csv';
const csvContent = fs.readFileSync(csvFilePath, 'utf-8');

// Parse CSV
const records = csv.parse(csvContent, {
  columns: true,
  skip_empty_lines: true
});

console.log(`📊 Found ${records.length} records in CSV`);

// ============================================
// Transform Data for Supabase
// ============================================
const scammersData = records.map(record => {
  // Calculate risk score based on verification level and victims
  let riskScore = 0;
  let riskLevel = 'LOW';

  if (record['Verification Level'] === 'Verified' || record['Verification Level'] === 'High Risk') {
    riskScore = 7.0;
    riskLevel = 'HIGH';
  } else if (record['Verification Level'] === 'Partially Verified') {
    riskScore = 5.0;
    riskLevel = 'MEDIUM';
  }

  // Increase risk score based on victims and losses
  const victimsCount = parseInt(record['Victims Count']) || 0;
  const totalLost = parseFloat(record['Total Lost USD'].replace(/[$,]/g, '')) || 0;

  if (victimsCount > 5 || totalLost > 1000) {
    riskScore = Math.min(riskScore + 2, 10);
    if (riskScore >= 7) riskLevel = 'HIGH';
    if (riskScore >= 9) riskLevel = 'CRITICAL';
  }

  // Parse evidence links
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
// Insert into Supabase
// ============================================
async function loadScammers() {
  console.log('🚀 Starting data load...\n');

  for (const scammer of scammersData) {
    try {
      console.log(`📝 Inserting: ${scammer.scammer_name}...`);

      // Check if scammer already exists
      const { data: existing } = await supabase
        .from('scammers')
        .select('id')
        .eq('scammer_name', scammer.scammer_name)
        .single();

      if (existing) {
        console.log(`  ⚠️  Already exists, updating...`);
        
        // Update existing record
        const { error } = await supabase
          .from('scammers')
          .update({
            victims_count: scammer.victims_count,
            total_lost_usd: scammer.total_lost_usd,
            verification_level: scammer.verification_level,
            scam_type: scammer.scam_type,
            last_updated: scammer.last_updated,
            notes: scammer.notes,
            wallet_address: scammer.wallet_address,
            evidence_links: scammer.evidence_links,
            risk_score: scammer.risk_score,
            risk_level: scammer.risk_level,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) {
          console.error(`  ❌ Error updating:`, error.message);
        } else {
          console.log(`  ✅ Updated successfully`);
        }
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from('scammers')
          .insert([scammer])
          .select();

        if (error) {
          console.error(`  ❌ Error inserting:`, error.message);
        } else {
          console.log(`  ✅ Inserted successfully (ID: ${data[0].id})`);
        }
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${scammer.scammer_name}:`, error.message);
    }

    console.log('');
  }

  console.log('✨ Data load complete!\n');

  // Verify data
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
// Also add some legitimate accounts (from the seed data)
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

      // Check if account already exists
      const { data: existing } = await supabase
        .from('legitimate_accounts')
        .select('id')
        .eq('account_name', account.account_name)
        .single();

      if (existing) {
        console.log(`  ⚠️  Already exists, skipping...`);
      } else {
        const { data, error } = await supabase
          .from('legitimate_accounts')
          .insert([account])
          .select();

        if (error) {
          console.error(`  ❌ Error inserting:`, error.message);
        } else {
          console.log(`  ✅ Inserted successfully (ID: ${data[0].id})`);
        }
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${account.account_name}:`, error.message);
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

      // Check if scan result already exists
      const { data: existing } = await supabase
        .from('scan_results')
        .select('id')
        .eq('target_handle', result.target_handle)
        .single();

      if (existing) {
        console.log(`  ⚠️  Already exists, skipping...`);
      } else {
        const { data, error } = await supabase
          .from('scan_results')
          .insert([result])
          .select();

        if (error) {
          console.error(`  ❌ Error inserting:`, error.message);
        } else {
          console.log(`  ✅ Inserted successfully (ID: ${data[0].id})`);
        }
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${result.target_name}:`, error.message);
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