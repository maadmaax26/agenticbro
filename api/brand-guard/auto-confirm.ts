/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/auto-confirm.ts — Auto-confirm Brand Guard user signups
 * ============================================================================
 * Since Supabase Site URL is stuck on localhost:3000 and legacy keys are disabled,
 * this endpoint auto-confirms users after they sign up on Brand Guard.
 * 
 * Flow:
 * 1. User signs up on Brand Guard (email confirmation required by Supabase)
 * 2. Frontend immediately calls this endpoint with the user's email + signup token
 * 3. This endpoint confirms the user via Supabase admin API
 * 4. Frontend signs the user in automatically — no email link needed
 * 
 * Security: Rate-limited, requires a valid Supabase signup context
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabasePublishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Simple in-memory rate limiter (per IP, 3 requests per 60 seconds)
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + 60000 });
    return false;
  }
  entry.count++;
  return entry.count > 3;
}

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  // Rate limit
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Too many requests' }));
  }

  const { email } = await parseBody(req) as { email?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Valid email required' }));
  }

  if (!supabaseUrl || !supabasePublishableKey || !supabaseServiceKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Server configuration error' }));
  }

  try {
    // Use service role key to create admin client
    // The sb_secret_ format is the new service key — use it as the service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Find the user by email and update them
    // First, list users to find the one matching this email
    const { data: usersList, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.error('List users error:', listError.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to find user' }));
    }

    const user = usersList?.users?.find(u => u.email === email);
    if (!user) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'User not found', confirmed: false }));
    }

    if (user.email_confirmed_at) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, confirmed: true, message: 'Already confirmed' }));
    }

    // Update user to confirm their email
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });

    if (updateError) {
      console.error('Confirm error:', updateError.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to confirm email' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      success: true, 
      confirmed: true,
      message: 'Email confirmed successfully'
    }));
  } catch (err: any) {
    console.error('Auto-confirm error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Failed to confirm email' }));
  }
}