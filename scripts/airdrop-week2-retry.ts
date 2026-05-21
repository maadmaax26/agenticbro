#!/usr/bin/env npx tsx
/**
 * AGNTCBRO Week 2 Airdrop Retry Script
 * Retry failed transfers with delays to avoid rate limiting
 */

import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const TOKEN_MINT = new PublicKey('52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump');
const TOKEN_PROGRAM = TOKEN_2022_PROGRAM_ID;

// Failed recipients from first run (need retry)
const FAILED_RECIPIENTS = [
  { wallet: '5S5VVx5shTBEZfqxBiePif4Y5mmFo1FMxZgLiuHfphz3', amount: 250000 },
  { wallet: 'UpFr5jN23yd6D2neDSqnG3QnkSmpWN6xXpJq7cpWsxf', amount: 250000 },
  { wallet: '63878UJuLZPNFTkU99xi4rPqBx4tnvQ5NMk677gwQGsi', amount: 125000 },
  { wallet: '21BgRJNLCvpQximq33Q2XiXiTBkMGdshRJp5c5mz77os', amount: 125000 },
];

// Delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const privateKeyB64 = process.env.AIRDROP_WALLET_PRIVATE_KEY;
  if (!privateKeyB64) {
    console.error('ERROR: AIRDROP_WALLET_PRIVATE_KEY not found in environment');
    process.exit(1);
  }

  const secretKey = bs58.decode(privateKeyB64);
  const seed = secretKey.slice(0, 32);
  const wallet = Keypair.fromSeed(seed);
  console.log(`Distribution wallet: ${wallet.publicKey.toBase58()}`);

  const connection = new Connection(RPC_URL, 'confirmed');
  console.log(`Connected to: ${RPC_URL}`);

  const senderAta = await getAssociatedTokenAddress(TOKEN_MINT, wallet.publicKey, true, TOKEN_PROGRAM);
  console.log(`Sender ATA: ${senderAta.toBase58()}`);

  const balance = await connection.getTokenAccountBalance(senderAta);
  console.log(`Sender balance: ${balance.value.amount} AGNTCBRO (${balance.value.uiAmount} tokens)`);

  const totalToDistribute = FAILED_RECIPIENTS.reduce((sum, r) => sum + r.amount, 0);
  console.log(`\nRetrying ${FAILED_RECIPIENTS.length} failed transfers totaling ${totalToDistribute.toLocaleString()} AGNTCBRO\n`);

  const results: { wallet: string; amount: number; signature?: string; error?: string }[] = [];

  for (const recipient of FAILED_RECIPIENTS) {
    try {
      console.log(`Processing: ${recipient.wallet} (${recipient.amount.toLocaleString()} AGNTCBRO)`);

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
      console.log(`Sent: ${signature}`);

      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
      console.log(`✅ Confirmed: ${signature}\n`);

      results.push({ wallet: recipient.wallet, amount: recipient.amount, signature });

      // Wait 3 seconds between transactions to avoid rate limiting
      await delay(3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Failed: ${errorMsg}\n`);
      results.push({ wallet: recipient.wallet, amount: recipient.amount, error: errorMsg });
      await delay(5000); // Longer delay after failure
    }
  }

  // Summary
  console.log('\n========== RETRY SUMMARY ==========\n');
  const successful = results.filter(r => r.signature);
  const failed = results.filter(r => r.error);

  console.log(`Retried: ${FAILED_RECIPIENTS.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Still failed: ${failed.length}`);
  console.log(`Distributed this retry: ${successful.reduce((sum, r) => sum + r.amount, 0).toLocaleString()} AGNTCBRO`);

  if (failed.length > 0) {
    console.log('\nStill failed:');
    failed.forEach(f => console.log(`  - ${f.wallet}: ${f.error}`));
  }

  console.log('\nSuccessful retries:');
  successful.forEach(s => console.log(`  ✅ ${s.wallet}: ${s.amount.toLocaleString()} AGNTCBRO`));
}

main().catch(console.error);