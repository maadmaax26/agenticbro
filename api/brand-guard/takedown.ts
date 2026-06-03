/**
 * api/brand-guard/takedown.ts — Takedown Report Generator
 * ========================================================================
 * Generates platform-specific takedown reports (Shopify, Etsy, Registrar,
 * Twitter, Instagram, Facebook, TikTok, LinkedIn, Telegram, DMCA) and
 * stores them in Supabase.
 *
 * POST /api/brand-guard/takedown/generate
 *   Body: { scanId, scanType, platform, riskScore, riskLevel, evidence, brand, violator, user }
 *   Returns: { reportId, platform, renderedMarkdown, missingFields, platformFormUrl, confidence }
 *
 * GET /api/brand-guard/takedown/:reportId
 *   Returns: Stored report from brand_guard_reports
 *
 * GET /api/brand-guard/takedown/scan/:scanId
 *   Returns: All reports for a given scan
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// ── Types ────────────────────────────────────────────────────────────────────
interface TakedownInput {
  scanId?: string;
  scanType: 'impersonator' | 'domain' | 'email' | 'phone' | 'website' | 'marketplace';
  platform: 'shopify' | 'etsy' | 'registrar' | 'twitter' | 'instagram' |
    'facebook' | 'tiktok' | 'linkedin' | 'telegram' | 'dmca';
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  evidence: {
    urls?: string[];
    descriptions?: string;
    timestamps?: string;
    imageMatches?: Array<{ yourImage: string; theirImage: string; similarity: number }>;
  };
  brand: {
    name: string;
    website: string;
    trademarkNumber?: string;
  };
  violator: {
    platform: string;
    handle?: string;
    url: string;
    name?: string;
  };
  user: {
    id?: string;
    email: string;
    companyName: string;
    address?: string;
  };
}

interface TakedownReport {
  reportId: string;
  platform: string;
  renderedMarkdown: string;
  missingFields: string[];
  platformFormUrl: string;
  confidence: number;
}

// ── Platform form URLs ────────────────────────────────────────────────────────
const PLATFORM_FORM_URLS: Record<string, string> = {
  shopify: 'https://www.shopify.com/legal/ip-complaints',
  etsy: 'mailto:etsy-dmca@etsy.com',
  registrar: 'https://www.icann.org/resources/pages/help/dndr/udrp-en',
  twitter: 'https://help.twitter.com/forms/impersonation',
  instagram: 'https://help.instagram.com/contact/1361808127148823',
  facebook: 'https://www.facebook.com/help/contact/169486816475808',
  tiktok: 'https://www.tiktok.com/legal/report/user',
  linkedin: 'https://www.linkedin.com/help/linkedin/ask/TS-NIIP',
  telegram: 'https://telegram.org/faq#q-how-do-i-report-a-fake-account',
  dmca: 'https://dmca.com/Solutions/file_notice.aspx',
};

// ── Template functions ────────────────────────────────────────────────────────

function renderShopifyTemplate(input: TakedownInput): { body: string; missing: string[] } {
  const missing: string[] = [];
  if (!input.brand.trademarkNumber) missing.push('TRADEMARK_NUMBER (optional but strengthens claim)');
  if (!input.user.address) missing.push('YOUR_MAILING_ADDRESS');

  const body = `# SHOPIFY IP COMPLAINT REPORT
Brand Guard Scan ID: ${input.scanId}
Generated: ${new Date().toISOString()}
Confidence Score: ${input.riskScore}/100 (${input.riskLevel.toUpperCase()})

---

## 1. YOUR BRAND INFORMATION
Company Name: ${input.brand.name}
Official Website: ${input.brand.website}
Trademark Registration: ${input.brand.trademarkNumber || '[TRADEMARK_NUMBER — add if you have one]'}
Contact Email: ${input.user.email}
Mailing Address: ${input.user.address || '[YOUR_MAILING_ADDRESS]'}

## 2. INFRINGING STORE DETAILS
Platform: Shopify
Store URL: ${input.violator.url}
Store Name: ${input.violator.name || input.violator.handle || 'See URL above'}
Violation Type: Brand impersonation / Copyright infringement

## 3. SPECIFIC VIOLATIONS
${input.evidence.descriptions || 'This store is using our brand name, product images, and/or product descriptions without authorization.'}

Evidence URLs:
${input.evidence.urls?.map(u => `- ${u}`).join('\n') || '- [ATTACH SCREENSHOTS]'}

Detection Date: ${input.evidence.timestamps || new Date().toISOString()}

${input.evidence.imageMatches && input.evidence.imageMatches.length > 0 ? `
## 4. STOLEN IMAGE EVIDENCE
The following product images were detected as near-identical copies of our originals:
${input.evidence.imageMatches.map(m =>
  `- Our image: ${m.yourImage}\n  Their image: ${m.theirImage}\n  Similarity: ${m.similarity}%`
).join('\n')}
` : ''}

## 5. REQUESTED ACTION
We request immediate removal of the infringing store and all associated content.

## 6. GOOD FAITH STATEMENT
I have a good faith belief that use of the material described above is not authorized
by the brand owner, its agent, or the law. The information in this notification is
accurate. I am authorized to act on behalf of ${input.brand.name}.

Signed: ${input.user.companyName}
Date: ${new Date().toLocaleDateString()}
`;

  return { body, missing };
}

function renderEtsyTemplate(input: TakedownInput): { body: string; missing: string[] } {
  const missing: string[] = [];
  if (!input.user.address) missing.push('YOUR_FULL_LEGAL_NAME_AND_ADDRESS');

  const body = `# ETSY DMCA TAKEDOWN NOTICE
TO: etsy-dmca@etsy.com
SUBJECT: DMCA Notice of Copyright Infringement — ${input.brand.name}

Brand Guard Scan ID: ${input.scanId}
Generated: ${new Date().toISOString()}

---

Pursuant to 17 U.S.C. § 512(c)(3), I am submitting this notice of copyright infringement.

## 1. IDENTIFICATION OF COPYRIGHTED WORK
The copyrighted works are product photography, design assets, and written product
descriptions created for and owned by ${input.brand.name} (${input.brand.website}).

${input.evidence.descriptions || ''}

## 2. IDENTIFICATION OF INFRINGING MATERIAL
Infringing Store: ${input.violator.url}
Store Name: ${input.violator.name || '[STORE NAME]'}

Infringing Listings:
${input.evidence.urls?.map(u => `- ${u}`).join('\n') || '- [ADD SPECIFIC LISTING URLS]'}

${input.evidence.imageMatches && input.evidence.imageMatches.length > 0 ? `
## 3. IMAGE THEFT EVIDENCE
The following images were copied from our catalog:
${input.evidence.imageMatches.map(m =>
  `Our original: ${m.yourImage}\nInfringing copy: ${m.theirImage}\nMatch: ${m.similarity}%\n`
).join('\n')}
` : ''}

## 4. CONTACT INFORMATION
Name: ${input.user.companyName}
Email: ${input.user.email}
Address: ${input.user.address || '[YOUR_FULL_LEGAL_NAME_AND_ADDRESS]'}

## 5. STATEMENTS
I have a good faith belief that use of the copyrighted material described above
is not authorized by the copyright owner, its agent, or the law.

I declare under penalty of perjury that the information in this notice is accurate
and that I am the copyright owner or authorized to act on the copyright owner's behalf.

Electronic Signature: /s/ ${input.user.companyName}
Date: ${new Date().toLocaleDateString()}
`;

  return { body, missing };
}

function renderRegistrarTemplate(input: TakedownInput): { body: string; missing: string[] } {
  const missing: string[] = [];
  if (!input.brand.trademarkNumber) missing.push('TRADEMARK_RIGHTS_DESCRIPTION — describe your trademark claim');
  missing.push('BAD_FAITH_EVIDENCE — describe why you believe domain was registered in bad faith');

  const disputedDomain = input.violator.url.replace(/https?:\/\//, '').split('/')[0];

  const body = `# DOMAIN DISPUTE — UDRP COMPLAINT SUMMARY
Brand Guard Scan ID: ${input.scanId}
Generated: ${new Date().toISOString()}
Risk Score: ${input.riskScore}/100 (${input.riskLevel.toUpperCase()})

Submit to: https://www.icann.org/resources/pages/help/dndr/udrp-en
Recommended Provider: WIPO Arbitration Center (https://www.wipo.int/amc/en/domains/)

---

## COMPLAINANT (YOU)
Name: ${input.user.companyName}
Email: ${input.user.email}
Website: ${input.brand.website}

## RESPONDENT (DOMAIN HOLDER)
Disputed Domain: ${disputedDomain}
Legitimate Domain: ${input.brand.website.replace(/https?:\/\//, '')}
[Registrar and registrant info available via WHOIS lookup of ${disputedDomain}]

## GROUNDS FOR COMPLAINT

### A. Identical or Confusingly Similar Domain
The disputed domain ${disputedDomain} is confusingly similar to our trademark
${input.brand.name} because:
- It incorporates our brand name with only minor additions/substitutions
- Detection by Brand Guard CT log monitoring confirms recent registration
- Our legitimate domain: ${input.brand.website}

### B. No Rights or Legitimate Interests
The registrant has no legitimate rights to the domain because:
- ${input.brand.name} owns the trademark for this brand name
- Trademark registration: ${input.brand.trademarkNumber || '[TRADEMARK_RIGHTS_DESCRIPTION]'}
- There is no known business relationship between us and the registrant

### C. Registered and Used in Bad Faith
Evidence of bad faith:
[BAD_FAITH_EVIDENCE]
- Domain registered after our brand was established
- Domain discovered via Brand Guard CT log monitoring on ${input.evidence.timestamps || new Date().toISOString()}
- Pattern matches known phishing/typosquatting behaviour

## EVIDENCE
${input.evidence.urls?.map(u => `- ${u}`).join('\n') || '[ATTACH SCREENSHOTS OF INFRINGING DOMAIN]'}
Brand Guard Scan Report: Scan ID ${input.scanId}

## REMEDY REQUESTED
Transfer of disputed domain to complainant.
`;

  return { body, missing };
}

function renderSocialTemplate(input: TakedownInput): { body: string; missing: string[] } {
  const body = `# SOCIAL PLATFORM IMPERSONATION REPORT
Platform: ${input.platform.toUpperCase()}
Brand Guard Scan ID: ${input.scanId}
Generated: ${new Date().toISOString()}
Risk Score: ${input.riskScore}/100 (${input.riskLevel.toUpperCase()})

Submit via: ${PLATFORM_FORM_URLS[input.platform]}

---

## ACCOUNT BEING IMPERSONATED (YOURS)
Brand Name: ${input.brand.name}
Official Website: ${input.brand.website}
Your Official Handle: [YOUR_OFFICIAL_${input.platform.toUpperCase()}_HANDLE]

## IMPERSONATING ACCOUNT
Handle/Username: ${input.violator.handle || '[INFRINGING_HANDLE]'}
Profile URL: ${input.violator.url}
Account Name: ${input.violator.name || '[INFRINGING_DISPLAY_NAME]'}

## IMPERSONATION EVIDENCE
${input.evidence.descriptions || 'This account is using our brand name, logo, and/or identity to mislead our customers.'}

Specific indicators detected by Brand Guard:
- Name similarity to our brand
- Possible use of our logo or brand assets
- Bio keywords matching our brand

Evidence Links:
${input.evidence.urls?.map(u => `- ${u}`).join('\n') || '- [ATTACH PROFILE SCREENSHOTS]'}

Detection Date: ${input.evidence.timestamps || new Date().toISOString()}

## IMPACT
This impersonating account is actively misleading our customers and damaging our brand reputation.

## REQUESTED ACTION
Immediate removal of the impersonating account.

Submitted by: ${input.user.companyName} (${input.user.email})
Date: ${new Date().toLocaleDateString()}
`;

  return { body, missing: [] };
}

function renderDMCATemplate(input: TakedownInput): { body: string; missing: string[] } {
  const missing: string[] = [];
  if (!input.user.address) missing.push('YOUR_FULL_LEGAL_NAME_AND_ADDRESS');

  const body = `# DMCA TAKEDOWN NOTICE
Brand Guard Scan ID: ${input.scanId}
Generated: ${new Date().toISOString()}

---

TO WHOM IT MAY CONCERN:

I am writing to notify you of copyright infringement occurring on your platform.

## COPYRIGHTED WORKS
Owner: ${input.brand.name}
Website: ${input.brand.website}
Description of original works: [DESCRIBE YOUR ORIGINAL CONTENT]

## INFRINGING MATERIAL
URL of infringing content: ${input.violator.url}
${input.evidence.urls?.map(u => `Additional URL: ${u}`).join('\n') || ''}

## DESCRIPTION OF INFRINGEMENT
${input.evidence.descriptions || '[DESCRIBE HOW YOUR CONTENT IS BEING COPIED]'}

${input.evidence.imageMatches && input.evidence.imageMatches.length > 0 ? `
## IMAGE EVIDENCE
${input.evidence.imageMatches.map(m =>
  `Original: ${m.yourImage} → Copy: ${m.theirImage} (${m.similarity}% match)`
).join('\n')}
` : ''}

## GOOD FAITH STATEMENT
I have a good faith belief that use of the material in the manner complained of
is not authorized by the copyright owner, its agent, or the law.

I declare under penalty of perjury that the information in this notice is accurate
and that I am authorized to act on behalf of the copyright owner.

## CONTACT
Name: ${input.user.companyName}
Email: ${input.user.email}
Address: ${input.user.address || '[YOUR_FULL_LEGAL_NAME_AND_ADDRESS]'}

Signature: /s/ ${input.user.companyName}
Date: ${new Date().toLocaleDateString()}
`;

  return { body, missing };
}

// ── Main router ───────────────────────────────────────────────────────────────
const TEMPLATE_ROUTER: Record<string, (input: TakedownInput) => { body: string; missing: string[] }> = {
  shopify: renderShopifyTemplate,
  etsy: renderEtsyTemplate,
  registrar: renderRegistrarTemplate,
  twitter: renderSocialTemplate,
  instagram: renderSocialTemplate,
  facebook: renderSocialTemplate,
  tiktok: renderSocialTemplate,
  linkedin: renderSocialTemplate,
  telegram: renderSocialTemplate,
  dmca: renderDMCATemplate,
};

// ── Helper ────────────────────────────────────────────────────────────────────
function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ── Handler ────────────────────────────────────────────────────────────────────
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  if (!supabase) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database not configured' }));
  }

  const url = req.url || '/';
  const parts = url.split('/').filter(Boolean);
  // /api/brand-guard/takedown/generate
  // /api/brand-guard/takedown/:reportId
  // /api/brand-guard/takedown/scan/:scanId

  try {
    // POST /generate (supports both /takedown/generate and /takedown)
    if (req.method === 'POST') {
      const input: TakedownInput = await parseBody(req);
      if (!input.evidence) input.evidence = { urls: [], descriptions: '' };

      if (!input.platform || !input.brand || !input.user) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing required fields: platform, brand, user' }));
      }

      if (!input.scanId) {
        input.scanId = randomUUID();
      }

      const templateFn = TEMPLATE_ROUTER[input.platform];
      if (!templateFn) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: `Unknown platform: ${input.platform}` }));
      }

      const { body, missing } = templateFn(input);
      const confidence = Math.max(0, input.riskScore - missing.length * 10);

      const insertData: Record<string, unknown> = {
        scan_id: input.scanId,
        scan_type: input.scanType || input.platform || 'unknown',
        platform: input.platform,
        report_body: body,
        missing_fields: missing,
        confidence,
        status: 'draft',
      };
      if (input.user?.id) insertData.user_id = input.user.id;

      const { data, error } = await supabase
        .from('brand_guard_reports')
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        console.error('[Takedown] Supabase insert error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: error.message }));
      }

      // Also insert into takedown_actions so it shows in the Takedown Center
      const takedownAction: any = {
        brand_monitor_id: input.scanId || '',
        platform: input.platform,
        action_type: 'report',
        status: 'pending',
        evidence_url: input.violator?.url || '',
        notes: `Auto-generated ${input.platform} takedown report (Risk: ${input.riskLevel}, Score: ${input.riskScore})`,
      };
      if (input.user?.id) takedownAction.user_id = input.user.id;

      try {
        await supabase.from('takedown_actions').insert(takedownAction);
      } catch (err) {
        console.error('[Takedown] Failed to insert takedown_action (non-blocking):', (err as Error).message);
      }

      const report: TakedownReport = {
        reportId: data.id,
        platform: input.platform,
        renderedMarkdown: body,
        missingFields: missing,
        platformFormUrl: PLATFORM_FORM_URLS[input.platform],
        confidence,
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(report));
    }

    // GET /scan/:scanId — all reports for a scan
    if (req.method === 'GET' && parts.length >= 5 && parts[3] === 'scan') {
      const scanId = parts[4];
      const { data, error } = await supabase
        .from('brand_guard_reports')
        .select('*')
        .eq('scan_id', scanId)
        .order('created_at', { ascending: false });

      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: error.message }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(data || []));
    }

    // GET /:reportId
    if (req.method === 'GET' && parts.length >= 4 && parts[3] !== 'generate' && parts[3] !== 'scan') {
      const reportId = parts[3];
      const { data, error } = await supabase
        .from('brand_guard_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error || !data) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Report not found' }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(data));
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found' }));

  } catch (err: any) {
    console.error('[Takedown] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || 'Internal error' }));
  }
}

export const config = {
  maxDuration: 15,
};