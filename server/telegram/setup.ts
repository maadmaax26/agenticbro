/**
 * server/telegram/setup.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ONE-TIME SETUP SCRIPT — run this once to authenticate and get your
 * TELEGRAM_SESSION_STRING.
 *
 * Usage:
 *   TELEGRAM_API_ID=<id> TELEGRAM_API_HASH=<hash> npx tsx server/telegram/setup.ts
 *
 * It will prompt for your phone number + Telegram OTP, then print the
 * session string. Copy it into your .env as TELEGRAM_SESSION_STRING.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'
import * as readline from 'readline'

const API_ID   = parseInt(process.env.TELEGRAM_API_ID ?? '', 10)
const API_HASH = process.env.TELEGRAM_API_HASH ?? ''

if (!API_ID || !API_HASH) {
  console.error('Error: Set TELEGRAM_API_ID and TELEGRAM_API_HASH env vars before running setup.')
  process.exit(1)
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function main() {
  console.log('\n🔑 AgenticBro — Telegram MTProto Setup\n')

  const session = new StringSession('')
  const client  = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 3,
  })

  await client.start({
    phoneNumber:    async () => prompt('Enter your phone number (with country code, e.g. +14155551234): '),
    password:       async () => prompt('Enter your 2FA password (press Enter if none): '),
    phoneCode:      async () => prompt('Enter the OTP Telegram sent you: '),
    onError:        (err) => console.error('[setup] error:', err),
  })

  const sessionString = client.session.save() as unknown as string

  console.log('\n✅ Authentication successful!\n')
  console.log('Add this to your .env file:\n')
  console.log(`TELEGRAM_SESSION_STRING=${sessionString}`)
  console.log('\nKeep this string secret — it grants full access to your Telegram account.\n')

  await client.disconnect()
  process.exit(0)
}

main().catch(err => {
  console.error('[setup] Fatal:', err)
  process.exit(1)
})
