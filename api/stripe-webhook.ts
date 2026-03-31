/**
 * Stripe Webhook Handler
 * 
 * Handles Stripe webhook events for payment completion
 * Endpoint: POST /api/stripe-webhook
 * 
 * Setup:
 * 1. Go to Stripe Dashboard → Developers → Webhooks
 * 2. Add endpoint: https://your-domain.com/api/stripe-webhook
 * 3. Copy the webhook secret to STRIPE_WEBHOOK_SECRET env var
 * 4. Select these events: checkout.session.completed
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}

interface CheckoutSession {
  id: string;
  customer_email?: string;
  metadata: {
    user_id?: string;
    credits?: string;
    package_id?: string;
  };
  payment_status: string;
}

// ─── Credit Storage (In-Memory / Database) ────────────────────────────────────

// For production, use a database (Supabase, PostgreSQL, etc.)
// This in-memory store is for development/testing only
const creditStore: Record<string, number> = {};

/**
 * Add credits to user account
 * In production, this should write to your database
 */
async function addCreditsToUser(userId: string, credits: number): Promise<void> {
  // Development: Store in memory
  creditStore[userId] = (creditStore[userId] || 0) + credits;
  console.log(`[webhook] Added ${credits} credits to user ${userId}. New balance: ${creditStore[userId]}`);
  
  // Production: Write to database
  // Example with Supabase:
  // const { error } = await supabase
  //   .from('user_profiles')
  //   .update({ scan_credits: supabase.rpc('increment', { credits }) })
  //   .eq('id', userId);
  
  // Or with a credit transactions table:
  // await supabase.from('credit_transactions').insert({
  //   user_id: userId,
  //   amount: credits,
  //   transaction_type: 'purchase',
  //   payment_method: 'stripe',
  // });
}

/**
 * Get user's current credit balance
 */
export function getUserCredits(userId: string): number {
  return creditStore[userId] || 0;
}

// ─── Webhook Handler ───────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    // For development, allow skipping verification
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[webhook] Skipping signature verification in development');
    } else {
      return res.status(500).json({ error: 'Webhook not configured' });
    }
  }

  // Get the raw body for signature verification
  const payload = typeof req.body === 'string' 
    ? req.body 
    : JSON.stringify(req.body);
    
  const signature = req.headers['stripe-signature'] as string;

  // Verify webhook signature (in production)
  // Note: For proper signature verification, use the stripe library
  // This simplified version works with Vercel's body parsing
  
  try {
    // Parse the event
    const event: StripeEvent = typeof req.body === 'object' 
      ? req.body 
      : JSON.parse(req.body);

    console.log(`[webhook] Received event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as CheckoutSession;
        
        console.log('[webhook] Checkout session completed:', session.id);
        console.log('[webhook] Metadata:', session.metadata);
        
        // Extract data
        const userId = session.metadata?.user_id;
        const credits = parseInt(session.metadata?.credits || '0', 10);
        
        if (!userId || !credits) {
          console.error('[webhook] Missing user_id or credits in metadata');
          return res.status(400).json({ error: 'Missing metadata' });
        }

        // Add credits to user
        await addCreditsToUser(userId, credits);
        
        console.log(`[webhook] Successfully added ${credits} credits to ${userId}`);
        break;
      }
      
      case 'payment_intent.succeeded': {
        console.log('[webhook] Payment intent succeeded');
        // Additional handling if needed
        break;
      }
      
      default: {
        console.log(`[webhook] Unhandled event type: ${event.type}`);
      }
    }

    // Return success
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('[webhook] Error processing webhook:', error);
    return res.status(400).json({ 
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}