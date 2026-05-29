/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 * Commercial use restrictions apply — contact agenticbro@agenticbro.app for licensing.
 */

/**
 * api/brand-guard/brands.ts — Brand Management API
 * ========================================================================
 * CRUD for brand_monitors — lets businesses create, read, update, delete
 * their brand profiles. The dashboard pulls brand_id from these records.
 *
 * POST   /api/brand-guard/brands          — Create a new brand
 * GET    /api/brand-guard/brands          — List user's brands
 * GET    /api/brand-guard/brands?id=xxx   — Get single brand
 * PATCH  /api/brand-guard/brands?id=xxx   — Update brand
 * DELETE /api/brand-guard/brands?id=xxx   — Delete brand
 *
 * Auth: Requires Supabase Auth token (Bearer header).
 *       All operations are scoped to the authenticated user's owner_id.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ── Auth helper ──────────────────────────────────────────────────────────────
async function getAuthenticatedUserId(req: IncomingMessage): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);

  // Verify token with Supabase Auth
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  return user.id;
}

// ── Parse body ───────────────────────────────────────────────────────────────
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

// ── Handler ──────────────────────────────────────────────────────────────────
type VercelRequest = IncomingMessage & { body?: Record<string, unknown>; method?: string };
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ── Auth check ──────────────────────────────────────────────────────────
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required. Send Bearer token from Supabase Auth.' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── GET: List or get brands ────────────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url || '', 'https://brand-guard.local');
    const brandId = url.searchParams.get('id');

    if (brandId) {
      // Get single brand
      const { data, error } = await supabase
        .from('brand_monitors')
        .select('*')
        .eq('id', brandId)
        .eq('owner_id', userId)
        .single();

      if (error || !data) {
        res.status(404).json({ error: 'Brand not found' });
        return;
      }
      res.status(200).json({ success: true, brand: data });
      return;
    }

    // List all user's brands
    const { data, error } = await supabase
      .from('brand_monitors')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: 'Failed to fetch brands', details: error.message });
      return;
    }
    res.status(200).json({ success: true, brands: data || [] });
    return;
  }

  // ── POST: Create a new brand ───────────────────────────────────────────
  if (req.method === 'POST') {
    const body = await parseBody(req);
    const { brand_name, brand_handle, brand_domain, platforms, scan_frequency } = body as Record<string, unknown>;

    if (!brand_name || !brand_handle) {
      res.status(400).json({ error: 'brand_name and brand_handle are required' });
      return;
    }

    const insertData = {
      owner_id: userId,
      brand_name: String(brand_name),
      brand_handle: String(brand_handle).replace(/^@/, ''), // strip leading @
      brand_domain: brand_domain ? String(brand_domain) : null,
      platforms: platforms || ['x', 'instagram', 'tiktok', 'facebook', 'telegram'],
      scan_frequency: scan_frequency || 'weekly',
      is_active: true,
    };

    const { data, error } = await supabase
      .from('brand_monitors')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // Check for duplicate
      if (error.code === '23505') {
        res.status(409).json({ error: 'A brand with this handle already exists for your account' });
        return;
      }
      res.status(500).json({ error: 'Failed to create brand', details: error.message });
      return;
    }

    // ── Auto-initialize 10 free Brand Guard credits for new users ───────
    // Calls the DB function that creates the credits row if it doesn't exist
    try {
      await supabase.rpc('initialize_brand_guard_credits', { p_owner_id: userId });
    } catch (creditErr) {
      // Non-fatal: credits may already exist from a previous brand
      console.warn('[brands] Credit initialization skipped (may already exist):', creditErr);
    }

    res.status(201).json({ success: true, brand: data, credits: { free_remaining: 10, message: '10 free Brand Guard scans granted!' } });
    return;
  }

  // ── PATCH: Update a brand ──────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const url = new URL(req.url || '', 'https://brand-guard.local');
    const brandId = url.searchParams.get('id');
    if (!brandId) {
      res.status(400).json({ error: 'id query parameter is required for updates' });
      return;
    }

    const body = await parseBody(req);
    const allowedFields = ['brand_name', 'brand_handle', 'brand_domain', 'platforms', 'scan_frequency', 'is_active'];
    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updates[key] = key === 'brand_handle' ? String(body[key]).replace(/^@/, '') : body[key];
      }
    }
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length === 1) { // only updated_at
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    const { data, error } = await supabase
      .from('brand_monitors')
      .update(updates)
      .eq('id', brandId)
      .eq('owner_id', userId)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: 'Failed to update brand', details: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }

    res.status(200).json({ success: true, brand: data });
    return;
  }

  // ── DELETE: Remove a brand ─────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const url = new URL(req.url || '', 'https://brand-guard.local');
    const brandId = url.searchParams.get('id');
    if (!brandId) {
      res.status(400).json({ error: 'id query parameter is required for deletion' });
      return;
    }

    const { error } = await supabase
      .from('brand_monitors')
      .delete()
      .eq('id', brandId)
      .eq('owner_id', userId);

    if (error) {
      res.status(500).json({ error: 'Failed to delete brand', details: error.message });
      return;
    }

    res.status(200).json({ success: true, deleted: brandId });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

export const config = {
  maxDuration: 10,
};