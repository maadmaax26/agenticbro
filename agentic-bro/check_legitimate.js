const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://drvasofyghnxfxvkkwad.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.log('ERROR: SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  // Check legitimate_accounts table
  const { data: legit, error: legitError } = await supabase
    .from('legitimate_accounts')
    .select('*')
    .order('followers', { ascending: false });
  
  if (legitError) {
    console.log('Legitimate accounts error:', legitError);
  } else {
    console.log('=== LEGITIMATE ACCOUNTS IN SUPABASE ===');
    console.log('Total:', legit?.length || 0);
    legit?.forEach((a, i) => {
      console.log(`\n${i + 1}. ${a.account_name || a.username}:`);
      console.log(`   Followers: ${a.followers}`);
      console.log(`   Platform: ${a.platform}`);
      console.log(`   X Handle: ${a.x_handle}`);
      console.log(`   Verification: ${a.verification_badge ? 'Blue Check' : 'None'}`);
      console.log(`   Risk Score: ${a.risk_score}`);
      console.log(`   Risk Level: ${a.risk_level}`);
    });
  }
  
  // Check known_scammers for legitimate entries
  const { data: scammers, error: scamError } = await supabase
    .from('known_scammers')
    .select('*')
    .in('verification_level', ['LEGITIMATE', 'VERIFIED', 'PAID PROMOTER']);
  
  if (scamError) {
    console.log('\nScammers error:', scamError);
  } else {
    console.log('\n=== LEGITIMATE IN KNOWN_SCAMMERS TABLE ===');
    console.log('Total:', scammers?.length || 0);
    scammers?.forEach((s, i) => {
      console.log(`\n${i + 1}. ${s.scammer_name || s.username}:`);
      console.log(`   Verification Level: ${s.verification_level}`);
      console.log(`   Risk Score: ${s.risk_score}`);
    });
  }
  
  // Check if AGNTCBRO is in known_scammers
  const { data: agntcbro, error: agntcbroError } = await supabase
    .from('known_scammers')
    .select('*')
    .or('username.ilike.%agntcbro%,display_name.ilike.%agntcbro%,x_handle.ilike.%agntcbro%');
  
  if (agntcbroError) {
    console.log('\nAGNTCBRO error:', agntcbroError);
  } else {
    console.log('\n=== AGNTCBRO ENTRIES IN KNOWN_SCAMMERS ===');
    console.log('Total:', agntcbro?.length || 0);
    agntcbro?.forEach((s, i) => {
      console.log(`\n${i + 1}. ${s.scammer_name || s.username}:`);
      console.log(`   Verification Level: ${s.verification_level}`);
      console.log(`   Risk Score: ${s.risk_score}`);
      console.log(`   Scam Type: ${s.scam_type}`);
    });
  }
}

checkData();