#!/usr/bin/env npx ts-node
/**
 * Local Admin Dashboard Server
 * 
 * Serves the Guardian Reply Bot admin dashboard locally,
 * reading from the local reply_queue directory.
 * 
 * Usage: npx ts-node scripts/local-admin-server.ts
 * 
 * Dashboard: http://localhost:3002/admin
 * API: http://localhost:3002/api/guardian/pending
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3002;
const QUEUE_DIR = path.join(process.env.HOME || '/Users/efinney', '.openclaw/workspace/output/reply_queue');
const SENT_DIR = path.join(process.env.HOME || '/Users/efinney', '.openclaw/workspace/output/replies_sent');

interface DraftReply {
  id: string;
  username: string;
  reply_text: string;
  reply_type?: string;
  risk_level: string;
  risk_score: number;
  red_flags: string[];
  report_url: string;
  created_at: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'sent';
  target?: string;
  approved_at?: string;
  rejected_at?: string;
}

async function readJsonFile(filepath: string): Promise<DraftReply | null> {
  try {
    const data = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function writeJsonFile(filepath: string, data: DraftReply): Promise<void> {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

async function listPendingDrafts(): Promise<DraftReply[]> {
  const drafts: DraftReply[] = [];
  
  try {
    const files = fs.readdirSync(QUEUE_DIR);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const draft = await readJsonFile(path.join(QUEUE_DIR, file));
        if (draft && draft.status === 'pending_approval') {
          drafts.push(draft);
        }
      }
    }
  } catch (e) {
    console.error('Error reading queue directory:', e);
  }
  
  return drafts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function generateDashboardHtml(drafts: DraftReply[]): string {
  const criticalCount = drafts.filter(d => d.risk_score >= 9).length;
  const highCount = drafts.filter(d => d.risk_score >= 7 && d.risk_score < 9).length;
  const pendingCount = drafts.filter(d => d.status === 'pending_approval').length;
  
  const draftsHtml = drafts.length === 0 
    ? `<div class="empty-state">
        <i class="fas fa-check-circle"></i>
        <h3>No Pending Approvals</h3>
        <p>All caught up! High-risk scan results will appear here for review.</p>
        <p style="margin-top: 16px; opacity: 0.7;">
          Run <code style="background: #333; padding: 4px 8px; border-radius: 4px;">python3 scripts/scam-automation-loop.py</code> to scan for new profiles.
        </p>
      </div>`
    : drafts.map(draft => {
      const levelClass = draft.risk_score >= 9 ? 'critical' : draft.risk_score >= 7 ? 'high' : draft.risk_score >= 5 ? 'warning' : 'info';
      const redFlagsHtml = (draft.red_flags || []).map(f => 
        `<span class="red-flag"><i class="fas fa-exclamation-circle"></i> ${f}</span>`
      ).join('');
      
      return `
        <div class="pending-card ${levelClass}" data-type="${draft.reply_type || 'SCAM_ALERT'}">
          <div class="card-header">
            <div class="user-info">
              <div class="avatar"><i class="fas fa-user"></i></div>
              <div>
                <div class="user-name">@${draft.username}</div>
                <div style="opacity: 0.6; font-size: 13px;">${new Date(draft.created_at).toLocaleString()}</div>
              </div>
            </div>
            <div class="type-badge ${levelClass}">${draft.reply_type || 'SCAM ALERT'} - ${draft.risk_score.toFixed(1)}/10</div>
          </div>
          
          <div class="meta-info">
            <span class="meta-item"><i class="fas fa-shield-alt"></i> Risk: ${draft.risk_level}</span>
            ${draft.target ? `<span class="meta-item"><i class="fas fa-user"></i> Target: @${draft.target}</span>` : ''}
            <span class="meta-item"><i class="fas fa-clock"></i> ${new Date(draft.created_at).toLocaleString()}</span>
          </div>
          
          ${redFlagsHtml ? `<div class="red-flags">${redFlagsHtml}</div>` : ''}
          
          <div class="tweet-preview">${draft.reply_text}</div>
          
          <div class="actions">
            <button class="btn btn-approve" onclick="approve('${draft.id}')">
              <i class="fas fa-check"></i> Approve & Send
            </button>
            <button class="btn btn-edit" onclick="editDraft('${draft.id}')">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-copy" onclick="copyText('${draft.id}')">
              <i class="fas fa-copy"></i> Copy
            </button>
            <button class="btn btn-reject" onclick="reject('${draft.id}')">
              <i class="fas fa-times"></i> Reject
            </button>
            <a href="${draft.report_url}" target="_blank" style="color: #667eea; text-decoration: none; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-external-link-alt"></i> View Full Report
            </a>
          </div>
        </div>`;
    }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guardian Reply Bot - Local Admin Dashboard</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%);
            color: #fff;
            min-height: 100vh;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 16px;
            margin-bottom: 24px;
        }
        .header h1 { font-size: 28px; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; }
        .header p { opacity: 0.9; font-size: 16px; }
        .local-badge {
            background: rgba(255,255,255,0.2);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            margin-left: 12px;
        }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .stat-card {
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
        }
        .stat-value { font-size: 36px; font-weight: bold; margin-bottom: 4px; }
        .stat-label { opacity: 0.7; font-size: 14px; }
        .critical { color: #ff4444; }
        .high { color: #ff8800; }
        .warning { color: #ffcc00; }
        .info { color: #667eea; }
        
        .tabs { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .tab { 
            padding: 12px 24px;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .tab:hover { background: #2a2a3e; }
        .tab.active { background: #667eea; border-color: #667eea; }
        
        .pending-list { display: flex; flex-direction: column; gap: 20px; }
        .pending-card {
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 16px;
            padding: 24px;
        }
        .pending-card.critical { border-left: 4px solid #ff4444; }
        .pending-card.high { border-left: 4px solid #ff8800; }
        .pending-card.warning { border-left: 4px solid #ffcc00; }
        .pending-card.info { border-left: 4px solid #667eea; }
        
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
        .user-info { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 48px; height: 48px; background: #333; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; }
        .user-name { font-size: 18px; font-weight: bold; }
        .type-badge {
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        .type-badge.critical { background: #ff4444; }
        .type-badge.high { background: #ff8800; }
        .type-badge.warning { background: #ffcc00; color: #000; }
        .type-badge.info { background: #667eea; }
        
        .tweet-preview {
            background: #0a0a0a;
            border: 1px solid #333;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
            white-space: pre-wrap;
            font-size: 15px;
            line-height: 1.6;
        }
        
        .meta-info { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
        .meta-item { display: flex; align-items: center; gap: 8px; opacity: 0.8; font-size: 14px; }
        
        .red-flags { margin-bottom: 16px; }
        .red-flag { 
            display: inline-block;
            background: #2a2a3e;
            padding: 6px 12px;
            border-radius: 6px;
            margin: 4px 4px 4px 0;
            font-size: 13px;
        }
        
        .actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .btn {
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .btn-approve {
            background: linear-gradient(135deg, #00c853 0%, #00e676 100%);
            color: #fff;
        }
        .btn-approve:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,200,83,0.4); }
        .btn-reject {
            background: linear-gradient(135deg, #ff4444 0%, #ff6666 100%);
            color: #fff;
        }
        .btn-edit {
            background: #333;
            color: #fff;
        }
        .btn-copy {
            background: #667eea;
            color: #fff;
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            opacity: 0.6;
        }
        .empty-state i { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
        
        .footer {
            margin-top: 40px;
            padding: 20px;
            text-align: center;
            opacity: 0.6;
            font-size: 14px;
        }
        
        @media (max-width: 768px) {
            .stats { grid-template-columns: repeat(2, 1fr); }
            .card-header { flex-direction: column; align-items: flex-start; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-shield-alt"></i> Guardian Reply Bot <span class="local-badge">LOCAL</span></h1>
            <p>Human-in-the-Loop (HITL) Dashboard - Reading from local reply_queue</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value critical">${criticalCount}</div>
                <div class="stat-label"><i class="fas fa-exclamation-triangle"></i> Critical Alerts</div>
            </div>
            <div class="stat-card">
                <div class="stat-value high">${highCount}</div>
                <div class="stat-label"><i class="fas fa-shield-alt"></i> High Risk</div>
            </div>
            <div class="stat-card">
                <div class="stat-value warning">${pendingCount}</div>
                <div class="stat-label"><i class="fas fa-clock"></i> Pending Approval</div>
            </div>
            <div class="stat-card">
                <div class="stat-value info">${drafts.length}</div>
                <div class="stat-label"><i class="fas fa-list"></i> Total Drafts</div>
            </div>
        </div>
        
        <div class="tabs" id="tabs">
            <div class="tab active" onclick="filterCards('all')">All (${drafts.length})</div>
            <div class="tab" onclick="filterCards('SCAM_ALERT')">Scam Alerts</div>
            <div class="tab" onclick="filterCards('USER_INQUIRY')">User Inquiries</div>
            <div class="tab" onclick="filterCards('TARGETED_WARNING')">Targeted Warnings</div>
            <div class="tab" onclick="filterCards('PROTECTION_OFFER')">Protection Offers</div>
        </div>
        
        <div class="pending-list" id="pending-list">
            ${draftsHtml}
        </div>
        
        <div class="footer">
            <p>Guardian Reply Bot v1.0 | Local Admin Dashboard | <code>${QUEUE_DIR}</code></p>
        </div>
    </div>
    
    <script>
        let allDrafts = ${JSON.stringify(drafts)};
        let currentFilter = 'all';
        
        function filterCards(type) {
            currentFilter = type;
            const tabs = document.querySelectorAll('.tab');
            tabs.forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            
            const cards = document.querySelectorAll('.pending-card');
            cards.forEach(card => {
                if (type === 'all' || card.dataset.type === type) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }
        
        async function approve(id) {
            if (!confirm('Approve and send this reply?')) return;
            
            try {
                const res = await fetch('/api/guardian/approve?id=' + id, { method: 'POST' });
                const data = await res.json();
                
                if (data.success) {
                    alert('✓ Reply approved! It will be sent.');
                    location.reload();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (e) {
                alert('Error: ' + e.message);
            }
        }
        
        async function reject(id) {
            if (!confirm('Reject this reply?')) return;
            
            try {
                const res = await fetch('/api/guardian/reject?id=' + id, { method: 'POST' });
                const data = await res.json();
                
                if (data.success) {
                    alert('Reply rejected.');
                    location.reload();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (e) {
                alert('Error: ' + e.message);
            }
        }
        
        function copyText(id) {
            const draft = allDrafts.find(d => d.id === id);
            if (draft) {
                navigator.clipboard.writeText(draft.reply_text);
                alert('Copied to clipboard!');
            }
        }
        
        function editDraft(id) {
            const draft = allDrafts.find(d => d.id === id);
            if (draft) {
                const newText = prompt('Edit the reply text:', draft.reply_text);
                if (newText && newText !== draft.reply_text) {
                    // Send edit to API
                    fetch('/api/guardian/edit?id=' + id, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: newText })
                    }).then(() => {
                        alert('Edit saved!');
                        location.reload();
                    }).catch(e => {
                        alert('Error: ' + e.message);
                    });
                }
            }
        }
    </script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
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
    // GET /api/guardian/pending
    if (method === 'GET' && url.includes('/api/guardian/pending')) {
      const drafts = await listPendingDrafts();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ drafts }));
      return;
    }
    
    // GET /admin - Dashboard HTML
    if (method === 'GET' && (url === '/admin' || url === '/admin/' || url === '/')) {
      const drafts = await listPendingDrafts();
      const html = generateDashboardHtml(drafts);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }
    
    // POST /api/guardian/approve
    if (method === 'POST' && url.includes('/api/guardian/approve')) {
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
      
      // Update status
      draft.status = 'approved';
      draft.approved_at = new Date().toISOString();
      await writeJsonFile(draftPath, draft);
      
      // Move to sent directory
      const sentPath = path.join(SENT_DIR, `${id}.json`);
      fs.copyFileSync(draftPath, sentPath);
      fs.unlinkSync(draftPath);
      
      console.log(`✓ Approved: @${draft.username} (${id})`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Reply approved and queued for sending' }));
      return;
    }
    
    // POST /api/guardian/reject
    if (method === 'POST' && url.includes('/api/guardian/reject')) {
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
      
      // Update status
      draft.status = 'rejected';
      draft.rejected_at = new Date().toISOString();
      await writeJsonFile(draftPath, draft);
      
      // Delete from queue
      fs.unlinkSync(draftPath);
      
      console.log(`✗ Rejected: @${draft.username} (${id})`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }
    
    // POST /api/guardian/edit
    if (method === 'POST' && url.includes('/api/guardian/edit')) {
      const urlObj = new URL(url, 'http://localhost');
      const id = urlObj.searchParams.get('id');
      
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing id parameter' }));
        return;
      }
      
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { text } = JSON.parse(body);
          
          const draftPath = path.join(QUEUE_DIR, `${id}.json`);
          const draft = await readJsonFile(draftPath);
          
          if (!draft) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Draft not found' }));
            return;
          }
          
          draft.reply_text = text;
          await writeJsonFile(draftPath, draft);
          
          console.log(`✎ Edited: @${draft.username} (${id})`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }
    
    // Default: API info
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Guardian Reply Bot API (Local)',
      queue_dir: QUEUE_DIR,
      endpoints: {
        'GET /admin': 'Admin dashboard HTML',
        'GET /api/guardian/pending': 'List pending drafts',
        'POST /api/guardian/approve?id=<id>': 'Approve a draft',
        'POST /api/guardian/reject?id=<id>': 'Reject a draft',
        'POST /api/guardian/edit?id=<id>': 'Edit draft text'
      }
    }));
    
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(error) }));
  }
});

// Ensure sent directory exists
if (!fs.existsSync(SENT_DIR)) {
  fs.mkdirSync(SENT_DIR, { recursive: true });
}

server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🛡️  Guardian Reply Bot - Local Admin Dashboard        ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Dashboard:  http://localhost:${PORT}/admin                 ║`);
  console.log(`║  API:        http://localhost:${PORT}/api/guardian/pending   ║`);
  console.log(`║  Queue Dir:  ${QUEUE_DIR.substring(0, 35)}...  ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  Press Ctrl+C to stop the server                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
});