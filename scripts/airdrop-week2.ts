#!/usr/bin/env npx tsx
/**
 * AGNTCBRO Week 2 Airdrop Distribution Script
 * 
 * Distributes 3,250,000 AGNTCBRO to 19 eligible wallets:
 * - 7 Diamond tier wallets: 250,000 each
 * - 12 Gold tier wallets: 125,000 each
 * 
 * Token: AGNTCBRO (Token-2022)
 * Contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump
 * Token Program: TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
 */

import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const TOKEN_MINT = new PublicKey('52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump');
const TOKEN_PROGRAM = TOKEN_2022_PROGRAM_ID; // Token-2022 program

// Week 2 recipients
const RECIPIENTS = [
  // Diamond tier - 250,000 each
  { wallet: '6aSrey36pvkAKAVvsKL84X4CkDEY4bQCp5hFh8NVcN4j', amount: 250000 },
  { wallet: 'ZzBAYTFDehbwrgzzgN8ecYUyHwokDFxfgbA945ZqGf3', amount: 250000 },
  { wallet: 'B2YbTVUsC4MTdSCcn7SAFwBcYrZFPxbTBNosNcvGjMuB', amount: 250000 },
  { wallet: 'Em65he1pkAB3eGiMhd76qUujefmJ2KVwwXqxdT2YzMmE', amount: 250000 },
  { wallet: '3NJWD1M1uG9mwWLkGWFQ3LqqDCh1pJSDGfQXmb3fdADH', amount: 250000 },
  { wallet: '5S5VVx5shTBEZfqxBiePif4Y5mmFo1FMxZgLiuHfphz3', amount: 250000 },
  { wallet: 'UpFr5jN23yd6D2neDSqnG3QnkSmpWN6xXpJq7cpWsxf', amount: 250000 },
  // Gold tier - 125,000 each
  { wallet: '9SFtm4S5QNDdMuWwgpy8E7ZhqRfgmjNtE1JLqkzPKj9F', amount: 125000 },
  { wallet: 'J4wsP4HZHDL5SPa7kZBQGcyksrCdHoYgVFigiW1qFGuC', amount: 125000 },
  { wallet: 'CBReL95M1gS3SaeK7m38mpLKWmeAYk5KqyF9ND4Ta84y', amount: 125000 },
  { wallet: '9i94aZP57tD8Lz5RxZqXoHPZKvv1i2dX6LQzK5z8EyzH', amount: 125000 },
  { wallet: '7erEFC8AoEQW1WL5pfF15ArRRQ4uycTTA6hyncjxVLJD', amount: 125000 },
  { wallet: '36J6TkbFc3QLEtT5V6H9hjXFKcRU5RKxqtbvtq55GEKc', amount: 125000 },
  { wallet: 'EZwbHQ54PwcsL9iHsaEG1ruMEjVHed8iBmv1esA1rs8n', amount: 125000 },
  { wallet: 'Cmw2B5LxVCrmw4zsdJoN4oRh9d5HErfn7mddepNmdky8', amount: 125000 },
  { wallet: 'A4R3nauxCbbddvm54UP6GD64SoY8BVftDJLd1hMA4yNB', amount: 125000 },
  { wallet: '63878UJuLZPNFTkU99xi4rPqBx4tnvQ5NMk677gwQGsi', amount: 125000 },
  { wallet: '21BgRJNLCvpQximq33Q2XiXiTBkMGdshRJp5c5mz77os', amount: 125000 },
  { wallet: 'DJwK6keJYc8EZdSTySCjXBFN2QbWN6Xaf8iKiGWSckbh', amount: 125000 },
];

async function main() {
  // Load private key from environment
  const privateKeyB64 = process.env.AIRDROP_WALLET_PRIVATE_KEY;
  if (!privateKeyB64) {
    console.error('ERROR: AIRDROP_WALLET_PRIVATE_KEY not found in environment');
    process.exit(1);
  }

  // Decode keypair - Solana CLI uses base58-encoded 64-byte array
  // The first 32 bytes are the seed, last 32 bytes are the public key
  // We need to use Keypair.fromSeed() with just the first 32 bytes
  let secretKey: Uint8Array;
  try {
    secretKey = bs58.decode(privateKeyB64);
  } catch {
    secretKey = Buffer.from(privateKeyB64, 'base64');
  }
  
  // Validate key size and extract seed
  if (secretKey.length !== 64) {
    console.error(`ERROR: Invalid key size: ${secretKey.length} bytes (expected 64)`);
    process.exit(1);
  }
  
  // Extract seed (first 32 bytes) and create keypair
  const seed = secretKey.slice(0, 32);
  const wallet = Keypair.fromSeed(seed);
  console.log(`Distribution wallet: ${wallet.publicKey.toBase58()}`);

  // Connect to Solana
  const connection = new Connection(RPC_URL, 'confirmed');
  console.log(`Connected to: ${RPC_URL}`);

  // Get sender's token account
  const senderAta = await getAssociatedTokenAddress(TOKEN_MINT, wallet.publicKey, true, TOKEN_PROGRAM);
  console.log(`Sender ATA: ${senderAta.toBase58()}`);

  // Check sender balance
  const balance = await connection.getTokenAccountBalance(senderAta);
  console.log(`Sender balance: ${balance.value.amount} AGNTCBRO (${balance.value.uiAmount} tokens)`);

  // Verify sufficient balance
  const totalToDistribute = RECIPIENTS.reduce((sum, r) => sum + r.amount, 0);
  console.log(`Total to distribute: ${totalToDistribute.toLocaleString()} AGNTCBRO`);

  const currentBalance = Number(balance.value.amount);
  if (currentBalance < totalToDistribute) {
    console.error(`ERROR: Insufficient balance. Have ${currentBalance}, need ${totalToDistribute}`);
    process.exit(1);
  }

  // Process each recipient
  const results: { wallet: string; amount: number; signature?: string; error?: string }[] = [];

  for (const recipient of RECIPIENTS) {
    try {
      console.log(`\nProcessing: ${recipient.wallet} (${recipient.amount.toLocaleString()} AGNTCBRO)`);

      // Get or create recipient ATA
      const recipientPubkey = new PublicKey(recipient.wallet);
      const recipientAta = await getAssociatedTokenAddress(TOKEN_MINT, recipientPubkey, true, TOKEN_PROGRAM);

      // Create transfer instruction
      const transferIx = createTransferInstruction(
        senderAta,
        recipientAta,
        wallet.publicKey,
        BigInt(recipient.amount),
        [],
        TOKEN_PROGRAM
      );

      // Build transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const message = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions: [transferIx],
      }).compileToV0Message();

      const tx = new VersionedTransaction(message);
      tx.sign([wallet]);

      // Send transaction
      const signature = await connection.sendTransaction(tx, { skipPreflight: false });
      console.log(`Sent: ${signature}`);

      // Confirm
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
      console.log(`✅ Confirmed: ${signature}`);

      results.push({ wallet: recipient.wallet, amount: recipient.amount, signature });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Failed: ${errorMsg}`);
      results.push({ wallet: recipient.wallet, amount: recipient.amount, error: errorMsg });
    }
  }

  // Summary
  console.log('\n========== DISTRIBUTION SUMMARY ==========\n');
  const successful = results.filter(r => r.signature);
  const failed = results.filter(r => r.error);

  console.log(`Total recipients: ${RECIPIENTS.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Total distributed: ${successful.reduce((sum, r) => sum + r.amount, 0).toLocaleString()} AGNTCBRO`);

  if (failed.length > 0) {
    console.log('\nFailed transfers:');
    failed.forEach(f => console.log(`  - ${f.wallet}: ${f.error}`));
  }

  console.log('\nSuccessful transfers:');
  successful.forEach(s => console.log(`  ✅ ${s.wallet}: ${s.amount.toLocaleString()} AGNTCBRO`));
}

main().catch(console.error);