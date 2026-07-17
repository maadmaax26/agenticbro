/**
 * ContactUs.tsx — Contact form that sends email to info@agenticbro.app via Resend API
 */

import { useState } from 'react';

export function ContactUs() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) { setError('Please enter a message.'); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Anonymous',
          email: email.trim() || 'noreply@agenticbro.app',
          subject: subject.trim() || 'Contact Form',
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');
      setSent(true);
      setName(''); setEmail(''); setSubject(''); setMessage('');
      setTimeout(() => { setSent(false); setOpen(false); }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); setOpen(true); }}
        style={{ color: '#8b5cf6', textDecoration: 'none', cursor: 'pointer' }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#a78bfa'; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#8b5cf6'; }}
      >
        Contact Us
      </a>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)', padding: '16px',
          }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              maxWidth: '480px', width: '100%',
              background: '#1a1a2e', borderRadius: '16px',
              padding: '28px', border: '1px solid rgba(139,92,246,0.3)',
              boxShadow: '0 20px 60px rgba(0,0,0,.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>
                📬 Contact Us
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            {sent && (
              <div style={{
                padding: '14px', borderRadius: '8px', marginBottom: '16px',
                background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.3)', textAlign: 'center', fontSize: '14px',
              }}>
                ✅ Message sent! We'll get back to you soon.
              </div>
            )}

            {error && (
              <div style={{
                padding: '10px', borderRadius: '8px', marginBottom: '12px',
                background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.3)', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,92,246,0.2)',
                  color: '#fff', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#8b5cf6'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)'}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,92,246,0.2)',
                  color: '#fff', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#8b5cf6'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)'}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,92,246,0.2)',
                  color: '#fff', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="" style={{ background: '#1a1a2e' }}>Select a topic...</option>
                <option value="General Inquiry" style={{ background: '#1a1a2e' }}>General Inquiry</option>
                <option value="Bug Report" style={{ background: '#1a1a2e' }}>Bug Report</option>
                <option value="Feature Request" style={{ background: '#1a1a2e' }}>Feature Request</option>
                <option value="Brand Guard Support" style={{ background: '#1a1a2e' }}>Brand Guard Support</option>
                <option value="Scan Issue" style={{ background: '#1a1a2e' }}>Scan Issue</option>
                <option value="Partnership" style={{ background: '#1a1a2e' }}>Partnership</option>
                <option value="Other" style={{ background: '#1a1a2e' }}>Other</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>Message *</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help?"
                rows={4}
                required
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,92,246,0.2)',
                  color: '#fff', fontSize: '14px', outline: 'none', resize: 'vertical',
                  minHeight: '80px', boxSizing: 'border-box',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#8b5cf6'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(139,92,46,0.2)'}
              />
            </div>

            <button
              type="submit"
              disabled={sending || !message.trim()}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                fontSize: '15px', fontWeight: 600, cursor: sending ? 'wait' : 'pointer',
                background: sending || !message.trim()
                  ? 'rgba(139,92,246,0.3)'
                  : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                color: '#fff',
              }}
            >
              {sending ? 'Sending...' : 'Send Message'}
            </button>

            <p style={{ fontSize: '11px', color: '#64748b', marginTop: '12px', textAlign: 'center' }}>
              Your message will be sent to info@agenticbro.app
            </p>
          </form>
        </div>
      )}
    </>
  );
}