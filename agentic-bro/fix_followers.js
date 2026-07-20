const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://drvasofyghnxfxvkkwad.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.log('ERROR: SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixFollowers() {
  console.log('=== UPDATING FOLLOWERS COUNTS ===\n');
  
  const updates = [
    { handle: '@DianaSanchez_04', followers: 717000, risk_score: 2.8 },
    { handle: '@Degen_chad119', followers: 7800, risk_score: 2.2 },
    { handle: '@phantom', followers: 1200000, risk_score: 0.2 },
    { handle: '@JupiterExchange', followers: 500000, risk_score: 0.2 },
    { handle: '@RaydiumProtocol', followers: 450000, risk_score: 0.2 },
    { handle: '@opensea', followers: 2800000, risk_score: 0.2 },
    { handle: '@CoinDesk', followers: 3500000, risk_score: 0.1 },
    { handle: '@coingecko', followers: 2600000, risk_score: 0.1 },
    { handle: '@VitalikButerin', followers: 750000, risk_score: 0.1 },
    { handle: '@elonmusk', followers: 200000000, risk_score: 0.1 },
    { handle: '@naval', followers: 1200000, risk_score: 0.2 },
    { handle: '@balajis', followers: 950000, risk_score: 0.2 },
    { handle: '@a_wood_chuck', followers: 45000, risk_score: 1.5 },
    { handle: '@ThreadGuy1', followers: 120000, risk_score: 1.8 },
    { handle: '@Degen_News', followers: 85000, risk_score: 1.2 },
    { handle: '@whale_alert', followers: 1500000, risk_score: 0.2 },
    { handle: '@etherscan', followers: 800000, risk_score: 0.1 },
    { handle: '@dexscreener', followers: 650000, risk_score: 0.2 },
    { handle: '@Uniswap', followers: 950000, risk_score: 0.1 },
    { handle: '@SolanaFdn', followers: 1800000, risk_score: 0.1 },
    { handle: '@solana_floor', followers: 350000, risk_score: 0.3 },
    { handle: '@NFTCalendar_', followers: 150000, risk_score: 1.4 },
    { handle: '@agenticbro11', followers: 5000, risk_score: 0.3 },
    { handle: '@realcompany', followers: 10000, risk_score: 0.5 },
    { handle: '@johndoe_dev', followers: 5000, risk_score: 0.8 },
    { handle: '@MKTGweb3', followers: 25000, risk_score: 5.0 },
  ];
  
  for (const u of updates) {
    // Get the account ID first
    const { data: existing } = await supabase
      .from('legitimate_accounts')
      .select('id, x_handle')
      .or(`x_handle.eq.${u.handle},x_handle.eq.${u.handle.replace('@', '')}`)
      .single();
    
    if (existing) {
      const { error } = await supabase
        .from('legitimate_accounts')
        .update({ followers: u.followers, risk_score: u.risk_score })
        .eq('id', existing.id);
      
      if (error) {
        console.log(`✗ ${u.handle}: ${error.message}`);
      } else {
        console.log(`✓ ${u.handle}: ${u.followers.toLocaleString()} followers`);
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('legitimate_accounts')
        .insert({
          x_handle: u.handle,
          account_name: u.handle.replace('@', ''),
          platform: 'X',
          followers: u.followers,
          risk_score: u.risk_score,
          risk_level: 'LOW',
          verification_badge: true
        });
      
      if (error) {
        console.log(`✗ ${u.handle} (new): ${error.message}`);
      } else {
        console.log(`✓ ${u.handle} (new): ${u.followers.toLocaleString()} followers`);
      }
    }
  }
  
  // Verify
  console.log('\n=== VERIFICATION ===');
  const { data } = await supabase
    .from('legitimate_accounts')
    .select('x_handle, followers, risk_score')
    .order('followers', { ascending: false })
    .limit(15);
  
  console.log('\nTop legitimate accounts:');
  data?.forEach(a => {
    console.log(`   ${a.x_handle}: ${a.followers?.toLocaleString() || 0} followers (risk: ${a.risk_score})`);
  });
}

fixFollowers();