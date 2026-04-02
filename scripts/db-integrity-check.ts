/**
 * Database Integrity Check
 * 
 * Ensures no overlap between legitimate_accounts and known_scammers tables.
 * Removes accounts from legitimate_accounts if they appear in known_scammers.
 * 
 * Run: npx ts-node scripts/db-integrity-check.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

interface LegitimateAccount {
  id: string;
  account_name: string;
  platform: string;
  x_handle: string | null;
  telegram_channel: string | null;
}

interface KnownScammer {
  id: string;
  display_name: string | null;
  x_handle: string | null;
  telegram_channel: string | null;
}

async function checkDatabaseIntegrity() {
  console.log('=== Database Integrity Check ===\n');
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('ERROR: Missing Supabase credentials');
    process.exit(1);
  }

  try {
    // Fetch all legitimate accounts
    console.log('Fetching legitimate accounts...');
    const legitResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/legitimate_accounts?select=id,account_name,platform,x_handle,telegram_channel`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    
    if (!legitResponse.ok) {
      throw new Error(`Failed to fetch legitimate accounts: ${legitResponse.statusText}`);
    }
    
    const legitimateAccounts: LegitimateAccount[] = await legitResponse.json();
    console.log(`Found ${legitimateAccounts.length} legitimate accounts\n`);

    // Fetch all known scammers
    console.log('Fetching known scammers...');
    const scammerResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/known_scammers?select=id,display_name,x_handle,telegram_channel`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    
    if (!scammerResponse.ok) {
      throw new Error(`Failed to fetch known scammers: ${scammerResponse.statusText}`);
    }
    
    const knownScammers: KnownScammer[] = await scammerResponse.json();
    console.log(`Found ${knownScammers.length} known scammers\n`);

    // Build lookup sets
    const scammerXHandles = new Set<string>();
    const scammerTelegramChannels = new Set<string>();
    
    for (const scammer of knownScammers) {
      if (scammer.x_handle) {
        scammerXHandles.add(scammer.x_handle.toLowerCase().replace(/^@/, ''));
      }
      if (scammer.telegram_channel) {
        scammerTelegramChannels.add(scammer.telegram_channel.toLowerCase().replace(/^@/, '').replace(/^t\.me\//, ''));
      }
    }

    // Check for overlaps
    const overlaps: { id: string; account_name: string; match_type: string; match_value: string }[] = [];
    
    for (const account of legitimateAccounts) {
      // Check X handle
      if (account.x_handle) {
        const handle = account.x_handle.toLowerCase().replace(/^@/, '');
        if (scammerXHandles.has(handle)) {
          overlaps.push({
            id: account.id,
            account_name: account.account_name,
            match_type: 'x_handle',
            match_value: account.x_handle,
          });
        }
      }
      
      // Check Telegram channel
      if (account.telegram_channel) {
        const channel = account.telegram_channel.toLowerCase().replace(/^@/, '').replace(/^t\.me\//, '');
        if (scammerTelegramChannels.has(channel)) {
          overlaps.push({
            id: account.id,
            account_name: account.account_name,
            match_type: 'telegram_channel',
            match_value: account.telegram_channel,
          });
        }
      }
    }

    if (overlaps.length === 0) {
      console.log('✅ No overlaps found. Database integrity verified.\n');
      return;
    }

    console.log(`⚠️  Found ${overlaps.length} overlapping account(s):\n`);
    for (const overlap of overlaps) {
      console.log(`  - ${overlap.account_name} (${overlap.match_type}: ${overlap.match_value})`);
    }
    console.log('');

    // Remove overlapping accounts from legitimate_accounts
    console.log('Removing overlapping accounts from legitimate_accounts...\n');
    
    for (const overlap of overlaps) {
      console.log(`Removing: ${overlap.account_name}`);
      
      const deleteResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/legitimate_accounts?id=eq.${overlap.id}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=representation',
          },
        }
      );
      
      if (!deleteResponse.ok) {
        console.error(`  ❌ Failed to remove ${overlap.account_name}: ${deleteResponse.statusText}`);
      } else {
        console.log(`  ✓ Removed ${overlap.account_name} from legitimate_accounts`);
      }
    }

    console.log('\n✅ Database integrity check complete.\n');
    
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

// Run the check
checkDatabaseIntegrity();