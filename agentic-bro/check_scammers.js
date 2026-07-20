const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://drvasofyghnxfxvkkwad.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.log('ERROR: SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const { data: scammers, error } = await supabase
    .from('known_scammers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
  
  if (error) {
    console.log('Error:', error);
    return;
  }
  
  console.log('=== SCAMMERS IN DATABASE ===');
  console.log('Total:', scammers?.length || 0);
  
  // Check for AGNTCBRO entries
  const agntcbroEntries = scammers?.filter(s => 
    (s.username || '').toLowerCase().includes('agntcbro') ||
    (s.display_name || '').toLowerCase().includes('agntcbro') ||
    (s.x_handle || '').toLowerCase().includes('agntcbro')
  );
  
  console.log('\n=== AGNTCBRO ENTRIES ===');
  console.log(JSON.stringify(agntcbroEntries, null, 2));
  
  // Check for legitimate accounts in wrong section
  const legitInScammers = scammers?.filter(s => 
    s.verification_level === 'LEGITIMATE' ||
    s.verification_level === 'VERIFIED' ||
    s.verification_level === 'PAID PROMOTER'
  );
  
  console.log('\n=== LEGITIMATE IN SCAMMERS ===');
  console.log(JSON.stringify(legitInScammers, null, 2));
  
  // Check risk score consistency
  console.log('\n=== RISK SCORE CHECK ===');
  scammers?.slice(0, 10).forEach(s => {
    console.log(`\n${s.scammer_name || s.username}:`);
    console.log(`  Risk Score: ${s.risk_score}`);
    console.log(`  Risk Level: ${s.risk_level}`);
    console.log(`  Verification: ${s.verification_level}`);
    const notesMatch = (s.notes || '').match(/Risk Score:\s*([\d.]+)\s*\/10/i);
    if (notesMatch) {
      console.log(`  Notes Risk Score: ${notesMatch[1]}`);
      if (parseFloat(notesMatch[1]) !== s.risk_score) {
        console.log(`  ⚠️ DISCREPANCY: Notes says ${notesMatch[1]}, database says ${s.risk_score}`);
      }
    }
  });
}

checkData();