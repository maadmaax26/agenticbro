const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://drvasofyghnxfxvkkwad.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.log('ERROR: SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupScammers() {
  console.log('=== CLEANING UP SCAMMERS TABLE ===\n');
  
  // Check remaining issues
  const { data: allScammers } = await supabase
    .from('known_scammers')
    .select('username, display_name, verification_level, risk_score, scam_type')
    .order('risk_score', { ascending: false })
    .limit(50);
  
  console.log('Current scammers in database:');
  const issues = [];
  allScammers?.forEach(s => {
    const v = (s.verification_level || '').toUpperCase();
    if (['LEGITIMATE', 'VERIFIED', 'PAID PROMOTER'].includes(v)) {
      issues.push(s);
    }
    if ((s.username || '').toLowerCase().includes('agntcbro') || 
        (s.display_name || '').toLowerCase().includes('agntcbro')) {
      issues.push(s);
    }
  });
  
  console.log(`Total: ${allScammers?.length || 0}`);
  console.log(`Issues found: ${issues.length}`);
  
  if (issues.length > 0) {
    console.log('\nProblematic entries:');
    issues.forEach(i => {
      console.log(`   ${i.username}: ${i.verification_level} (${i.risk_score}) - ${i.scam_type}`);
    });
    
    // Delete all issues
    console.log('\nRemoving problematic entries...');
    
    // Delete by verification level
    const { error: err1, count: c1 } = await supabase
      .from('known_scammers')
      .delete()
      .in('verification_level', ['LEGITIMATE', 'VERIFIED', 'PAID PROMOTER', 'Legitimate', 'Verified', 'Paid Promoter']);
    
    if (err1) console.log('Error deleting by verification_level:', err1.message);
    else console.log(`   ✓ Removed ${c1 || 0} by verification_level`);
    
    // Delete AGNTCBRO entries
    const { error: err2, count: c2 } = await supabase
      .from('known_scammers')
      .delete()
      .or('username.ilike.%agntcbro%,display_name.ilike.%agntcbro%');
    
    if (err2) console.log('Error deleting AGNTCBRO:', err2.message);
    else console.log(`   ✓ Removed ${c2 || 0} AGNTCBRO entries`);
  }
  
  // Final verification
  console.log('\n=== FINAL VERIFICATION ===');
  const { data: final } = await supabase
    .from('known_scammers')
    .select('username, verification_level, risk_score')
    .order('risk_score', { ascending: false })
    .limit(15);
  
  console.log('\nTop scammers (should all be HIGH RISK):');
  final?.forEach(s => {
    console.log(`   ${s.username}: ${s.verification_level} (${s.risk_score})`);
  });
  
  // Count by verification level
  const { data: stats } = await supabase
    .from('known_scammers')
    .select('verification_level');
  
  const counts = {};
  stats?.forEach(s => {
    const v = s.verification_level || 'UNKNOWN';
    counts[v] = (counts[v] || 0) + 1;
  });
  
  console.log('\nVerification level distribution:');
  Object.entries(counts).forEach(([k, v]) => {
    console.log(`   ${k}: ${v}`);
  });
}

cleanupScammers();