#!/usr/bin/env python3
"""
Guardian Reply Bot - Human-in-the-Loop (HITL) Dashboard & Post Creation
=========================================================================
Generates helpful replies for:
1. Users asking "is this a scam?" → Direct them to agenticbro.app
2. Users asking about @handle → Provide pre-scan results
3. Users being targeted by scammers → Warn them with scan results

Workflow:
1. High-risk scan (>70/100) → Draft warning reply
2. User inquiry detected → Draft helpful response
3. Admin reviews on /admin dashboard
4. Admin clicks "Approve" to send
"""

import json
import re
import os
import time
import hashlib
import urllib.request
import websocket
from datetime import datetime
from pathlib import Path

# Configuration
QUEUE_DIR = Path('/Users/efinney/.openclaw/workspace/output/reply_queue')
SENT_DIR = Path('/Users/efinney/.openclaw/workspace/output/replies_sent')
RISK_THRESHOLD = 7.0  # Out of 10 (70/100 equivalent)

# Template types
REPLY_TEMPLATES = {
    # SCAM ALERT - For confirmed high-risk accounts
    'SCAM_ALERT': (
        "⚠️ SCAM ALERT: @{username} has been flagged as HIGH RISK ({score}/10).\n\n"
        "Red flags: {red_flags}\n\n"
        "Our AI detected suspicious patterns. Protect yourself:\n"
        "→ Scan before you invest: agenticbro.app\n"
        "→ Full report: {report_url}\n\n"
        "#CryptoSafety #ScamAlert"
    ),
    
    # USER INQUIRY - For users asking "is this a scam?"
    'USER_INQUIRY': (
        "🛡️ AgenticBro Scan Results for @{username}:\n\n"
        "Risk Level: {level} ({score}/10)\n"
        "Red Flags: {red_flags}\n\n"
        "{safety_message}\n\n"
        "Scan any account yourself: agenticbro.app\n"
        "Full analysis: {report_url}\n\n"
        "#CryptoSafety"
    ),
    
    # HELPFUL RESPONSE - For users asking about specific handles
    'HELPFUL_RESPONSE': (
        "📊 Quick scan for @{username}:\n\n"
        "Risk Score: {score}/10\n"
        "Status: {level}\n"
        "Concerns: {red_flags}\n\n"
        "{'✅ Looks legitimate based on available data.' if score < 3 else '⚠️ Some red flags detected - proceed with caution.' if score < 7 else '🚨 Multiple warning signs - avoid engaging.'}\n\n"
        "Get a full deep-dive scan at agenticbro.app\n\n"
        "#StaySafe"
    ),
    
    # PROTECTION OFFER - Offering pre-scan to protect users
    'PROTECTION_OFFER': (
        "🛡️ Protect yourself from scams!\n\n"
        "I noticed you asked about {topic}. Here's a free scan:\n\n"
        "→ Go to agenticbro.app\n"
        "→ Enter any handle or wallet\n"
        "→ Get instant risk assessment\n\n"
        "Our AI analyzes 10+ red flags including:\n"
        "• DM solicitation patterns\n"
        "• Unrealistic return claims\n"
        "• Account age & verification\n"
        "• Follower authenticity\n\n"
        "Stay safe out there! 💪\n\n"
        "#CryptoSafety #ScamPrevention"
    ),
    
    # TARGETED WARNING - Warning specific users about scammers
    'TARGETED_WARNING': (
        "⚠️ @{target_user} - Heads up!\n\n"
        "@{scammer_handle} has been flagged as {level} ({score}/10 risk).\n\n"
        "Red flags: {red_flags}\n\n"
        "Recommendation: Avoid engaging with this account.\n\n"
        "Protect yourself with AgenticBro:\n"
        "→ agenticbro.app\n\n"
        "Stay safe! 🛡️\n\n"
        "#CryptoSafety"
    ),
}


class GuardianReplyBot:
    def __init__(self):
        self.queue_dir = QUEUE_DIR
        self.sent_dir = SENT_DIR
        self.queue_dir.mkdir(parents=True, exist_ok=True)
        self.sent_dir.mkdir(parents=True, exist_ok=True)
        
    def generate_reply(self, scan_result, reply_type='SCAM_ALERT', target_user=None, topic=None):
        """Generate a reply based on scan results"""
        username = scan_result.get('username', 'unknown')
        score = scan_result.get('risk_score', 0)
        level = scan_result.get('level', 'UNKNOWN')
        red_flags = scan_result.get('red_flags', [])
        
        # Select template based on type
        template = REPLY_TEMPLATES.get(reply_type, REPLY_TEMPLATES['SCAM_ALERT'])
        
        # Generate report URL
        report_id = hashlib.md5(f"{username}_{datetime.now().isoformat()}".encode()).hexdigest()[:8]
        report_url = f"https://agenticbro.app/scan/{username}"
        
        # Format red flags
        red_flags_str = ', '.join(red_flags[:3]) if red_flags else 'None detected'
        
        # Generate safety message based on risk score
        if score < 3:
            safety_message = "✅ This account appears safe to engage with."
        elif score < 7:
            safety_message = "⚠️ Exercise caution - some concerns detected."
        else:
            safety_message = "🚨 HIGH RISK - We recommend avoiding this account."
        
        # Generate reply
        if reply_type == 'TARGETED_WARNING' and target_user:
            reply = template.format(
                target_user=target_user,
                scammer_handle=username,
                level=level,
                score=f"{score:.1f}",
                red_flags=red_flags_str,
                report_url=report_url
            )
        elif reply_type == 'PROTECTION_OFFER' and topic:
            reply = template.format(topic=topic)
        elif reply_type == 'USER_INQUIRY':
            reply = template.format(
                username=username,
                level=level,
                score=f"{score:.1f}",
                red_flags=red_flags_str,
                safety_message=safety_message,
                report_url=report_url
            )
        else:
            reply = template.format(
                username=username,
                score=f"{score:.1f}",
                level=level,
                red_flags=red_flags_str,
                report_url=report_url
            )
        
        return {
            'id': report_id,
            'reply_type': reply_type,
            'username': username,
            'reply_text': reply,
            'risk_level': level,
            'risk_score': score,
            'red_flags': red_flags,
            'report_url': report_url,
            'target_user': target_user,
            'topic': topic,
            'created_at': datetime.now().isoformat(),
            'status': 'pending_approval'
        }
    
    def generate_user_inquiry_response(self, username, scan_result=None):
        """Generate response for users asking about a specific handle"""
        if scan_result:
            return self.generate_reply(scan_result, reply_type='USER_INQUIRY')
        else:
            # Generic response without scan data
            return {
                'id': hashlib.md5(f"{username}_{datetime.now().isoformat()}".encode()).hexdigest()[:8],
                'reply_type': 'USER_INQUIRY',
                'username': username,
                'reply_text': f"🔍 I'll scan @{username} for you. Check back at agenticbro.app/scan/{username} for full results.\n\nIn the meantime, always DYOR and never share your seed phrase!\n\n#CryptoSafety",
                'risk_level': 'UNKNOWN',
                'risk_score': 0,
                'red_flags': [],
                'report_url': f"https://agenticbro.app/scan/{username}",
                'created_at': datetime.now().isoformat(),
                'status': 'pending_approval'
            }
    
    def generate_protection_offer(self, topic="crypto safety"):
        """Generate a response offering AgenticBro protection"""
        return self.generate_reply(
            {'username': 'protect', 'risk_score': 0, 'level': 'INFO', 'red_flags': []},
            reply_type='PROTECTION_OFFER',
            topic=topic
        )
    
    def generate_targeted_warning(self, target_user, scammer_handle, scan_result):
        """Generate a warning for a specific user about a scammer"""
        return self.generate_reply(
            scan_result,
            reply_type='TARGETED_WARNING',
            target_user=target_user
        )
    
    def add_to_queue(self, draft):
        """Add draft to approval queue"""
        draft_file = self.queue_dir / f"{draft['id']}.json"
        with open(draft_file, 'w') as f:
            json.dump(draft, f, indent=2)
        return draft['id']
    
    def get_pending_approvals(self):
        """Get all pending drafts"""
        pending = []
        for draft_file in sorted(self.queue_dir.glob('*.json')):
            try:
                with open(draft_file, 'r') as f:
                    draft = json.load(f)
                if draft['status'] == 'pending_approval':
                    pending.append(draft)
            except:
                continue
        return pending
    
    def approve_reply(self, draft_id):
        """Mark reply as approved"""
        draft_file = self.queue_dir / f"{draft_id}.json"
        if not draft_file.exists():
            return False, "Draft not found"
        
        with open(draft_file, 'r') as f:
            draft = json.load(f)
        
        draft['status'] = 'approved'
        draft['approved_at'] = datetime.now().isoformat()
        
        with open(draft_file, 'w') as f:
            json.dump(draft, f, indent=2)
        
        return True, draft
    
    def reject_reply(self, draft_id, reason=""):
        """Mark reply as rejected"""
        draft_file = self.queue_dir / f"{draft_id}.json"
        if not draft_file.exists():
            return False, "Draft not found"
        
        with open(draft_file, 'r') as f:
            draft = json.load(f)
        
        draft['status'] = 'rejected'
        draft['rejected_at'] = datetime.now().isoformat()
        draft['rejection_reason'] = reason
        
        with open(draft_file, 'w') as f:
            json.dump(draft, f, indent=2)
        
        return True, draft
    
    def mark_sent(self, draft_id):
        """Mark reply as sent"""
        draft_file = self.queue_dir / f"{draft_id}.json"
        if not draft_file.exists():
            return False, "Draft not found"
        
        with open(draft_file, 'r') as f:
            draft = json.load(f)
        
        draft['status'] = 'sent'
        draft['sent_at'] = datetime.now().isoformat()
        
        # Move to sent folder
        sent_file = self.sent_dir / f"{draft_id}.json"
        with open(sent_file, 'w') as f:
            json.dump(draft, f, indent=2)
        
        # Remove from queue
        draft_file.unlink()
        
        return True, draft
    
    def generate_dashboard_html(self):
        """Generate the admin dashboard HTML"""
        pending = self.get_pending_approvals()
        
        # Count by type
        scam_alerts = [d for d in pending if d.get('reply_type') == 'SCAM_ALERT']
        user_inquiries = [d for d in pending if d.get('reply_type') == 'USER_INQUIRY']
        targeted_warnings = [d for d in pending if d.get('reply_type') == 'TARGETED_WARNING']
        protection_offers = [d for d in pending if d.get('reply_type') == 'PROTECTION_OFFER']
        
        html = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guardian Reply Bot - Admin Dashboard</title>
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
            <h1><i class="fas fa-shield-alt"></i> Guardian Reply Bot</h1>
            <p>Human-in-the-Loop (HITL) Dashboard for Scam Prevention</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value critical">''' + str(len(scam_alerts)) + '''</div>
                <div class="stat-label"><i class="fas fa-exclamation-triangle"></i> Scam Alerts</div>
            </div>
            <div class="stat-card">
                <div class="stat-value warning">''' + str(len(user_inquiries)) + '''</div>
                <div class="stat-label"><i class="fas fa-question-circle"></i> User Inquiries</div>
            </div>
            <div class="stat-card">
                <div class="stat-value high">''' + str(len(targeted_warnings)) + '''</div>
                <div class="stat-label"><i class="fas fa-user-shield"></i> Targeted Warnings</div>
            </div>
            <div class="stat-card">
                <div class="stat-value info">''' + str(len(protection_offers)) + '''</div>
                <div class="stat-label"><i class="fas fa-hands-helping"></i> Protection Offers</div>
            </div>
        </div>
        
        <div class="tabs">
            <div class="tab active" onclick="filterCards('all')">All (''' + str(len(pending)) + ''')</div>
            <div class="tab" onclick="filterCards('SCAM_ALERT')">Scam Alerts</div>
            <div class="tab" onclick="filterCards('USER_INQUIRY')">User Inquiries</div>
            <div class="tab" onclick="filterCards('TARGETED_WARNING')">Targeted Warnings</div>
            <div class="tab" onclick="filterCards('PROTECTION_OFFER')">Protection Offers</div>
        </div>
        
        <div class="pending-list" id="pending-list">'''
        
        if not pending:
            html += '''<div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>No Pending Approvals</h3>
                <p>Scam alerts and user inquiries will appear here for review.</p>
            </div>'''
        else:
            for draft in pending:
                reply_type = draft.get('reply_type', 'SCAM_ALERT')
                level_class = 'critical' if reply_type == 'SCAM_ALERT' else 'high' if reply_type == 'TARGETED_WARNING' else 'warning' if reply_type == 'USER_INQUIRY' else 'info'
                red_flags_html = ''.join([f'<span class="red-flag"><i class="fas fa-exclamation-circle"></i> {flag}</span>' for flag in draft.get('red_flags', [])[:3]])
                
                target_info = ''
                if draft.get('target_user'):
                    target_info = f'<span class="meta-item"><i class="fas fa-user"></i> Target: @{draft["target_user"]}</span>'
                
                html += f'''<div class="pending-card {level_class}" data-type="{reply_type}">
            <div class="card-header">
                <div class="user-info">
                    <div class="avatar"><i class="fas fa-{'exclamation-triangle' if reply_type == 'SCAM_ALERT' else 'question' if reply_type == 'USER_INQUIRY' else 'user-shield' if reply_type == 'TARGETED_WARNING' else 'hands-helping'}"></i></div>
                    <div>
                        <div class="user-name">@{draft['username']}</div>
                        <div style="opacity: 0.6; font-size: 13px;">{draft.get('created_at', '')[:19]}</div>
                    </div>
                </div>
                <div class="type-badge {level_class}">{reply_type.replace('_', ' ')} - {draft.get('risk_score', 0):.1f}/10</div>
            </div>
            
            <div class="meta-info">
                <span class="meta-item"><i class="fas fa-shield-alt"></i> Risk: {draft.get('risk_level', 'UNKNOWN')}</span>
                {target_info}
                <span class="meta-item"><i class="fas fa-clock"></i> {draft.get('created_at', '')[:19]}</span>
            </div>
            
            {'<div class="red-flags">' + red_flags_html + '</div>' if draft.get('red_flags') else ''}
            
            <div class="tweet-preview">{draft['reply_text']}</div>
            
            <div class="actions">
                <button class="btn btn-approve" onclick="approve('{draft['id']}')">
                    <i class="fas fa-check"></i> Approve & Send
                </button>
                <button class="btn btn-edit" onclick="editDraft('{draft['id']}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-copy" onclick="copyText('{draft['id']}')">
                    <i class="fas fa-copy"></i> Copy
                </button>
                <button class="btn btn-reject" onclick="reject('{draft['id']}')">
                    <i class="fas fa-times"></i> Reject
                </button>
                <a href="{draft.get('report_url', '#')}" target="_blank" style="color: #667eea; text-decoration: none; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-external-link-alt"></i> View Full Report
                </a>
            </div>
        </div>'''
        
        html += '''</div>
        
        <div class="footer">
            <p>Guardian Reply Bot v1.0 | Protecting the crypto community one reply at a time</p>
        </div>
    </div>
    
    <script>
        function filterCards(type) {
            const cards = document.querySelectorAll('.pending-card');
            const tabs = document.querySelectorAll('.tab');
            
            tabs.forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            
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
                    alert('✓ Reply approved and will be sent!');
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
            const cards = document.querySelectorAll('.pending-card');
            cards.forEach(card => {
                if (card.innerHTML.includes(id)) {
                    const text = card.querySelector('.tweet-preview').innerText;
                    navigator.clipboard.writeText(text);
                    alert('Copied to clipboard!');
                }
            });
        }
        
        function editDraft(id) {
            alert('Edit functionality coming soon!');
        }
    </script>
</body>
</html>'''
        
        return html
    
    def save_dashboard(self):
        """Save dashboard to file"""
        html = self.generate_dashboard_html()
        dashboard_file = Path('/Users/efinney/.openclaw/workspace/agentic-bro/public/admin/index.html')
        dashboard_file.parent.mkdir(parents=True, exist_ok=True)
        with open(dashboard_file, 'w') as f:
            f.write(html)
        return dashboard_file


# CLI interface
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Guardian Reply Bot')
    parser.add_argument('--dashboard', action='store_true', help='Generate dashboard HTML')
    parser.add_argument('--pending', action='store_true', help='List pending approvals')
    parser.add_argument('--approve', type=str, help='Approve draft by ID')
    parser.add_argument('--reject', type=str, help='Reject draft by ID')
    parser.add_argument('--test', type=str, choices=['scam', 'inquiry', 'warning', 'offer'], help='Create test draft')
    args = parser.parse_args()
    
    bot = GuardianReplyBot()
    
    if args.dashboard:
        dashboard_file = bot.save_dashboard()
        print(f"Dashboard saved to: {dashboard_file}")
    
    elif args.pending:
        pending = bot.get_pending_approvals()
        print(f"\nPending approvals: {len(pending)}")
        for draft in pending:
            print(f"  @{draft['username']} - {draft['reply_type']} ({draft.get('risk_score', 0):.1f}/10)")
    
    elif args.approve:
        success, result = bot.approve_reply(args.approve)
        if success:
            print(f"✓ Approved: @{result['username']}")
        else:
            print(f"✗ Failed: {result}")
    
    elif args.reject:
        success, result = bot.reject_reply(args.reject)
        if success:
            print(f"✗ Rejected: @{result['username']}")
        else:
            print(f"Failed: {result}")
    
    elif args.test:
        # Create test draft based on type
        if args.test == 'scam':
            test_scan = {'username': 'TestScammer', 'risk_level': 'CRITICAL', 'risk_score': 9.5, 'red_flags': ['DM solicitation', 'Guaranteed returns', 'Airdrop scam']}
            draft = bot.generate_reply(test_scan, 'SCAM_ALERT')
        elif args.test == 'inquiry':
            test_scan = {'username': 'QuestionableUser', 'risk_level': 'MEDIUM', 'risk_score': 4.2, 'red_flags': ['Free crypto', 'Airdrop']}
            draft = bot.generate_reply(test_scan, 'USER_INQUIRY')
        elif args.test == 'warning':
            test_scan = {'username': 'KnownScammer', 'risk_level': 'HIGH', 'risk_score': 8.5, 'red_flags': ['Phishing', 'Wallet drainer']}
            draft = bot.generate_targeted_warning('Victim123', 'KnownScammer', test_scan)
        else:  # offer
            draft = bot.generate_protection_offer('crypto safety')
        
        draft_id = bot.add_to_queue(draft)
        print(f"Test draft created: {draft_id}")
        print(f"Type: {draft['reply_type']}")
        print(f"\nReply text:\n{draft['reply_text']}")
    
    else:
        parser.print_help()