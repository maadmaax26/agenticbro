/**
 * Copyright (c) 2026 Agentic Bro. Licensed under the Business Source License 1.1.
 * See LICENSE file in the parent directory. Change Date: 2029-05-24. Change License: Apache-2.0.
 *
 * server/lib/x-impersonator-scanner.ts
 * =====================================
 * CDP-based X/Twitter profile scanner for brand impersonator detection.
 *
 * Uses the locally running Chrome instance (chrome --remote-debugging-port=18801)
 * to fetch real X profile data without requiring API keys.
 *
 * Flow per variant:
 *   1. Open a new tab to https://x.com/<username>
 *   2. Wait for page load
 *   3. Extract profile data via CDP Runtime.evaluate
 *   4. Close the tab
 *   5. Return XProfile or null (user doesn't exist)
 */

import WebSocket from 'ws';

// ── Types ────────────────────────────────────────────────────────────────────

export interface XProfile {
  exists: true;
  username: string;
  displayName: string;
  verified: boolean;
  followers: number;
  following: number;
  bio: string | null;
  location: string | null;
  website: string | null;
  profileImageUrl: string | null;
  profileUrl: string;
  fetchedAt: string;
}

interface CdpPage {
  id: string;
  url: string;
  type: string;
  webSocketDebuggerUrl?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_LOAD_WAIT_MS = 8000;   // time to wait after opening a tab
const CDP_EVAL_TIMEOUT_MS = 12000; // max time for WebSocket CDP call
const RATE_DELAY_MS = 2500;        // delay between profile checks

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function getPages(cdpUrl: string): Promise<CdpPage[]> {
  const res = await fetch(`${cdpUrl}/json/list`);
  const all = (await res.json()) as CdpPage[];
  return all.filter(p => p.type === 'page');
}

async function openTab(cdpUrl: string, url: string): Promise<CdpPage> {
  const res = await fetch(`${cdpUrl}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return (await res.json()) as CdpPage;
}

async function closeTab(cdpUrl: string, tabId: string): Promise<void> {
  try {
    await fetch(`${cdpUrl}/json/close/${tabId}`);
  } catch {
    // Ignore — tab may already be closed
  }
}

// ── CDP Profile Extraction ────────────────────────────────────────────────────

/** Runs inside the Chrome page via Runtime.evaluate to extract X profile data. */
const EXTRACTION_SCRIPT = `
(function() {
  // If UserName element is absent, profile probably doesn't exist or hasn't loaded
  const nameEl = document.querySelector('[data-testid="UserName"]');
  const headerEl = document.querySelector('[data-testid="UserProfileHeader_Items"]');
  if (!nameEl && !headerEl) {
    return JSON.stringify({ exists: false, reason: 'no_profile_elements' });
  }

  function parseNum(v) {
    if (!v) return 0;
    const s = String(v).toUpperCase().replace(/,/g, '').trim();
    if (s.endsWith('K')) return Math.round(parseFloat(s) * 1000);
    if (s.endsWith('M')) return Math.round(parseFloat(s) * 1000000);
    if (s.endsWith('B')) return Math.round(parseFloat(s) * 1000000000);
    return parseInt(s) || 0;
  }

  const d = {
    exists: true,
    username: null, displayName: null, verified: false,
    followers: 0, following: 0, bio: null,
    location: null, website: null, profileImageUrl: null,
  };

  // Display name + @handle
  if (nameEl) {
    const spans = [...nameEl.querySelectorAll('span')]
      .map(s => (s.textContent || '').trim())
      .filter(Boolean);
    if (spans.length) d.displayName = spans[0];
    for (const s of spans) {
      if (s.startsWith('@')) { d.username = s.slice(1); break; }
    }
  }

  // Verified badge
  const vEl = document.querySelector('[data-testid="icon-verified"]') ||
               document.querySelector('svg[aria-label*="Verified"]');
  d.verified = !!vEl;

  // Bio
  const bioEl = document.querySelector('[data-testid="UserDescription"]');
  if (bioEl) d.bio = (bioEl.innerText || '').trim().slice(0, 500);

  // Followers / following from anchor hrefs
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.href || '';
    const txt = a.textContent || '';
    if (href.includes('/followers') || href.includes('/verified_followers')) {
      const m = txt.match(/([\d,.]+[KkMm]?)/);
      if (m && d.followers === 0) d.followers = parseNum(m[1]);
    }
    if (href.includes('/following')) {
      const m = txt.match(/([\d,.]+[KkMm]?)/);
      if (m && d.following === 0) d.following = parseNum(m[1]);
    }
  });

  // Location
  const locEl = document.querySelector('[data-testid="UserLocation"]');
  if (locEl) d.location = (locEl.textContent || '').trim().slice(0, 100);

  // Website
  const urlEl = document.querySelector('[data-testid="UserUrl"]');
  if (urlEl) d.website = (urlEl.textContent || '').trim();

  // Profile image
  const imgEl = document.querySelector('[data-testid="UserAvatar"] img') ||
                document.querySelector('img[src*="profile_images"]');
  if (imgEl) d.profileImageUrl = imgEl.src;

  return JSON.stringify(d);
})()
`;

async function extractProfileViaCDP(wsUrl: string, fallbackUsername: string): Promise<XProfile | null> {
  return new Promise((resolve) => {
    let settled = false;

    const settle = (val: XProfile | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      resolve(val);
    };

    const timer = setTimeout(() => {
      console.warn(`[X Scanner] CDP eval timeout for @${fallbackUsername}`);
      settle(null);
    }, CDP_EVAL_TIMEOUT_MS);

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: EXTRACTION_SCRIPT },
      }));
    });

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          id?: number;
          result?: { result?: { value?: string } };
          error?: { message: string };
        };

        if (msg.id !== 1) return;

        if (msg.error) {
          console.warn(`[X Scanner] CDP error for @${fallbackUsername}:`, msg.error.message);
          settle(null);
          return;
        }

        const jsonStr = msg.result?.result?.value;
        if (!jsonStr) { settle(null); return; }

        const p = JSON.parse(jsonStr) as {
          exists: boolean;
          reason?: string;
          username?: string | null;
          displayName?: string | null;
          verified?: boolean;
          followers?: number;
          following?: number;
          bio?: string | null;
          location?: string | null;
          website?: string | null;
          profileImageUrl?: string | null;
        };

        if (!p.exists) { settle(null); return; }

        settle({
          exists: true,
          username: p.username || fallbackUsername,
          displayName: p.displayName || fallbackUsername,
          verified: p.verified || false,
          followers: p.followers || 0,
          following: p.following || 0,
          bio: p.bio || null,
          location: p.location || null,
          website: p.website || null,
          profileImageUrl: p.profileImageUrl || null,
          profileUrl: `https://x.com/${p.username || fallbackUsername}`,
          fetchedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn(`[X Scanner] Parse error for @${fallbackUsername}:`, e);
        settle(null);
      }
    });

    ws.on('error', (err: Error) => {
      console.warn(`[X Scanner] WS error for @${fallbackUsername}:`, err.message);
      settle(null);
    });
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check if a specific X username exists and return profile data.
 * Opens a Chrome tab, waits for load, extracts via CDP, closes the tab.
 */
export async function checkXProfile(username: string, cdpUrl: string): Promise<XProfile | null> {
  const clean = username.replace(/^@/, '').toLowerCase().trim();
  if (!clean) return null;

  const xUrl = `https://x.com/${clean}`;
  let tabId: string | null = null;

  try {
    // Reuse an already-open tab for this profile if it exists
    const pages = await getPages(cdpUrl);
    const existing = pages.find(p =>
      p.url.toLowerCase().includes(`x.com/${clean}`) ||
      p.url.toLowerCase().includes(`twitter.com/${clean}`)
    );

    let wsUrl: string | null = null;

    if (existing && existing.webSocketDebuggerUrl) {
      tabId = existing.id;
      wsUrl = existing.webSocketDebuggerUrl;
    } else {
      const tab = await openTab(cdpUrl, xUrl);
      tabId = tab.id;

      // Wait for X to load
      await sleep(PAGE_LOAD_WAIT_MS);

      // Refresh page list to get wsUrl (sometimes absent in the PUT response)
      const updated = await getPages(cdpUrl);
      const found = updated.find(p => p.id === tabId);
      wsUrl = found?.webSocketDebuggerUrl || tab.webSocketDebuggerUrl || null;
    }

    if (!wsUrl) {
      console.warn(`[X Scanner] No wsUrl for tab ${tabId} (@${clean})`);
      return null;
    }

    return await extractProfileViaCDP(wsUrl, clean);

  } catch (err) {
    console.error(`[X Scanner] Unexpected error for @${clean}:`, err);
    return null;
  } finally {
    if (tabId) await closeTab(cdpUrl, tabId);
  }
}

/**
 * Scan a list of variant usernames on X, returning only profiles that actually exist.
 * Processes serially with a rate delay to avoid triggering X rate limits.
 */
export async function scanVariantsOnX(
  variants: string[],
  options: {
    cdpUrl?: string;
    rateDelayMs?: number;
    maxVariants?: number;
  } = {}
): Promise<XProfile[]> {
  const cdpUrl = options.cdpUrl ?? (process.env.CDP_URL || 'http://localhost:18801');
  const delay = options.rateDelayMs ?? RATE_DELAY_MS;
  const limit = options.maxVariants ?? 20;

  // Verify Chrome CDP is reachable before starting
  try {
    const ping = await fetch(`${cdpUrl}/json/version`);
    if (!ping.ok) throw new Error(`CDP returned ${ping.status}`);
  } catch (e) {
    console.error(`[X Scanner] Chrome CDP not available at ${cdpUrl}:`, e);
    return [];
  }

  const toCheck = variants.slice(0, limit);
  const found: XProfile[] = [];

  for (let i = 0; i < toCheck.length; i++) {
    const variant = toCheck[i];
    console.log(`[X Scanner] ${i + 1}/${toCheck.length}: @${variant}`);

    const profile = await checkXProfile(variant, cdpUrl);
    if (profile) {
      console.log(`[X Scanner] ✓ Found @${profile.username} — ${profile.followers} followers, verified=${profile.verified}`);
      found.push(profile);
    }

    // Rate delay between checks (skip after last one)
    if (i < toCheck.length - 1) await sleep(delay);
  }

  console.log(`[X Scanner] Done. Checked ${toCheck.length} variants, found ${found.length} real profiles.`);
  return found;
}
