# Supabase API Key Migration Fix — 2026-05-21

## Problem
Supabase disabled legacy JWT-format API keys (anon/service_role) on 2026-05-17.
Website showed "Legacy API keys are disabled" on signup page.

## Fix Applied
- Migrated all code to support new `sb_publishable_` / `sb_secret_` key format
- Frontend: `VITE_SUPABASE_PUBLISHABLE_KEY` (primary) → `VITE_SUPABASE_ANON_KEY` (fallback)
- Backend: `SUPABASE_SECRET_API_KEY` (primary) → `SUPABASE_SERVICE_ROLE_KEY` (fallback)
- All 13+ API endpoints updated with fallback chains
- Deployed to agenticbro.app via Vercel

## New Keys
- **Publishable (frontend):** `sb_publishable_8K21jIXcChNsU-6IIA3lfg_LN_qDNLP`
- **Secret (backend):** `***REMOVED***`
- **Legacy keys (DISABLED):** `eyJ...zoQ6E5WC...` (anon) and `eyJ...6oKttLuAg...` (service_role)

## Files Updated
- `src/lib/supabase.ts` — Frontend client
- `server/lib/supabase.ts` — Backend client
- `server/index.ts` — Express server
- `api/phone-verify-wrapper.ts`, `api/scan-stats.ts` — API endpoints
- All `api/*.ts` files — Fallback chains
- `agentic-bro/routes/scan.ts`, `sync.ts` — Backend routes
- `.env.local`, `.env`, `.env.local.example` — Env vars

## Vercel Env Vars (agenticbro project)
- ✅ VITE_SUPABASE_URL
- ✅ VITE_SUPABASE_PUBLISHABLE_KEY (added by Madmax)
- ✅ VITE_SUPABASE_ANON_KEY (legacy, still present)
- ✅ SUPABASE_URL
- ✅ SUPABASE_SECRET_API_KEY
- ⚠️ SUPABASE_SERVICE_ROLE_KEY (legacy, disabled but still in Vercel)

## Status
- Frontend auth: ✅ FIXED (publishable key working)
- Backend API: ✅ WORKING (secret key working)
- Site deployed: ✅ https://agenticbro.app