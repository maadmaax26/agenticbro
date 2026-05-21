#!/usr/bin/env npx tsx
/**
 * AGNTCBRO Week 2 Correction Script
 * 
 * Fix: Week 2 was distributed to wrong wallets/amounts
 * Need to send matching amounts to the same 21 wallets from Week 1
 * 
 * Week 1 Distribution (correct):
 * - Diamond (3): 250,000 each = 750,000
 * - Gold (7): 125,000 each = 875,000
 * - Silver (11): 62,500 each = 687,500
 * - Total: 2,312,500 to 21 wallets
 */

import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const TOKEN_MINT = new PublicKey('52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump');
const TOKEN_PROGRAM = TOKEN_2022_PROGRAM_ID;

// Week 1 CORRECT distribution (21 wallets)
const WEEK1_RECIPIENTS = [
  // Diamond tier (3 wallets) - 250,000 each
  { wallet: '6aSrey36pvkAKAVvsKL84X4CkDEY4bQCp5hFh8NVcN4j', tier: 'Diamond', amount: 250000 },
  { wallet: 'ZzBAYTFDehbwrgzzgN8ecYUyHwokDFxfgbA945ZqGf3', tier: 'Diamond', amount: 250000 },
  { wallet: 'B2YbTVUsC4MTdSCcn7SAFwBcYrZFPxbTBNosNcvGjMuB', tier: 'Diamond', amount: 250000 },
  // Gold tier (7 wallets) - 125,000 each
  { wallet: 'CBReL95M1gS3SaeK7m38mpLKWmeAYk5KqyF9ND4Ta84y', tier: 'Gold', amount: 125000 },
  { wallet: '36J6TkbFc3QLEtT5V6H9hjXFKcRU5RKxqtbvtq55GEKc', tier: 'Gold', amount: 125000 },
  { wallet: 'EZwbHQ54PwcsL9iHsaEG1ruMEjVHed8iBmv1esA1rs8n', tier: 'Gold', amount: 125000 },
  { wallet: 'Cmw2B5LxVCrmw4zsdJoN4oRh9d5HErfn7mddepNmdky8', tier: 'Gold', amount: 125000 },
  { wallet: '63878UJuLZPNFTkU99xi4rPqBx4tnvQ5NMk677gwQGsi', tier: 'Gold', amount: 125000 },
  { wallet: '21BgRJNLCvpQximq33Q2XiXiTBkMGdshRJp5c5mz77os', tier: 'Gold', amount: 125000 },
  { wallet: 'DJwK6keJYc8EZdSTySCjXBFN2QbWN6Xaf8iKiGWSckbh', tier: 'Gold', amount: 125000 },
  // Silver tier (11 wallets) - 62,500 each
  { wallet: '2XipXuKRtwgiV9ZYRg9t485Xw4jH9pTZ6pWJdqYWR6xB', tier: 'Silver', amount: 62500 },
  { wallet: '4vpq2KYHw9L1xZQSZddUWFYTrssYaup1ZAUH7JDjyhDa', tier: 'Silver', amount: 62500 },
  { wallet: 'GUc6q8eyBbppMa7qdNzCUDeVVqzEcqr33QvuZ63QfMQJ', tier: 'Silver', amount: 62500 },
  { wallet: '5q7xgZuVPz7Jfip1L6sGgiSzTwxDpLQPzijzMmHeFRU4', tier: 'Silver', amount: 62500 },
  { wallet: 'H3XibQLNUhxzCfCSuXLDk91C4syvvVxu1BM4VpjzbT25', tier: 'Silver', amount: 62500 },
  { wallet: '7v24h67inspXXHkwUf96937WK3oJfXAFtDDsk7DEsbK4', tier: 'Silver', amount: 62500 },
  { wallet: 'BzK9pyjGhvSDcqWHRBt5P52Eh3sEWkrAhKT24gYRUp2C', tier: 'Silver', amount: 62500 },
  { wallet: 'HcHud5ttvTkT4H3RSHQ2D8GCDd6ar5zB94mPz8pekMba', tier: 'Silver', amount: 62500 },
  { wallet: 'GtYdoFGojHz54RXaWw3LQkjF89tdjjETfHv8kW4LRPaH', tier: 'Silver', amount: 62500 },
  { wallet: 'ARzPMLivPH9GsRnwZWymXcPJX9Br1oEH5od3WzoKmX5Y', tier: 'Silver', amount: 62500 },
  { wallet: 'BZbk5WEKLcbc7SUaS76jCUmhJiLvkNXbYcWrcJ3K1x4W', tier: 'Silver', amount: 62500 },
];

// What was sent in Week 2 (incorrectly)
const WEEK2_SENT = [
  // Diamond (7 wallets) - 250,000 each - BUT ONLY 3 SHOULD BE DIAMOND
  { wallet: '6aSrey36pvkAKAVvsKL84X4CkDEY4bQCp5hFh8NVcN4j', sent: 250000 },
  { wallet: 'ZzBAYTFDehbwrgzzgN8ecYUyHwokDFxfgbA945ZqGf3', sent: 250000 },
  { wallet: 'B2YbTVUsC4MTdSCcn7SAFwBcYrZFPxbTBNosNcvGjMuB', sent: 250000 },
  { wallet: 'Em65he1pkAB3eGiMhd76qUujefmJ2KVwwXqxdT2YzMmE', sent: 250000 }, // NOT in Week 1
  { wallet: '3NJWD1M1uG9mwWLkGWFQ3LqqDCh1pJSDGfQXmb3fdADH', sent: 250000 }, // NOT in Week 1
  { wallet: '5S5VVx5shTBEZfqxBiePif4Y5mmFo1FMxZgLiuHfphz3', sent: 250000 }, // NOT in Week 1
  { wallet: 'UpFr5jN23yd6D2neDSqnG3QnkSmpWN6xXpJq7cpWsxf', sent: 250000 }, // NOT in Week 1
  // Gold (12 wallets) - 125,000 each - BUT ONLY 7 SHOULD BE GOLD
  { wallet: '9SFtm4S5QNDdMuWwgpy8E7ZhqRfgmjNtE1JLqkzPKj9F', sent: 125000 }, // NOT in Week 1
  { wallet: 'J4wsP4HZHDL5SPa7kZBQGcyksrCdHoYgVFigiW1qFGuC', sent: 125000 }, // NOT in Week 1
  { wallet: 'CBReL95M1gS3SaeK7m38mpLKWmeAYk5KqyF9ND4Ta84y', sent: 125000 },
  { wallet: '9i94aZP57tD8Lz5RxZqXoHPZKvv1i2dX6LQzK5z8EyzH', sent: 125000 }, // NOT in Week 1
  { wallet: '7erEFC8AoEQW1WL5pfF15ArRRQ4uycTTA6hyncjxVLJD', sent: 125000 }, // NOT in Week 1
  { wallet: '36J6TkbFc3QLEtT5V6H9hjXFKcRU5RKxqtbvtq55GEKc', sent: 125000 },
  { wallet: 'EZwbHQ54PwcsL9iHsaEG1ruMEjVHed8iBmv1esA1rs8n', sent: 125000 },
  { wallet: 'Cmw2B5LxVCrmw4zsdJoN4oRh9d5HErfn7mddepNmdky8', sent: 125000 },
  { wallet: 'A4R3nauxCbbddvm54UP6GD64SoY8BVftDJLd1hMA4yNB', sent: 125000 }, // NOT in Week 1
  { wallet: '63878UJuLZPNFTkU99xi4rPqBx4tnvQ5NMk677gwQGsi', sent: 125000 },
  { wallet: '21BgRJNLCvpQximq33Q2XiXiTBkMGdshRJp5c5mz77os', sent: 125000 },
  { wallet: 'DJwK6keJYc8EZdSTySCjXBFN2QbWN6Xaf8iKiGWSckbh', sent: 125000 },
];

// Calculate what still needs to be sent
const sentMap = new Map(WEEK2_SENT.map(s => [s.wallet, s.sent]));

console.log('=== WEEK 2 CORRECTION ANALYSIS ===\n');
console.log('Week 1 correct recipients (21 wallets):');
console.log('- Diamond (3): 250,000 each = 750,000');
console.log('- Gold (7): 125,000 each = 875,000');
console.log('- Silver (11): 62,500 each = 687,500');
console.log('TOTAL: 2,312,500\n');

console.log('Week 2 incorrect distribution (19 wallets):');
console.log('- Diamond (7): 250,000 each = 1,750,000');
console.log('- Gold (12): 125,000 each = 1,500,000');
console.log('TOTAL: 3,250,000\n');

const NEED_TO_SEND: { wallet: string; tier: string; amount: number; reason: string }[] = [];

// Check each Week 1 recipient
for (const recipient of WEEK1_RECIPIENTS) {
  const alreadySent = sentMap.get(recipient.wallet) || 0;
  const remaining = recipient.amount - alreadySent;
  
  if (remaining > 0) {
    NEED_TO_SEND.push({
      wallet: recipient.wallet,
      tier: recipient.tier,
      amount: remaining,
      reason: remaining === recipient.amount ? 'NOT SENT' : `PARTIAL (sent ${alreadySent})`
    });
  }
}

// Check for wallets that received in Week 2 but weren't in Week 1
const week1Wallets = new Set(WEEK1_RECIPIENTS.map(r => r.wallet));
for (const sent of WEEK2_SENT) {
  if (!week1Wallets.has(sent.wallet)) {
    console.log(`WARNING: ${sent.wallet} received ${sent.sent} in Week 2 but was NOT in Week 1`);
  }
}

console.log('=== CORRECTIONS NEEDED ===\n');
if (NEED_TO_SEND.length === 0) {
  console.log('All Week 1 recipients have received correct amounts!');
} else {
  console.log('Wallets needing correction:\n');
  NEED_TO_SEND.forEach(r => {
    console.log(`${r.tier} ${r.wallet}: ${r.amount.toLocaleString()} AGNTCBRO (${r.reason})`);
  });
  console.log(`\nTotal to distribute: ${NEED_TO_SEND.reduce((sum, r) => sum + r.amount, 0).toLocaleString()} AGNTCBRO`);
}

// Delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  if (NEED_TO_SEND.length === 0) {
    console.log('\nNo corrections needed. Exiting.');
    return;
  }

  const privateKeyB64 = process.env.AIRDROP_WALLET_PRIVATE_KEY;
  if (!privateKeyB64) {
    console.error('ERROR: AIRDROP_WALLET_PRIVATE_KEY not found in environment');
    process.exit(1);
  }

  const secretKey = bs58.decode(privateKeyB64);
  const seed = secretKey.slice(0, 32);
  const wallet = Keypair.fromSeed(seed);
  console.log(`\nDistribution wallet: ${wallet.publicKey.toBase58()}`);

  const connection = new Connection(RPC_URL, 'confirmed');
  console.log(`Connected to: ${RPC_URL}`);

  const senderAta = await getAssociatedTokenAddress(TOKEN_MINT, wallet.publicKey, true, TOKEN_PROGRAM);
  const balance = await connection.getTokenAccountBalance(senderAta);
  console.log(`Sender balance: ${balance.value.amount} AGNTCBRO (${balance.value.uiAmount} tokens)`);

  const totalNeeded = NEED_TO_SEND.reduce((sum, r) => sum + r.amount, 0);
  console.log(`\nPreparing to distribute ${totalNeeded.toLocaleString()} AGNTCBRO to ${NEED_TO_SEND.length} wallets...\n`);

  const results: { wallet: string; amount: number; signature?: string; error?: string }[] = [];

  for (const recipient of NEED_TO_SEND) {
    try {
      console.log(`[${recipient.tier}] ${recipient.wallet}: ${recipient.amount.toLocaleString()} AGNTCBRO (${recipient.reason})`);

      const recipientPubkey = new PublicKey(recipient.wallet);
      const recipientAta = await getAssociatedTokenAddress(TOKEN_MINT, recipientPubkey, true, TOKEN_PROGRAM);

      const transferIx = createTransferInstruction(
        senderAta,
        recipientAta,
        wallet.publicKey,
        BigInt(recipient.amount),
        [],
        TOKEN_PROGRAM
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const message = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions: [transferIx],
      }).compileToV0Message();

      const tx = new VersionedTransaction(message);
      tx.sign([wallet]);

      const signature = await connection.sendTransaction(tx, { skipPreflight: false });
      console.log(`  Sent: ${signature}`);

      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
      console.log(`  ✅ Confirmed\n`);

      results.push({ wallet: recipient.wallet, amount: recipient.amount, signature });

      // Wait 3 seconds between transactions
      await delay(3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Failed: ${errorMsg}\n`);
      results.push({ wallet: recipient.wallet, amount: recipient.amount, error: errorMsg });
      await delay(5000);
    }
  }

  // Summary
  console.log('\n========== CORRECTION SUMMARY ==========\n');
  const successful = results.filter(r => r.signature);
  const failed = results.filter(r => r.error);

  console.log(`Total corrections: ${NEED_TO_SEND.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Total distributed: ${successful.reduce((sum, r) => sum + r.amount, 0).toLocaleString()} AGNTCBRO`);

  if (failed.length > 0) {
    console.log('\nFailed:');
    failed.forEach(f => console.log(`  ❌ ${f.wallet}: ${f.error}`));
  }

  console.log('\nSuccessful:');
  successful.forEach(s => console.log(`  ✅ ${s.wallet}: ${s.amount.toLocaleString()} AGNTCBRO`));
}

main().catch(console.error);