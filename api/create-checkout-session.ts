/**
 * Stripe Checkout Session Creation
 * 
 * Creates a Stripe Checkout session for purchasing scan credits
 * Endpoint: POST /api/create-checkout-session
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckoutRequest {
  packageId: string;
  userId: string;
  email: string;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonus?: number;
}

// ─── Credit Packages ──────────────────────────────────────────────────────────

const PACKAGES: Record<string, CreditPackage> = {
  'starter': { id: 'starter', name: 'Starter', credits: 5, price: 500 }, // $5.00 in cents
  'basic': { id: 'basic', name: 'Basic', credits: 10, price: 900, bonus: 1 }, // $9.00
  'pro': { id: 'pro', name: 'Pro', credits: 25, price: 2000, bonus: 5 }, // $20.00
  'whale': { id: 'whale', name: 'Whale', credits: 100, price: 7500, bonus: 25 }, // $75.00
};

// ─── Stripe Integration ───────────────────────────────────────────────────────

// Stripe API base URL
const STRIPE_API = 'https://api.stripe.com/v1';

async function createStripeCheckoutSession(
  package_: CreditPackage,
  userId: string,
  email: string,
  stripeSecretKey: string
): Promise<{ url: string; sessionId: string }> {
  const totalCredits = package_.credits + (package_.bonus || 0);
  
  const lineItem = {
    price_data: {
      currency: 'usd',
      product_data: {
        name: `${package_.name} Scan Package`,
        description: `${totalCredits} profile scans${package_.bonus ? ` (+${package_.bonus} bonus)` : ''}`,
        metadata: {
          credits: String(totalCredits),
          package_id: package_.id,
        },
      },
      unit_amount: package_.price,
    },
    quantity: 1,
  };

  const successUrl = `${process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:5173'}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
  
  const cancelUrl = `${process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:5173'}/payment-cancelled`;

  // Create checkout session via Stripe API
  const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': lineItem.price_data.currency,
      'line_items[0][price_data][product_data][name]': lineItem.price_data.product_data.name,
      'line_items[0][price_data][product_data][description]': lineItem.price_data.product_data.description || '',
      'line_items[0][price_data][unit_amount]': String(lineItem.price_data.unit_amount),
      'line_items[0][quantity]': String(lineItem.quantity),
      'mode': 'payment',
      'success_url': successUrl,
      'cancel_url': cancelUrl,
      'customer_email': email,
      'metadata[user_id]': userId,
      'metadata[credits]': String(totalCredits),
      'metadata[package_id]': package_.id,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Stripe API error:', error);
    throw new Error(`Stripe API error: ${response.status}`);
  }

  const session = await response.json();
  
  return {
    url: session.url,
    sessionId: session.id,
  };
}

// ─── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get Stripe secret key from environment
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ 
      error: 'Payment system not configured. Please set STRIPE_SECRET_KEY.' 
    });
  }

  try {
    const { packageId, userId, email } = req.body as CheckoutRequest;

    // Validate request
    if (!packageId || !userId) {
      return res.status(400).json({ 
        error: 'Missing required fields: packageId, userId' 
      });
    }

    // Get package
    const package_ = PACKAGES[packageId];
    if (!package_) {
      return res.status(400).json({ 
        error: `Invalid package: ${packageId}. Valid packages: ${Object.keys(PACKAGES).join(', ')}` 
      });
    }

    // Create Stripe checkout session
    const { url, sessionId } = await createStripeCheckoutSession(
      package_,
      userId,
      email || '',
      stripeSecretKey
    );

    return res.status(200).json({
      url,
      sessionId,
    });

  } catch (error) {
    console.error('Checkout session creation error:', error);
    return res.status(500).json({ 
      error: 'Failed to create checkout session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}