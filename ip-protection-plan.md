# Agentic Bro - IP Protection Implementation Plan

## Executive Summary

Move core proprietary logic to Supabase Edge Functions while keeping frontend public.

---

## Phase 1: Identify Proprietary Logic (Done ✅)

### Files to Move to Private/Supabase

| File | Size | Contains | Priority |
|------|------|----------|-----------|
| `api/phone-verify.ts` | 27KB | Phone scoring, flag values, threat intel | HIGH |
| `api/social-scan.ts` | 16KB | Social profile scoring | HIGH |
| `api/scam-investigate.ts` | 32KB | Investigation logic | HIGH |
| `scripts/phone_scorer.py` | 15KB | Python scoring | HIGH |
| `scripts/phone_scan_api.py` | 18KB | Phone API logic | MEDIUM |
| `api/profile-verify.ts` | 24KB | Profile verification | MEDIUM |

### What to Keep Public

| Component | Location | Reason |
|-----------|----------|--------|
| Frontend UI | `/src` | No proprietary logic |
| Basic API routes | `/api/scan.ts` | Just routing |
| Database schema | Supabase | Already private |
| Config | `.env.local` | Already private |

---

## Phase 2: Create Supabase Edge Functions

### Edge Functions to Create

```
supabase/functions/
├── phone-verify/
│   └── index.ts          ← Move from api/phone-verify.ts
├── social-scan/
│   └── index.ts          ← Move from api/social-scan.ts
├── profile-verify/
│   └── index.ts          ← Move from api/profile-verify.ts
├── scoring-core/
│   └── index.ts          ← Shared scoring logic
└── threat-intel/
    └── index.ts          ← Threat intelligence aggregation
```

### API Key Management

Move to Supabase secrets:
- `NUMVERIFY_API_KEY`
- `ABSTRACT_API_KEY`
- `FTC_API_KEY`
- CallControl API credentials

---

## Phase 3: Update Frontend to Call Edge Functions

### Before (Public API)

```typescript
// api/phone-verify.ts (public)
const res = await fetch('/api/phone-verify', {
  method: 'POST',
  body: JSON.stringify({ phone })
});
```

### After (Private Edge Function)

```typescript
// Call Supabase Edge Function instead
const res = await fetch('https://drvasofyghnxfxvkkwad.supabase.co/functions/v1/phone-verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ phone })
});
```

---

## Phase 4: Remove Proprietary Code from Public Repo

### After Edge Functions Deployed

1. Replace `api/phone-verify.ts` with thin wrapper
2. Replace `api/social-scan.ts` with thin wrapper
3. Remove scoring logic from public view
4. Remove flag values from public view
5. Remove threat intel logic from public view

### Example Thin Wrapper

```typescript
// api/phone-verify.ts (new public version - thin wrapper)
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  
  const { data, error } = await supabase.functions.invoke('phone-verify', {
    body: req.body
  });
  
  if (error) return res.status(500).json({ error });
  return res.json(data);
}
```

---

## Implementation Steps

### Step 1: Create Supabase Functions Directory
```bash
mkdir -p supabase/functions/{phone-verify,social-scan,profile-verify,scoring-core,threat-intel}
```

### Step 2: Move Core Logic
- Copy `api/phone-verify.ts` → `supabase/functions/phone-verify/index.ts`
- Copy `api/social-scan.ts` → `supabase/functions/social-scan/index.ts`
- Copy `api/profile-verify.ts` → `supabase/functions/profile-verify/index.ts`

### Step 3: Set Supabase Secrets
```bash
supabase secrets set NUMVERIFY_API_KEY=xxx
supabase secrets set ABSTRACT_API_KEY=xxx
supabase secrets set FTC_API_KEY=xxx
```

### Step 4: Deploy Edge Functions
```bash
supabase functions deploy phone-verify
supabase functions deploy social-scan
supabase functions deploy profile-verify
```

### Step 5: Update Frontend
- Change API calls to use Supabase Edge Functions
- Test thoroughly

### Step 6: Clean Public Repo
- Replace proprietary files with thin wrappers
- Push changes

---

## Estimated Timeline

| Step | Time | Status |
|------|------|--------|
| 1. Create Supabase structure | 30 min | Pending |
| 2. Move phone-verify | 1 hour | Pending |
| 3. Move social-scan | 1 hour | Pending |
| 4. Move profile-verify | 1 hour | Pending |
| 5. Set secrets | 15 min | Pending |
| 6. Deploy functions | 30 min | Pending |
| 7. Update frontend | 1 hour | Pending |
| 8. Test deployment | 30 min | Pending |
| 9. Clean public repo | 30 min | Pending |
| **Total** | **6-7 hours** | |

---

## Files to Create Now

1. `/Users/efinney/agenticbro/supabase/functions/phone-verify/index.ts`
2. `/Users/efinney/agenticbro/supabase/functions/social-scan/index.ts`
3. `/Users/efinney/agenticbro/supabase/functions/profile-verify/index.ts`
4. `/Users/efinney/agenticbro/supabase/config.toml`

---

## Security Benefits

| Protection | Before | After |
|------------|--------|-------|
| Scoring algorithm | Public | Private |
| Flag values | Public | Private |
| Threat intel logic | Public | Private |
| API keys | Public env vars | Supabase secrets |
| Attack surface | Full codebase | API surface only |

---

## Next Step

Start with `phone-verify` - it's the most critical and contains the 90-point scoring system.