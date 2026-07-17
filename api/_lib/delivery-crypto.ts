import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function encryptionKey(): Buffer {
  const secret = process.env.DELIVERY_ENCRYPTION_KEY || '';
  if (secret.length < 32) throw new Error('DELIVERY_ENCRYPTION_KEY must be at least 32 characters');
  return createHash('sha256').update(secret).digest();
}

export function encryptDeliverySecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptDeliverySecret(value: string): string {
  const [ivText, tagText, ciphertextText] = value.split('.');
  if (!ivText || !tagText || !ciphertextText) throw new Error('Invalid encrypted delivery secret');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
}

export function validateDeliveryUrl(raw: string, channel: 'slack' | 'webhook'): URL {
  const parsed = new URL(raw);
  if (parsed.protocol !== 'https:') throw new Error('Delivery URL must use HTTPS');
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '::1' || /^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new Error('Private and local delivery destinations are not allowed');
  }
  if (channel === 'slack' && (host !== 'hooks.slack.com' || !parsed.pathname.startsWith('/services/'))) {
    throw new Error('Slack endpoints must be an incoming webhook URL from hooks.slack.com');
  }
  return parsed;
}
