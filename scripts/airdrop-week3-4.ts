#!/usr/bin/env npx tsx
/**
 * AGNTCBRO Week 3+4 Airdrop Distribution Script
 * 
 * Distributes 3,250,000 AGNTCBRO to 10 eligible wallets:
 * - 3 Diamond tier wallets: 500,000 each (250K × 2 weeks)
 * - 7 Gold tier wallets: 250,000 each (125K × 2 weeks)
 * 
 * Token: AGNTCBRO (Token-2022)
 * Contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump
 * Token Program: TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
 * 
 * Distribution wallet: J5jv4d6Y7o1T5YMNmbWzhULcXQasvw7BUGaRkoZTdd26
 */

import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import * as fs from 'fs';

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const TOKEN_MINT = new PublicKey('52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump');
const TOKEN_PROGRAM = TOKEN_2022_PROGRAM_ID;
const DECIMALS = 6;

// 10 qualifying wallets - weeks 3+4 combined
const RECIPIENTS = [
  // Diamond tier - 250,000/week × 2 weeks = 500,000 each
  { wallet: '6aSrey36pvkAKAVvsKL84X4CkDEY4bQCp5hFh8NVcN4j', amount: 500000, tier: 'Diamond', week3: 250000, week4: 250000 },
  { wallet: 'ZzBAYTFDehbwrgzzgN8ecYUyHwokDFxfgbA945ZqGf3', amount: 500000, tier: 'Diamond', week3: 250000, week4: 250000 },
  { wallet: 'B2YbTVUsC4MTdSCcn7SAFwBcYrZFPxbTBNosNcvGjMuB', amount: 500000, tier: 'Diamond', week3: 250000, week4: 250000 },
  // Gold tier - 125,000/week × 2 weeks = 250,000 each
  { wallet: 'CBReL95M1gS3SaeK7m38mpLKWmeAYk5KqyF9ND4Ta84y', amount: 250000, tier: 'Gold', week3: 125000, week4: 125000 },
  { wallet: '36J6TkbFc3QLEtT5V6H9hjXFKcRU5RKxqtbvtq55GEKc', amount: 250000, tier: 'Gold', week3: 125000, week4: 125000 },
  { wallet: 'EZwbHQ54PwcsL9iHsaEG1ruMEjVHed8iBmv1esA1rs8n', amount: 250000, tier: 'Gold', week3: 125000, week4: 125000 },
  { wallet: 'Cmw2B5LxVCrmw4zsdJoN4oRh9d5HErfn7mddepNmdky8', amount: 250000, tier: 'Gold', week3: 125000, week4: 125000 },
  { wallet: '63878UJuLZPNFTkU99xi4rPqBx4tnvQ5NMk677gwQGsi', amount: 250000, tier: 'Gold', week3: 125000, week4: 125000 },
  { wallet: '21BgRJNLCvpQximq33Q2XiXiTBkMGdshRJp5c5mz77os', amount: 250000, tier: 'Gold', week3: 125000, week4: 125000 },
  { wallet: 'DJwK6keJYc8EZdSTySCjXBFN2QbWN6Xaf8iKiGWSckbh', amount: 250000, tier: 'Gold', week3: 125000, week4: 125000 },
];

const TOTAL_DISTRIBUTION = RECIPIENTS.reduce((sum, r) => sum + r.amount, 0);

async function main() {
  console.log('='.repeat(60));
  console.log('AGNTCBRO Week 3+4 Airdrop Distribution');
  console.log('='.repeat(60));
  console.log(`Total wallets: ${RECIPIENTS.length}`);
  console.log(`Total distribution: ${TOTAL_DISTRIBUTION.toLocaleString()} AGNTCBRO`);
  console.log(`Week 3 total: ${RECIPIENTS.reduce((s, r) => s + r.week3, 0).toLocaleString()}`);
  console.log(`Week 4 total: ${RECIPIENTS.reduce((s, r) => s + r.week4, 0).toLocaleString()}`);
  console.log();

  // Load private key
  const privateKeyB58 = process.env.AIRDROP_WALLET_PRIVATE_KEY;
  if (!privateKeyB58) {
    console.error('ERROR: AIRDROP_WALLET_PRIVATE_KEY not found in environment');
    process.exit(1);
  }

  let secretKey: Uint8Array;
  try {
    secretKey = bs58.decode(privateKeyB58);
  } catch {
    secretKey = Buffer.from(privateKeyB58, 'base64');
  }

  if (secretKey.length !== 64) {
    console.error(`ERROR: Invalid key size: ${secretKey.length} bytes (expected 64)`);
    process.exit(1);
  }

  const seed = secretKey.slice(0, 32);
  const wallet = Keypair.fromSeed(seed);
  console.log(`Distribution wallet: ${wallet.publicKey.toBase58()}`);

  const connection = new Connection(RPC_URL, 'confirmed');
  console.log(`Connected to: ${RPC_URL}`);

  // Check SOL balance
  const solBalance = await connection.getBalance(wallet.publicKey);
  console.log(`SOL balance: ${solBalance / 1e9} SOL`);

  // Get source ATA
  const sourceAta = await getAssociatedTokenAddress(TOKEN_MINT, wallet.publicKey, false, TOKEN_PROGRAM);
  console.log(`Source ATA: ${sourceAta.toBase58()}`);

  // Check token balance
  const tokenBalance = await connection.getTokenAccountBalance(sourceAta);
  console.log(`Token balance: ${tokenBalance.value.uiAmount.toLocaleString()} AGNTCBRO`);
  console.log();

  if (Number(tokenBalance.value.uiAmount) < TOTAL_DISTRIBUTION) {
    console.error(`ERROR: Insufficient tokens. Have ${tokenBalance.value.uiAmount}, need ${TOTAL_DISTRIBUTION}`);
    process.exit(1);
  }

  // Process transfers in batches
  const BATCH_SIZE = 4; // Token-2022 transactions are larger, keep batches small
  const transactions: any[] = [];

  for (let i = 0; i < RECIPIENTS.length; i += BATCH_SIZE) {
    const batch = RECIPIENTS.slice(i, i + BATCH_SIZE);
    console.log(`\nPreparing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(RECIPIENTS.length / BATCH_SIZE)}...`);

    const instructions = [];

    for (const recipient of batch) {
      const destAta = await getAssociatedTokenAddress(
        TOKEN_MINT,
        new PublicKey(recipient.wallet),
        false,
        TOKEN_PROGRAM
      );

      // Check if dest ATA exists
      const destInfo = await connection.getAccountInfo(destAta);
      if (!destInfo) {
        console.log(`  WARNING: No ATA for ${recipient.wallet.slice(0, 8)}... — will include create instruction`);
        const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
        instructions.push(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            destAta,
            new PublicKey(recipient.wallet),
            TOKEN_MINT,
            TOKEN_PROGRAM
          )
        );
      }

      const rawAmount = BigInt(recipient.amount) * BigInt(10 ** DECIMALS);
      instructions.push(
        createTransferInstruction(
          sourceAta,
          destAta,
          wallet.publicKey,
          rawAmount,
          [],
          TOKEN_PROGRAM
        )
      );

      console.log(`  ${recipient.tier} ${recipient.wallet.slice(0, 8)}... → ${(recipient.amount).toLocaleString()} AGNTCBRO (W3: ${recipient.week3.toLocaleString()}, W4: ${recipient.week4.toLocaleString()})`);
    }

    // Build versioned transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(messageV0);
    tx.sign([wallet]);
    transactions.push({ tx, recipients: batch, lastValidBlockHeight });
  }

  // Confirm before sending
  console.log('\n' + '='.repeat(60));
  console.log('READY TO SEND');
  console.log('='.repeat(60));
  console.log(`Batches: ${transactions.length}`);
  console.log(`Total: ${TOTAL_DISTRIBUTION.toLocaleString()} AGNTCBRO to ${RECIPIENTS.length} wallets`);
  console.log();

  const results: any[] = [];

  for (let i = 0; i < transactions.length; i++) {
    const { tx, recipients, lastValidBlockHeight } = transactions[i];
    console.log(`Sending batch ${i + 1}/${transactions.length}...`);

    try {
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      console.log(`  TX sent: ${signature}`);
      console.log(`  Confirming...`);

      const confirmation = await connection.confirmTransaction(
        { signature, blockhash: tx.message.recentBlockhash, lastValidBlockHeight },
        'confirmed'
      );

      if (confirmation.value.err) {
        console.error(`  FAILED: ${JSON.stringify(confirmation.value.err)}`);
        for (const r of recipients) {
          results.push({ wallet: r.wallet, tier: r.tier, amount: r.amount, signature, status: 'failed', error: JSON.stringify(confirmation.value.err) });
        }
      } else {
        console.log(`  ✅ Confirmed: ${signature}`);
        for (const r of recipients) {
          results.push({ wallet: r.wallet, tier: r.tier, amount: r.amount, week3: r.week3, week4: r.week4, signature, status: 'confirmed' });
        }
      }
    } catch (err: any) {
      console.error(`  ERROR: ${err.message}`);
      for (const r of recipients) {
        results.push({ wallet: r.wallet, tier: r.tier, amount: r.amount, status: 'error', error: err.message });
      }
    }

    // Brief pause between batches
    if (i < transactions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Save results
  const csvPath = '/Users/efinney/.openclaw/workspace/airdrop-week3-4-transactions.csv';
  const csvHeader = 'wallet,tier,amount,week3,week4,signature,status';
  const csvRows = results.map(r =>
    `${r.wallet},${r.tier},${r.amount},${r.week3 || ''},${r.week4 || ''},${r.signature || ''},${r.status}`
  );
  fs.writeFileSync(csvPath, [csvHeader, ...csvRows].join('\n'));
  console.log(`\nResults saved to: ${csvPath}`);

  // Summary
  const confirmed = results.filter(r => r.status === 'confirmed');
  const failed = results.filter(r => r.status !== 'confirmed');
  console.log(`\n${'='.repeat(60)}`);
  console.log('DISTRIBUTION SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Confirmed: ${confirmed.length}/${RECIPIENTS.length} wallets`);
  console.log(`❌ Failed: ${failed.length}/${RECIPIENTS.length} wallets`);
  if (confirmed.length > 0) {
    console.log(`Total distributed: ${confirmed.reduce((s, r) => s + r.amount, 0).toLocaleString()} AGNTCBRO`);
  }
  if (failed.length > 0) {
    console.log('\nFailed wallets:');
    for (const f of failed) {
      console.log(`  ${f.wallet.slice(0, 8)}... (${f.tier}): ${f.error || f.status}`);
    }
  }
}

main().catch(console.error);