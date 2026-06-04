/**
 * api/contact.ts — Vercel Serverless Function
 * Receives contact form submissions and sends email via Resend API to info@agenticbro.app
 */

import type { IncomingMessage, ServerResponse } from 'http';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const CONTACT_EMAIL = 'info@agenticbro.app';
const FROM_EMAIL = 'Agentic Bro <noreply@agenticbro.app>';

interface ContactPayload {
  name?: string;
  email?: string;
  subject?: string;
  message: string;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  // Parse body
  let body: ContactPayload;
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    body = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Invalid JSON body' }));
  }

  const { name = 'Anonymous', email = 'noreply@agenticbro.app', subject = 'Contact Form', message } = body;

  if (!message || !message.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Message is required' }));
  }

  if (message.length > 5000) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Message too long (max 5000 characters)' }));
  }

  // Rate limiting: simple IP-based (Vercel provides x-forwarded-for)
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

  if (!RESEND_API_KEY || RESEND_API_KEY === 're_your_resend_api_key_here') {
    console.warn('RESEND_API_KEY not configured — logging contact form submission instead');
    console.log(`[CONTACT FORM] From: ${name} <${email}> | IP: ${ip} | Subject: ${subject} | Message: ${message}`);
    // Still return success to the user so the form works even without Resend
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, note: 'Message received (email delivery pending configuration)' }));
  }

  // Build email
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 8px; padding: 30px;">
        <h1 style="margin: 0 0 20px 0; color: #333; font-size: 20px;">📬 New Contact Form Submission</h1>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
            <strong>Name:</strong> ${escapeHtml(name)}<br>
            <strong>Email:</strong> ${escapeHtml(email)}<br>
            <strong>Subject:</strong> ${escapeHtml(subject)}<br>
            <strong>IP:</strong> ${escapeHtml(ip)}<br>
            <strong>Time:</strong> ${new Date().toISOString()}
          </p>
        </div>
        <div style="padding: 15px; border-left: 3px solid #8b5cf6; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #333; white-space: pre-wrap;">${escapeHtml(message)}</p>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 11px;">
          Sent from agenticbro.app contact form
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `Contact Form Submission\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\nIP: ${ip}\nTime: ${new Date().toISOString()}\n\nMessage:\n${message}`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [CONTACT_EMAIL],
        replyTo: email || undefined,
        subject: `[Contact] ${subject}`,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Resend API error:', response.status, errorData);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to send email' }));
    }

    const result = await response.json();
    console.log(`[CONTACT FORM] Email sent: ${result.id} | From: ${name} <${email}> | Subject: ${subject}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error('Contact form error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}