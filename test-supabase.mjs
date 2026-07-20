// ============================================
// Simple Supabase Connection Test
// ============================================

import { createClient } from '@supabase/supabase-js';

// ============================================
// Load .env.local manually
// ============================================
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
// Test Connection
// ============================================
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Testing Supabase connection...');
console.log('URL:', SUPABASE_URL);
console.log('Service Role Key:', SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Not set');
console.log('');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testConnection() {
  try {
    console.log('📊 Testing SELECT query...');
    const { data: statsData, error: statsError } = await supabase
      .from('stats')
      .select('*')
      .single();
    
    if (statsError) {
      console.error('❌ SELECT Error:', statsError.message);
      console.error('   Code:', statsError.code);
      console.error('   Details:', statsError.details);
    } else {
      console.log('✅ SELECT successful!');
      console.log('   Stats:', statsData);
    }
    
    console.log('');
    console.log('📝 Testing INSERT query...');
    const { data: insertData, error: insertError } = await supabase
      .from('scammers')
      .insert([{
        scammer_name: 'Test_Scammer_123',
        platform: 'X',
        x_handle: '@TestScammer123',
        telegram_channel: null,
        victims_count: 0,
        total_lost_usd: 0,
        verification_level: 'Verified',
        scam_type: 'Test',
        last_updated: new Date().toISOString(),
        notes: 'Test record',
        wallet_address: null,
        evidence_links: [],
        risk_score: 5.0,
        risk_level: 'MEDIUM'
      }])
      .select();
    
    if (insertError) {
      console.error('❌ INSERT Error:', insertError.message);
      console.error('   Code:', insertError.code);
      console.error('   Details:', insertError.details);
    } else {
      console.log('✅ INSERT successful!');
      console.log('   Inserted:', insertData);
      
      // Clean up test record
      console.log('🗑️  Cleaning up test record...');
      const { error: deleteError } = await supabase
        .from('scammers')
        .delete()
        .eq('scammer_name', 'Test_Scammer_123');
      
      if (deleteError) {
        console.error('❌ DELETE Error:', deleteError.message);
      } else {
        console.log('✅ DELETE successful!');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testConnection();