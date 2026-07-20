import { Telegraf, Context } from 'telegraf'
import { message } from 'telegraf/filters'
import * as fs from 'fs'
import * as path from 'path'

// Bot token
const BOT_TOKEN = '8943430639:AAFy5b_XD1lzRSjx5EA4xhxQUAFgaFU2VMA'

// Admin Telegram IDs
const ADMIN_IDS = [2122311885]

// Payment wallet (Solana)
const PAYMENT_WALLET = 'BDXMYzf9wQk7Qngd38prMVLfQh2H2nXzA4TJdYKaMHqA'

// JaaS config paths
const JAAS_DIR = '/Users/efinney/.openclaw/workspace/jaas'
const INSTANCES_DIR = path.join(JAAS_DIR, 'config/instances')
const INSTANCES_FILE = path.join(JAAS_DIR, 'config/instances.json')

// Onboarding sessions
const sessions = new Map<number, OnboardingSession>()

interface OnboardingSession {
  step: 'group_id' | 'payment' | 'confirm' | 'done'
  groupId?: string
  txSignature?: string
  tier?: 'starter'
  telegramHandle?: string
}

const bot = new Telegraf(BOT_TOKEN)

// ============ INSTANCE CREATION ============

async function createInstance(session: OnboardingSession): Promise<boolean> {
  try {
    const instanceId = session.groupId!.replace(/^-/, '').substring(5)
    const instanceDir = path.join(INSTANCES_DIR, instanceId)

    fs.mkdirSync(instanceDir, { recursive: true })

    const config = {
      id: instanceId,
      groupId: session.groupId,
      txSignature: session.txSignature,
      telegramHandle: session.telegramHandle,
      tier: 'starter',
      price: 25,
      currency: 'USDC',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active'
    }

    fs.writeFileSync(path.join(instanceDir, 'config.json'), JSON.stringify(config, null, 2))

    if (!fs.existsSync(INSTANCES_FILE)) {
      fs.writeFileSync(INSTANCES_FILE, JSON.stringify({ instances: [] }, null, 2))
    }

    const registry = JSON.parse(fs.readFileSync(INSTANCES_FILE, 'utf8'))
    registry.instances.push({
      id: instanceId,
      groupId: session.groupId,
      txSignature: session.txSignature,
      status: 'active',
      createdAt: new Date().toISOString()
    })
    fs.writeFileSync(INSTANCES_FILE, JSON.stringify(registry, null, 2))

    console.log(`Instance created: ${instanceId}`)
    return true
  } catch (error) {
    console.error(`Failed to create instance: ${error}`)
    return false
  }
}

// ============ COMMANDS ============

bot.command('start', async (ctx) => {
  try {
    // Send the promotional image from local file
    const fs = require('fs')
    const imagePath = '/Users/efinney/.openclaw/workspace/jaas-bot/jaas-promo.jpg'
    
    if (fs.existsSync(imagePath)) {
      await ctx.replyWithPhoto({ source: imagePath }, {
        caption: `
Welcome to JaaS Bot!

Jeeevs as a Service - AI-powered Telegram moderation.

Pricing:
Starter: $25/month USDC (1 group)

Features:
- Spam & scam detection
- Auto-welcome new members
- FUD protection
- Natural engagement

Commands:
/subscribe - Start onboarding
/status - Check your instance
/help - Get help

Ready to protect your community? Type /subscribe
`
      })
    } else {
      // Fallback to text only if image doesn't exist
      ctx.reply(`
Welcome to JaaS Bot!

Jeeevs as a Service - AI-powered Telegram moderation.

Pricing:
Starter: $25/month USDC (1 group)

Features:
- Spam & scam detection
- Auto-welcome new members
- FUD protection
- Natural engagement

Commands:
/subscribe - Start onboarding
/status - Check your instance
/help - Get help

Ready to protect your community? Type /subscribe
`)
    }
  } catch (error) {
    // If image fails, send text only
    ctx.reply(`
Welcome to JaaS Bot!

Jeeevs as a Service - AI-powered Telegram moderation.

Pricing:
Starter: $25/month USDC (1 group)

Features:
- Spam & scam detection
- Auto-welcome new members
- FUD protection
- Natural engagement

Commands:
/subscribe - Start onboarding
/status - Check your instance
/help - Get help

Ready to protect your community? Type /subscribe
`)
  }
})

bot.command('subscribe', (ctx) => {
  const userId = ctx.from?.id
  if (!userId) return

  sessions.set(userId, { step: 'group_id', telegramHandle: ctx.from?.username })

  ctx.reply(`
JaaS Onboarding - Step 1/2

Plan: Starter - $25/month (USDC)
Groups: 1

Type your group ID to continue.

How to find it:
1. Add @Jeeevs222_bot to your group
2. Send a message in your group
3. Forward the message to me here

Or enter it manually:
Format: -1001234567890

Type /cancel to abort.
`)
})

bot.command('status', async (ctx) => {
  ctx.reply(`
JaaS Status Check

To check your instance status, please provide:
- Your group ID, or
- Your wallet address

Use /subscribe to set up a new instance.
`)
})

bot.command('help', (ctx) => {
  ctx.reply(`
JaaS Help

What is JaaS?
Jeeevs as a Service provides AI-powered Telegram moderation with zero API costs.

How does it work?
1. Subscribe (monthly payment in USDC)
2. Add @Jeeevs222_bot to your group
3. Grant admin role
4. Your group is protected 24/7

Pricing:
Starter: $25/month (1 group)

Commands:
/subscribe - Start onboarding
/status - Check your instance
/help - This message

Questions? Contact @maadmaax22
`)
})

bot.command('cancel', (ctx) => {
  const userId = ctx.from?.id
  if (userId && sessions.has(userId)) {
    sessions.delete(userId)
    ctx.reply('Onboarding cancelled. Type /subscribe to start again.')
  } else {
    ctx.reply('No active onboarding session.')
  }
})

// ============ ADMIN COMMANDS ============

bot.command('admin', (ctx) => {
  const userId = ctx.from?.id
  if (!userId || !ADMIN_IDS.includes(userId)) {
    ctx.reply('Unauthorized. Admin commands are restricted.')
    return
  }

  const args = ctx.message.text.split(' ').slice(1)
  const subcommand = args[0]?.toLowerCase()

  if (subcommand === 'list') {
    handleAdminList(ctx)
  } else {
    ctx.reply('Admin Commands:\n/admin list - List all instances')
  }
})

async function handleAdminList(ctx: Context) {
  try {
    if (!fs.existsSync(INSTANCES_FILE)) {
      ctx.reply('No instances found.')
      return
    }

    const registry = JSON.parse(fs.readFileSync(INSTANCES_FILE, 'utf8'))
    const instances = registry.instances || []

    if (instances.length === 0) {
      ctx.reply('No instances found.')
      return
    }

    let message = `JaaS Instances (${instances.length} total)\n\n`
    instances.forEach((inst: any) => {
      message += `- ${inst.id}: ${inst.groupId} (${inst.status})\n`
    })

    ctx.reply(message)
  } catch (error) {
    ctx.reply(`Error listing instances: ${error}`)
  }
}

// ============ ONBOARDING FLOW ============

bot.on(message('text'), async (ctx) => {
  const userId = ctx.from?.id
  if (!userId) return

  const text = ctx.message.text

  if (text.startsWith('/')) return

  const session = sessions.get(userId)
  if (!session) {
    ctx.reply('Type /subscribe to start onboarding, or /help for more information.')
    return
  }

  switch (session.step) {
    case 'group_id':
      await handleGroupId(ctx, session, text)
      break
    case 'payment':
      await handlePayment(ctx, session, text)
      break
    case 'confirm':
      await handleConfirm(ctx, session, text)
      break
    default:
      ctx.reply('Something went wrong. Type /cancel and try again.')
  }
})

async function handleGroupId(ctx: Context, session: OnboardingSession, text: string) {
  const userId = ctx.from?.id
  if (!userId) return

  let groupId = text.trim()
  
  // Auto-add -100 prefix if missing
  if (groupId.match(/^\d+$/)) {
    groupId = '-100' + groupId
  }
  else if (groupId.match(/^-\d+$/) && !groupId.startsWith('-100')) {
    groupId = groupId.replace(/^-/, '-100')
  }
  
  // Validate group ID format (-100...)
  if (!groupId.startsWith('-100') || !/^-100\d+$/.test(groupId)) {
    ctx.reply(`
Invalid group ID format.

You entered: ${text}
Converted to: ${groupId}

Group ID should look like: -1001234567890

How to find it:
1. Add @Jeeevs222_bot to your group
2. Send a message
3. Forward it to me here

Or enter it manually (format: -100XXXXXXXXXX)
`)
    return
  }

  session.groupId = groupId
  session.tier = 'starter'
  session.step = 'payment'

  ctx.reply(`
Group ID: ${groupId}

Step 2/3 - Payment

Plan: Starter
Price: $25/month (USDC)
Groups: 1

PAYMENT INSTRUCTIONS:

1. Send $25 USDC to this wallet:

${PAYMENT_WALLET}

2. Copy your transaction signature:
   - Phantom: Click transaction → Copy signature
   - Solscan: Transaction ID at top

3. Paste your transaction signature below
   Example: 5Xw8vJhKBi... (80+ characters)

Need USDC? Buy on Jupiter: https://jup.ag/

Type /cancel to abort.
`)
}

async function handlePayment(ctx: Context, session: OnboardingSession, text: string) {
  const userId = ctx.from?.id
  if (!userId) return

  const txSignature = text.trim()

  // Validate transaction signature (Solana signatures are long base58 strings)
  if (txSignature.length < 80 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(txSignature)) {
    ctx.reply(`
Invalid transaction signature.

Please paste your transaction signature.

How to find it:
1. Open Phantom wallet
2. Click on the transaction
3. Click "Copy signature" or "View on Solscan"
4. Copy the long string at the top

Example: 5Xw8vJhKBi... (80+ characters)

Type /cancel to abort.
`)
    return
  }

  session.txSignature = txSignature
  session.step = 'confirm'

  ctx.reply(`
Payment Received!

Transaction: ${txSignature.substring(0, 20)}...${txSignature.substring(txSignature.length - 8)}

SUMMARY:

Plan: Starter
Price: $25/month (USDC)
Groups: 1
Group: ${session.groupId}

We will verify your payment on-chain and activate your instance.

Type "confirm" to create your JaaS instance.
`)
}

async function handleConfirm(ctx: Context, session: OnboardingSession, text: string) {
  const userId = ctx.from?.id
  if (!userId) return

  const confirmation = text.toLowerCase().trim()

  if (confirmation !== 'confirm') {
    ctx.reply('Please type "confirm" to proceed, or /cancel to abort.')
    return
  }

  ctx.reply('Creating your JaaS instance...')

  try {
    const instanceId = session.groupId!.replace(/^-/, '').substring(5)
    const instanceCreated = await createInstance(session)
    
    sessions.delete(userId)

    if (instanceCreated) {
      ctx.reply(`
JaaS Instance Created!

Your instance is now active.

NEXT STEPS:

1. Add @Jeeevs222_bot to your group
2. Grant admin permissions to the bot
3. Your group is protected 24/7!

INSTANCE DETAILS:

Instance: ${instanceId}
Plan: Starter ($25/month)
Group: ${session.groupId}
Status: Active

Use /status to check your instance.

Questions? Contact @maadmaax22
`)
    } else {
      ctx.reply(`
JaaS Instance Submitted!

Your instance is pending activation.

NEXT STEPS:

1. Add @Jeeevs222_bot to your group
2. Grant admin permissions to the bot
3. Wait for activation

Questions? Contact @maadmaax22
`)
    }

    const statusText = instanceCreated ? 'Auto-created' : 'Pending activation'
    await ctx.telegram.sendMessage(ADMIN_IDS[0].toString(), `
New JaaS Subscription

User: @${session.telegramHandle || 'unknown'}
Plan: Starter ($25/month)
Group: ${session.groupId}
TX: ${session.txSignature?.substring(0, 20)}...
Status: ${statusText}

Verify payment: https://solscan.io/tx/${session.txSignature}
Payment: $25 USDC to ${PAYMENT_WALLET}
`)

  } catch (error) {
    ctx.reply(`Failed to create instance: ${error}. Please contact @maadmaax22 for assistance.`)
  }
}

// ============ START BOT ============

console.log('JaaS Bot starting...')
console.log('Bot: @JeeevsAI_bot')

bot.launch()
  .then(() => {
    console.log('JaaS Bot is running!')
    console.log('Commands: /start, /subscribe, /status, /help, /admin')
    console.log('Pricing: $25/month USDC (Starter - 1 group)')
  })
  .catch((err) => {
    console.error('Failed to start bot:', err)
    process.exit(1)
  })

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGERM'))

export { bot }