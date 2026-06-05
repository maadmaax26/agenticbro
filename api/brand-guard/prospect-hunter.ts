/**
 * api/brand-guard/prospect-hunter.ts — Brand Guard Prospect Hunter AI
 * ========================================================================
 * Server-side AI endpoints for the Brand Guard Prospect Hunter CRM.
 * Uses local Ollama models (glm-5, qwen3-coder) — no external API keys.
 *
 * POST /api/brand-guard/prospect-hunter
 *   Body: { action: "hunt" | "email" | "research", ...params }
 *
 * Actions:
 *   hunt    → Find companies experiencing brand impersonation
 *   email   → Generate cold outreach email for a prospect
 *   research → Generate threat intelligence brief for a prospect
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Config ────────────────────────────────────────────────────────────────────
// Local Ollama — no API keys needed, runs on the same machine
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_PROSPECT_MODEL || 'glm5:cloud';

// ── Types ──────────────────────────────────────────────────────────────────────
interface HuntRequest {
  action: 'hunt';
  vertical?: string;
  query?: string;
}

interface EmailRequest {
  action: 'email';
  company: string;
  website: string;
  email: string;
  contactRole?: string;
  vertical?: string;
  scanSummary: string;
  threatType: string;
  urgency?: string;
  source?: string;
  aiResearch?: string;
}

interface ResearchRequest {
  action: 'research';
  company: string;
  website: string;
  vertical?: string;
  scanSummary: string;
  threatType: string;
}

type ProspectRequest = HuntRequest | EmailRequest | ResearchRequest;

// ── Ollama API Call ────────────────────────────────────────────────────────────
async function callAI(prompt: string, maxTokens = 1500): Promise<string> {
  const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: {
        num_predict: maxTokens,
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown error');
    throw new Error(`Ollama ${OLLAMA_MODEL} error: ${response.status} — ${errText}`);
  }

  const data = await response.json();

  // Ollama chat format: { message: { content: "..." } }
  const text = data?.message?.content || data?.response || '';

  if (!text) {
    throw new Error('Empty response from Ollama');
  }

  return text;
}

// ── Action: Hunt ──────────────────────────────────────────────────────────────
async function handleHunt(req: VercelRequest, res: VercelResponse): Promise<void> {
  // eslint-disable-next-line no-void
  const { vertical, query } = req.body as HuntRequest;
  const searchTerm = query?.trim() || (vertical ? `${vertical} businesses` : '');

  if (!searchTerm) {
    res.status(400).json({ error: 'Provide a vertical or query' });
    return;
  }

  const verticalContext = vertical
    ? `Focus specifically on ${vertical} companies.`
    : '';

  const prompt = `You are a brand protection analyst for Brand Guard (agenticbro.app/brand-guard).

Your job: identify REAL, SPECIFIC small-to-medium businesses that have recently experienced brand impersonation, fake social accounts, lookalike domains, cloned stores, or vendor/invoice fraud.

Search criteria: ${searchTerm}
${verticalContext}

Find 6 real companies that:
- Have been publicly confirmed as impersonation victims (news, forum posts, their own announcements, social media posts)
- Are SMBs (not Fortune 500 — they have enterprise tools already)
- Face threats that Brand Guard can directly help with: fake social accounts, lookalike domains, cloned stores, email spoofing, fake vendor calls

Return ONLY a JSON array. No markdown. No explanation. Just the array:
[
  {
    "company": "exact real company name",
    "website": "their domain (no https://)",
    "email": "most likely contact email based on their domain",
    "linkedin": "their LinkedIn company page path (no https://)",
    "instagram": "@theirhandle or empty string",
    "vertical": "specific vertical e.g. Ecommerce / Footwear UK",
    "riskLevel": "critical|high|medium",
    "threatType": "one of: Cloned Store | Fake Social Accounts | Lookalike Domain | Email Spoofing | Vendor Fraud | Telegram Impersonation",
    "incidentSummary": "2-3 sentences: what specifically happened to them, when, what platform, what the attackers did. Be specific — name the fake domain or platform if known.",
    "source": "where this incident was reported (e.g. Shopify community forum, their own tweet, news article)",
    "urgency": "why they need help right now — 1 sentence",
    "contactRole": "the job title of the person most likely to respond (e.g. Founder, Head of Marketing, Security Manager)",
    "priorityChannel": "email|linkedin|instagram"
  }
]

Only return companies where the incident is publicly documented. Be specific — no generic examples.`;

  try {
    const raw = await callAI(prompt, 2000);

    let parsed;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      const start = clean.indexOf('[');
      const end = clean.lastIndexOf(']') + 1;
      parsed = JSON.parse(clean.slice(start, end));
    } catch {
      res.status(422).json({ error: 'Could not parse AI results. Try a more specific search.' });
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      res.status(404).json({ error: 'No results found. Try a different vertical or search term.' });
      return;
    }

    res.status(200).json({ results: parsed });
  } catch (error) {
    console.error('[prospect-hunter] Hunt error:', error);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
}

// ── Action: Generate Email ─────────────────────────────────────────────────────
async function handleEmail(req: VercelRequest, res: VercelResponse): Promise<void> {
  // eslint-disable-next-line no-void
  const body = req.body as EmailRequest;
  const { company, website, email: contactEmail, contactRole, vertical, scanSummary, threatType, urgency, source, aiResearch } = body;

  if (!company || !scanSummary) {
    res.status(400).json({ error: 'company and scanSummary are required' });
    return;
  }

  const prompt = `You are writing a cold outreach email for Brand Guard (agenticbro.app/brand-guard) — an AI brand protection tool that monitors for fake social accounts, lookalike domains, cloned stores, and email spoofing.

Target company: ${company}
Website: ${website}
Contact email: ${contactEmail}
Contact role: ${contactRole || 'Brand/Marketing team'}
Vertical: ${vertical}
What happened to them: ${scanSummary}
Threat type: ${threatType}
Urgency: ${urgency || ''}
Source of incident: ${source || ''}
${aiResearch ? `Research brief:\n${aiResearch}` : ''}

Write a cold outreach email that:
1. Opens with their SPECIFIC incident (reference what happened — the clone store, the fake account, the lookalike domain — not a generic opener)
2. Empathises briefly — this is damaging and frustrating
3. Explains Brand Guard solves this: continuous monitoring + instant takedown reports, 7-day free trial, NO credit card required
4. One clear CTA: visit agenticbro.app/brand-guard or reply to this email
5. Under 150 words in the body
6. Sounds human, not like a sales bot
7. No "I hope this email finds you well", no long feature lists

Format exactly as:
Subject: [subject line]

[body]

The AgenticBro Brand Guard Team
agenticbro.app/brand-guard`;

  try {
    const result = await callAI(prompt, 800);
    res.status(200).json({ email: result });
  } catch (error) {
    console.error('[prospect-hunter] Email generation error:', error);
    res.status(500).json({ error: 'Email generation failed. Please try again.' });
  }
}

// ── Action: Generate Research ──────────────────────────────────────────────────
async function handleResearch(req: VercelRequest, res: VercelResponse): Promise<void> {
  // eslint-disable-next-line no-void
  const body = req.body as ResearchRequest;
  const { company, website, vertical, scanSummary, threatType } = body;

  if (!company || !scanSummary) {
    res.status(400).json({ error: 'company and scanSummary are required' });
    return;
  }

  const prompt = `Brand protection analyst brief for Brand Guard sales team.

Company: ${company} (${website})
Vertical: ${vertical}
Known incident: ${scanSummary}
Threat type: ${threatType}

Provide a tight brief covering:
PROFILE: What the company does, rough size, market position (2 sentences)
EXPOSURE: Specific brand threat vectors they face beyond the known incident
DECISION MAKER: Who to contact, why they care, what language to use
HOOK: The single most compelling angle for Brand Guard outreach
TIMING: Why now is the right moment to reach out

Max 180 words. Labelled sections, no bullet points within sections.`;

  try {
    const result = await callAI(prompt, 600);
    res.status(200).json({ research: result });
  } catch (error) {
    console.error('[prospect-hunter] Research error:', error);
    res.status(500).json({ error: 'Research failed. Please try again.' });
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { action } = req.body;

  switch (action) {
    case 'hunt':
      await handleHunt(req, res);
      break;
    case 'email':
      await handleEmail(req, res);
      break;
    case 'research':
      await handleResearch(req, res);
      break;
    default:
      res.status(400).json({ error: 'Invalid action. Use: hunt, email, or research' });
  }
}