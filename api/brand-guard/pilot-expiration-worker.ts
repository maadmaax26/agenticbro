import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { endBrandGuardPilot, type BrandGuardPilot } from '../_lib/brand-guard-pilot.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SECRET_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const db = createClient(supabaseUrl, serviceKey);

async function sendEndedEmail(email: string, endsAt: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[pilot-expiration] RESEND_API_KEY is not configured');
    return false;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Brand Guard <alerts@agenticbro.app>',
      to: [email],
      subject: 'Your Brand Guard pilot has ended',
      html: `<p>Your 30-day Brand Guard Fortress pilot ended on ${new Date(endsAt).toLocaleDateString('en-US')}.</p><p>Automated monitoring under the pilot is now paused. Your account and prior results remain available.</p><p>To continue monitoring your brand, choose a paid subscription plan in Brand Guard.</p><p><a href="https://agenticbro.app/brand-guard">View Brand Guard plans</a></p>`,
    }),
  });
  if (!response.ok) console.error('[pilot-expiration] Resend failed:', response.status, await response.text());
  return response.ok;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!['GET', 'POST'].includes(req.method || '')) { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }

  const now = new Date().toISOString();
  const { data: due, error: dueError } = await db.from('brand_guard_pilots').select('*')
    .eq('status', 'active').lte('ends_at', now).limit(100);
  if (dueError) { res.status(500).json({ error: dueError.message }); return; }

  const errors: Array<{ pilot_id: string; error: string }> = [];
  for (const pilot of (due || []) as BrandGuardPilot[]) {
    try { await endBrandGuardPilot(db, pilot, 'expired'); }
    catch (error) { errors.push({ pilot_id: pilot.id, error: error instanceof Error ? error.message : String(error) }); }
  }

  const { data: pending } = await db.from('brand_guard_pilots').select('*')
    .eq('status', 'expired').is('notification_sent_at', null).limit(100);
  let notified = 0;
  for (const pilot of (pending || []) as BrandGuardPilot[]) {
    try {
      const { data: userData } = await db.auth.admin.getUserById(pilot.owner_id);
      const email = userData.user?.email;
      if (!email || !(await sendEndedEmail(email, pilot.ends_at))) continue;
      await db.from('brand_guard_pilots').update({ notification_sent_at: new Date().toISOString() }).eq('id', pilot.id);
      notified++;
    } catch (error) {
      errors.push({ pilot_id: pilot.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  res.status(errors.length ? 207 : 200).json({ expired: due?.length || 0, notified, errors });
}
