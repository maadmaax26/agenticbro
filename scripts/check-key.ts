#!/usr/bin/env npx tsx
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';

const key = process.env.AIRDROP_WALLET_PRIVATE_KEY;
if (!key) {
  console.error('AIRDROP_WALLET_PRIVATE_KEY not set');
  process.exit(1);
}

console.log('Key length:', key.length, 'chars');
const decoded = bs58.decode(key);
console.log('Decoded length:', decoded.length, 'bytes');
console.log('First 32 bytes (should be seed/private key):', Array.from(decoded.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(''));
console.log('Last 32 bytes (should be public key):', Array.from(decoded.slice(32)).map(b => b.toString(16).padStart(2, '0')).join(''));

// Try using just the first 32 bytes as a seed
if (decoded.length >= 32) {
  try {
    console.log('\nTrying to create keypair from first 32 bytes (seed)...');
    const seed = decoded.slice(0, 32);
    const kp2 = Keypair.fromSeed(Uint8Array.from(seed));
    console.log('Public key from seed:', kp2.publicKey.toBase58());
  } catch (e) {
    console.log('Seed method failed:', e);
  }
}

// Try Ed25519 directly
try {
  console.log('\nTrying Ed25519 keypair directly...');
  const kp = Keypair.fromSecretKey(decoded);
  console.log('Public key:', kp.publicKey.toBase58());
} catch (e) {
  console.log('Keypair.fromSecretKey failed:', e);
}