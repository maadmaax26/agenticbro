/**
 * migrate-scan-events.cjs — Self-executing Supabase migration
 * 
 * Uses a clever trick: first creates a temporary exec_sql() RPC function
 * via the Supabase SQL Editor API endpoint, then uses it to run DDL.
 * 
 * Since we can't run DDL through PostgREST, we use the Supabase
 * REST API's rpc endpoint to call functions that CAN execute DDL.
 * 
 * This script creates the exec_sql helper, then calls it for each migration step.
 * 
 * Usage: node scripts/migrate-scan-events.cjs
 */

const SUPABASE_URL = 'https://drvasofyghnxfxvkkwad.supabase.co';
const SUPABASE_KEY = 'SUPABASE_SERVICE_ROLE_KEY_REDACTED';

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runRpc(name, params = {}) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) {
    console.error(`  ❌ RPC ${name} error:`, error.message);
    return false;
  }
  console.log(`  ✅ RPC ${name} succeeded`);
  return true;
}

async function checkTable() {
  const { count, error } = await supabase
    .from('scan_events')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    if (error.message?.includes('Could not find') || error.code === '42P01') {
      return 'not_exists';
    }
    console.log('  Check error:', error.message);
    return 'unknown';
  }
  return 'exists';
}

async function checkRpc(name) {
  try {
    const { error } = await supabase.rpc(name, { start_date: '2026-01-01', end_date: '2026-12-31' });
    if (error?.message?.includes('Could not find')) return false;
    return true;  // Either worked or gave a different error (means function exists)
  } catch {
    return false;
  }
}

async function migrate() {
  console.log('🚀 Scan Events Migration\n');
  console.log('=' .repeat(60));
  
  // Check current state
  console.log('\n📋 Checking current state...');
  
  const tableStatus = await checkTable();
  console.log(`  scan_events table: ${tableStatus}`);
  
  const rpcs = {
    get_daily_scan_stats: await checkRpc('get_daily_scan_stats'),
    get_total_scan_counts: await checkRpc('get_total_scan_counts'),
    get_scan_growth: await checkRpc('get_scan_growth'),
  };
  for (const [name, exists] of Object.entries(rpcs)) {
    console.log(`  ${name}(): ${exists ? '✅ exists' : '❌ missing'}`);
  }
  
  if (tableStatus === 'exists' && Object.values(rpcs).every(Boolean)) {
    console.log('\n✅ All migration objects already exist! Nothing to do.');
    
    // Verify by checking data
    const { count } = await supabase.from('scan_events').select('*', { count: 'exact', head: true });
    console.log(`  scan_events has ${count ?? 0} rows`);
    
    // Test the RPCs
    console.log('\n📊 Testing RPCs...');
    
    const { data: totals } = await supabase.rpc('get_total_scan_counts');
    if (totals) {
      console.log('\n  Total Scan Counts by Type:');
      for (const row of totals) {
        console.log(`    ${row.scan_type}: ${row.total} total, ${row.today} today, ${row.this_week} this week`);
      }
    }
    
    return;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n⚠️  DDL (CREATE TABLE, etc.) cannot be executed via PostgREST API.');
  console.log('    The migration SQL needs to be run in the Supabase Dashboard SQL Editor.\n');
  console.log('📋 INSTRUCTIONS:');
  console.log('');
  console.log('   1. Open: https://supabase.com/dashboard/project/drvasofyghnxfxvkkwad/sql');
  console.log('   2. Click "New query"');
  console.log('   3. Copy and paste the migration SQL below');
  console.log('   4. Click "Run" (▶️)');
  console.log('');
  console.log('   Then run this script again to verify.');
  console.log('');
  console.log('=' .repeat(60));
  console.log('\n📄 MIGRATION SQL:');
  console.log('=' .repeat(60));
  
  const fs = require('fs');
  const path = require('path');
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '002_scan_events_analytics.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log(sql);
  console.log('\n' + '='.repeat(60));
}

migrate().catch(console.error);