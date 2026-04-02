import type { IncomingMessage, ServerResponse } from 'http';

const QUEUE_DIR = '/Users/efinney/.openclaw/workspace/output/reply_queue';
const SENT_DIR = '/Users/efinney/.openclaw/workspace/output/replies_sent';

interface DraftReply {
  id: string;
  username: string;
  reply_text: string;
  risk_level: string;
  risk_score: number;
  red_flags: string[];
  report_url: string;
  created_at: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'sent';
}

async function readJsonFile(path: string): Promise<DraftReply | null> {
  try {
    const fs = await import('fs');
    const data = fs.readFileSync(path, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function writeJsonFile(path: string, data: DraftReply): Promise<void> {
  const fs = await import('fs');
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

async function listPendingDrafts(): Promise<DraftReply[]> {
  const fs = await import('fs');
  const path = await import('path');
  
  const drafts: DraftReply[] = [];
  const files = fs.readdirSync(QUEUE_DIR);
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const draft = await readJsonFile(path.join(QUEUE_DIR, file));
      if (draft && draft.status === 'pending_approval') {
        drafts.push(draft);
      }
    }
  }
  
  return drafts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '/';
  const method = req.method || 'GET';
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  try {
    // GET /api/guardian/pending - List pending drafts
    if (method === 'GET' && url.includes('/pending')) {
      const drafts = await listPendingDrafts();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ drafts }));
      return;
    }
    
    // GET /api/guardian/dashboard - Dashboard HTML
    if (method === 'GET' && url.includes('/dashboard')) {
      const drafts = await listPendingDrafts();
      
      const criticalCount = drafts.filter(d => d.risk_level === 'CRITICAL').length;
      const highCount = drafts.filter(d => d.risk_level === 'HIGH').length;
      
      let pendingHtml = '';
      if (drafts.length === 0) {
        pendingHtml = `
          <div class="empty-state">
            <h3>No Pending Approvals</h3>
            <p>High-risk scan results will appear here for review.</p>
          </div>`;
      } else {
        for (const draft of drafts) {
          const levelClass = draft.risk_level.toLowerCase();
          const redFlagsHtml = draft.red_flags.map(f => `<span class="red-flag">${f}</span>`).join('');
          
          pendingHtml += `
            <div class="pending-card ${levelClass}">
              <div class="pending-header">
                <div class="username">@${draft.username}</div>
                <div class="risk-badge ${levelClass}">${draft.risk_level} - ${draft.risk_score.toFixed(1)}/10</div>
              </div>
              <div class="red-flags">${redFlagsHtml}</div>
              <div class="tweet-preview">${draft.reply_text}</div>
              <div class="actions">
                <button class="btn btn-approve" onclick="approve('${draft.id}')">✓ Approve & Send</button>
                <button class="btn btn-edit" onclick="editDraft('${draft.id}')">Edit</button>
                <button class="btn btn-reject" onclick="reject('${draft.id}')">✕ Reject</button>
                <a href="${draft.report_url}" class="report-link" target="_blank">View Full Report →</a>
              </div>
            </div>`;
        }
      }
      
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Guardian Reply Bot - Admin Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .header p { opacity: 0.8; }
    .stats { display: flex; gap: 20px; margin-bottom: 20px; }
    .stat-card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 20px; flex: 1; }
    .stat-value { font-size: 32px; font-weight: bold; margin-bottom: 4px; }
    .stat-label { opacity: 0.6; }
    .critical { color: #ff4444; }
    .high { color: #ff8800; }
    .pending-list { display: flex; flex-direction: column; gap: 20px; }
    .pending-card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 20px; }
    .pending-card.critical { border-left: 4px solid #ff4444; }
    .pending-card.high { border-left: 4px solid #ff8800; }
    .pending-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .username { font-size: 18px; font-weight: bold; }
    .risk-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .risk-badge.critical { background: #ff4444; }
    .risk-badge.high { background: #ff8800; }
    .tweet-preview { background: #0a0a0a; border: 1px solid #333; border-radius: 8px; padding: 16px; margin-bottom: 16px; white-space: pre-wrap; font-size: 14px; line-height: 1.5; }
    .red-flags { margin-bottom: 16px; }
    .red-flag { display: inline-block; background: #2a2a2a; padding: 4px 8px; border-radius: 4px; margin: 4px 4px 4px 0; font-size: 12px; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn { padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; border: none; transition: all 0.2s; }
    .btn-approve { background: #00c853; color: #fff; }
    .btn-approve:hover { background: #00e676; }
    .btn-reject { background: #ff4444; color: #fff; }
    .btn-reject:hover { background: #ff6666; }
    .btn-edit { background: #333; color: #fff; }
    .btn-edit:hover { background: #444; }
    .empty-state { text-align: center; padding: 60px 20px; opacity: 0.6; }
    .report-link { color: #667eea; text-decoration: none; }
    .report-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ Guardian Reply Bot</h1>
      <p>Human-in-the-Loop (HITL) Dashboard for Scam Warnings</p>
    </div>
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value critical">${criticalCount}</div>
        <div class="stat-label">Critical Risk</div>
      </div>
      <div class="stat-card">
        <div class="stat-value high">${highCount}</div>
        <div class="stat-label">High Risk</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${drafts.length}</div>
        <div class="stat-label">Pending Approval</div>
      </div>
    </div>
    <div class="pending-list">${pendingHtml}</div>
  </div>
  <script>
    async function approve(id) {
      if (!confirm('Approve and send this tweet?')) return;
      try {
        const res = await fetch('/api/guardian/approve?id=' + id, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          alert('Tweet approved! It will be sent shortly.');
          location.reload();
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }
    async function reject(id) {
      if (!confirm('Reject this draft?')) return;
      try {
        const res = await fetch('/api/guardian/reject?id=' + id, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          alert('Draft rejected.');
          location.reload();
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }
    function editDraft(id) {
      alert('Edit functionality coming soon!');
    }
  </script>
</body>
</html>`;
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }
    
    // POST /api/guardian/approve - Approve a draft
    if (method === 'POST' && url.includes('/approve')) {
      const fs = await import('fs');
      const path = await import('path');
      
      const urlObj = new URL(url, 'http://localhost');
      const id = urlObj.searchParams.get('id');
      
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing id parameter' }));
        return;
      }
      
      const draftPath = path.join(QUEUE_DIR, `${id}.json`);
      const draft = await readJsonFile(draftPath);
      
      if (!draft) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Draft not found' }));
        return;
      }
      
      // Mark as approved
      draft.status = 'approved';
      draft.approved_at = new Date().toISOString();
      await writeJsonFile(draftPath, draft);
      
      // In production, this would trigger the tweet send
      // For now, just mark as approved
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, draft }));
      return;
    }
    
    // POST /api/guardian/reject - Reject a draft
    if (method === 'POST' && url.includes('/reject')) {
      const fs = await import('fs');
      const path = await import('path');
      
      const urlObj = new URL(url, 'http://localhost');
      const id = urlObj.searchParams.get('id');
      
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing id parameter' }));
        return;
      }
      
      const draftPath = path.join(QUEUE_DIR, `${id}.json`);
      const draft = await readJsonFile(draftPath);
      
      if (!draft) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Draft not found' }));
        return;
      }
      
      // Mark as rejected
      draft.status = 'rejected';
      draft.rejected_at = new Date().toISOString();
      await writeJsonFile(draftPath, draft);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }
    
    // Default: show API info
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Guardian Reply Bot API',
      endpoints: {
        'GET /api/guardian/pending': 'List pending drafts',
        'GET /api/guardian/dashboard': 'Admin dashboard HTML',
        'POST /api/guardian/approve?id=<id>': 'Approve a draft',
        'POST /api/guardian/reject?id=<id>': 'Reject a draft'
      }
    }));
    
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(error) }));
  }
}