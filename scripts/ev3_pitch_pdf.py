#!/usr/bin/env python3
"""Generate EV3 pitch PDF using Unicode fonts."""

from fpdf import FPDF
import os

class PitchPDF(FPDF):
    def setup_fonts(self):
        self.add_font('SF', '', '/System/Library/Fonts/SFNS.ttf', uni=True)
        self.add_font('SF', 'B', '/System/Library/Fonts/SFNS.ttf', uni=True)
        self.add_font('SF', 'I', '/System/Library/Fonts/SFNSItalic.ttf', uni=True)
        self.add_font('SF', 'BI', '/System/Library/Fonts/SFNSItalic.ttf', uni=True)
        self.add_font('SFMono', '', '/System/Library/Fonts/SFNSMono.ttf', uni=True)
        self.add_font('SFR', '', '/System/Library/Fonts/SFNSRounded.ttf', uni=True)

    def header(self):
        if self.page_no() > 1:
            self.set_font('SF', 'I', 7)
            self.set_text_color(120, 120, 120)
            self.cell(0, 5, 'Jeeevs Security Protocol — EV3 Investment Memo — CONFIDENTIAL', align='C')
            self.ln(8)

    def footer(self):
        self.set_y(-15)
        self.set_font('SF', 'I', 7)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'Page {self.page_no()}', align='C')

    def section_title(self, title):
        self.set_font('SF', 'B', 13)
        self.set_text_color(20, 60, 120)
        self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(20, 60, 120)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def subsection_title(self, title):
        self.set_font('SF', 'B', 10.5)
        self.set_text_color(40, 40, 40)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def body_text(self, text):
        self.set_font('SF', '', 9.5)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5, text)
        self.ln(2)

    def bold_text(self, text):
        self.set_font('SF', 'B', 9.5)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5, text)
        self.ln(1)

    def bullet(self, text):
        self.set_font('SF', '', 9.5)
        self.set_text_color(30, 30, 30)
        self.cell(5, 5, '\u2022')
        self.multi_cell(0, 5, ' ' + text)
        self.ln(1)

    def table_row(self, cells, widths, bold=False, bg_color=None):
        if bg_color:
            self.set_fill_color(*bg_color)
        self.set_font('SF', 'B' if bold else '', 8.5)
        self.set_text_color(30, 30, 30)
        h = 6
        for i, (cell, w) in enumerate(zip(cells, widths)):
            if bg_color and bold:
                self.set_text_color(255, 255, 255)
            else:
                self.set_text_color(30, 30, 30)
            self.cell(w, h, cell, border=1, fill=bg_color is not None)
        self.ln(h)


pdf = PitchPDF()
pdf.setup_fonts()
pdf.set_auto_page_break(auto=True, margin=20)
pdf.add_page()

# ===== COVER PAGE =====
pdf.ln(30)
pdf.set_font('SF', 'B', 26)
pdf.set_text_color(20, 60, 120)
pdf.cell(0, 15, 'JEEVS SECURITY PROTOCOL', align='C', new_x="LMARGIN", new_y="NEXT")
pdf.ln(4)
pdf.set_font('SF', '', 15)
pdf.set_text_color(80, 80, 80)
pdf.cell(0, 10, 'Investment Memo \u2014 Seed Round', align='C', new_x="LMARGIN", new_y="NEXT")
pdf.ln(10)
pdf.set_draw_color(20, 60, 120)
pdf.line(60, pdf.get_y(), 150, pdf.get_y())
pdf.ln(10)
pdf.set_font('SF', '', 11)
pdf.set_text_color(60, 60, 60)
info = [
    'Company: Agentic Insights LLC',
    'Project: AgenticBro \u2192 Jeeevs Security Protocol',
    'Website: agenticbro.app',
    'Chain: Solana',
    'Stage: Pre-seed / Seed',
    'Raise: $500,000',
    'Founder: Earl Finney Jr.',
    'Date: May 2026',
]
for line in info:
    pdf.cell(0, 7, line, align='C', new_x="LMARGIN", new_y="NEXT")

pdf.ln(15)
pdf.set_font('SF', 'I', 10)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 7, 'Prepared for: EV3 (Escape Velocity Ventures)', align='C', new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 7, 'Salvador Gala & Mahesh Ramakrishnan, General Partners', align='C', new_x="LMARGIN", new_y="NEXT")

# ===== THE PROBLEM =====
pdf.add_page()
pdf.section_title('THE PROBLEM')

pdf.body_text('$1.1B+ stolen through social engineering in crypto in 2025. $8.8B+ lost to phone scams in the US alone (FTC 2024). On-chain tools catch <3% of this because scammers don\u2019t hack blockchains \u2014 they hack people.')

pdf.body_text('Fake influencers on X. Phishing websites. Impersonation phone calls. Rug-pull tokens. Romance scams. Pig-butchering. Wallet drainers.')

pdf.body_text('The entire social engineering attack surface is invisible to Chainalysis, CertiK, and every on-chain analytics tool. They see the blockchain. They don\u2019t see the person getting scammed.')

pdf.subsection_title('What On-Chain Tools Miss')
widths = [62, 55, 58]
pdf.table_row(['Attack Vector', 'On-Chain Tools', 'Jeeevs'], widths, bold=True, bg_color=(20, 60, 120))
rows = [
    ['Fake influencer promotions', "Can't see", 'Chrome CDP scan'],
    ['Phone impersonation scams', "Can't see", '12-flag phone scoring'],
    ['Phishing websites', "Can't see", 'Multi-source deep scan'],
    ['Token impersonation', 'Partial', 'DexScreener + on-chain'],
    ['Wallet drainer connections', "Can't see", 'Transfer pattern analysis'],
    ['Romance/pig-butchering', "Can't see", 'Profile behavioral AI'],
]
pdf.set_font('SF', '', 8.5)
pdf.set_text_color(30, 30, 30)
for row in rows:
    pdf.table_row(row, widths)

# ===== THE PRODUCT =====
pdf.add_page()
pdf.section_title('THE PRODUCT (SHIPPING TODAY)')

pdf.body_text('AgenticBro v2.3 is live, deployed, and protecting users. Built solo by one engineer, nights and weekends, zero funding.')

pdf.subsection_title('7 Scan Surfaces')
widths2 = [14, 52, 109]
pdf.table_row(['#', 'Scanner', 'What It Detects'], widths2, bold=True, bg_color=(20, 60, 120))
scanners = [
    ['1', 'Social Profile Scanner', 'Fake influencers, impersonation, bots (X, IG, TikTok, FB, LinkedIn, Telegram)'],
    ['2', 'Phone Identifier', '12 risk flags, 90-point scoring, VOIP/spoofed detection'],
    ['3', 'Token Scanner', 'Honeypots, high-tax tokens, rug-pull contracts'],
    ['4', 'Website Deep Scanner', 'Phishing, malware, fake dApps, wallet drainers'],
    ['5', 'Airdrop Scanner', 'Fake airdrops, wallet-draining airdrops'],
    ['6', 'Wallet Transfer Scanner', 'Real-time Solana transaction risk analysis'],
    ['7', 'Event Ticket Fraud Scanner', 'Fake event/ticket scams'],
]
pdf.set_font('SF', '', 8.5)
pdf.set_text_color(30, 30, 30)
for row in scanners:
    pdf.table_row(row, widths2)

pdf.ln(4)
pdf.subsection_title('Performance Metrics')
widths3 = [67, 108]
pdf.table_row(['Metric', 'Value'], widths3, bold=True, bg_color=(20, 60, 120))
metrics = [
    ['Scammers Indexed', '261+ (49% growth since v2.1)'],
    ['Scan Surfaces', '7'],
    ['Tests Passing', '85+'],
    ['CDP Extraction Accuracy', '95%+'],
    ['Profile Scan Latency', '~15 seconds'],
    ['False Positive Rate', '~8%'],
    ['Rug Pull Pre-Detection', '71%'],
    ['Campaigns Tracked', '340+ per node'],
    ['Time to First Alert', '<22 minutes'],
    ['DB Growth (v2.1\u2192v2.3)', '+49%'],
]
pdf.set_font('SF', '', 8.5)
pdf.set_text_color(30, 30, 30)
for row in metrics:
    pdf.table_row(row, widths3)

pdf.ln(3)
pdf.body_text('Demo: https://youtube.com/shorts/cfhzrmvwfy8')
pdf.body_text('Wallet Protection: https://youtube.com/shorts/qtZODapspz0')

# ===== WHY THIS IS DEPIN =====
pdf.add_page()
pdf.section_title('WHY THIS IS DEPIN \u2014 NOT SAAS')

pdf.body_text('Jeeevs runs on Mac Studio nodes with local Ollama inference. Zero OpenAI dependency. Zero API rental. Fixed hardware cost, 98%+ gross margins.')

pdf.subsection_title('DePIN Architecture')
pdf.set_font('SFMono', '', 7)
pdf.set_text_color(30, 30, 30)
arch = [
    '+---------------------------------------------------+',
    '|          JEEVS SECURITY PROTOCOL                  |',
    '+---------------------------------------------------+',
    '|  ABIG (AgenticBro Intelligence Graph)             |',
    '|  Shared threat intelligence across all nodes      |',
    '+----------+----------+----------+------------------+',
    '| Worker   | Worker   | Worker   |  Validator       |',
    '| Node 1   | Node 2   | Node 3   |  Nodes           |',
    '| (Mac     | (Mac     | (Mac     |  (Stake 10K      |',
    '|  Studio) |  Studio) |  Studio) |   $JEEEVS)       |',
    '+----------+----------+----------+------------------+',
    '|            Solana Blockchain                      |',
    '|   $JEEEVS Token * Staking * Fee Distribution      |',
    '+---------------------------------------------------+',
]
for line in arch:
    pdf.cell(0, 3.5, line, new_x="LMARGIN", new_y="NEXT")
pdf.ln(4)

pdf.set_font('SF', '', 9.5)
pdf.bullet('Worker nodes stake 50K $JEEEVS and process scans locally')
pdf.bullet('Validator nodes stake 10K $JEEEVS, verify results, earn protocol fees')
pdf.bullet('ABIG shares threat intelligence across all nodes \u2014 more nodes = better intelligence')
pdf.bullet('30% of a la carte fees burned \u2014 deflationary by design')
pdf.bullet('$100 $JEEEVS held = 50 scans/month \u2014 demand-gated access, not vapor')

pdf.ln(2)
pdf.bold_text('Network effects are structural: More nodes \u2192 faster scans \u2192 better data \u2192 more users \u2192 more fees \u2192 more node operators \u2192 more nodes.')

# ===== EVOLUTION =====
pdf.add_page()
pdf.section_title('THE EVOLUTION: PRODUCT \u2192 PROTOCOL')

widths4 = [42, 52, 81]
pdf.table_row(['Aspect', 'AgenticBro (Today)', 'Jeeevs Protocol (Funded)'], widths4, bold=True, bg_color=(20, 60, 120))
evo = [
    ['What it is', 'Scam detection app', 'Decentralized security network'],
    ['Revenue', 'SaaS + token-gated', 'Protocol fees + node incentives + enterprise'],
    ['Moat', 'Data + accuracy', 'Network effects + sovereign inference'],
    ['Valuation', 'Feature product (~$5-10M)', 'Infrastructure layer (~$50-200M)'],
]
pdf.set_font('SF', '', 8.5)
pdf.set_text_color(30, 30, 30)
for row in evo:
    pdf.table_row(row, widths4)

pdf.ln(3)
pdf.body_text('AgenticBro is the product that proves PMF. Jeeevs Protocol is the infrastructure it becomes with funding. The product works today. The protocol is the scale play.')

# ===== MARKET =====
pdf.section_title('MARKET OPPORTUNITY')
widths5 = [62, 48, 65]
pdf.table_row(['Market', 'Size', 'Growth'], widths5, bold=True, bg_color=(20, 60, 120))
markets = [
    ['Crypto scam losses (2025)', '$1.1B+', '+1400% AI scam YoY'],
    ['US phone scams (FTC 2024)', '$8.8B+', 'Growing 25% YoY'],
    ['DePIN market cap', '$50B+', '60% on Solana'],
    ['Cybersecurity AI (2028)', '$135B', 'CAGR 24%'],
]
pdf.set_font('SF', '', 8.5)
pdf.set_text_color(30, 30, 30)
for row in markets:
    pdf.table_row(row, widths5)

pdf.ln(2)
pdf.bold_text('Key insight: AI scams extract $3.2M per incident vs $719K without AI (FBI 2024). The problem is accelerating, and on-chain tools can\'t see it. We can.')

# ===== COMPETITIVE =====
pdf.section_title('COMPETITIVE LANDSCAPE')
widths6 = [38, 33, 52, 52]
pdf.table_row(['Company', 'Funding', 'What They Do', 'Our Edge'], widths6, bold=True, bg_color=(20, 60, 120))
comps = [
    ['Chainalysis', '$536M', 'On-chain analytics (B2B)', 'We see the human layer'],
    ['Sardine', '$52M', 'Fraud prevention (API)', 'DePIN + local inference'],
    ['CertiK', '$370M', 'Smart contract audits', 'We detect social eng.'],
]
pdf.set_font('SF', '', 8.5)
pdf.set_text_color(30, 30, 30)
for row in comps:
    pdf.table_row(row, widths6)

pdf.ln(2)
pdf.bold_text('Our moat: Physical Mac Studio nodes running local inference = sovereign DePIN infrastructure. Not rent-seeking on OpenAI. Not blockchain analytics. Consumer-facing protection across 7 surfaces that on-chain tools literally cannot see.')

# ===== TEAM =====
pdf.add_page()
pdf.section_title('TEAM')

pdf.bold_text('Earl Finney Jr. \u2014 Founder, Agentic Insights LLC')
pdf.bullet('Systems Design Engineer, AT&T (enterprise infrastructure, 99.999% uptime systems)')
pdf.bullet('B.S. Electrical Engineering, Boston University')
pdf.bullet('Built AgenticBro solo, nights and weekends, zero funding')
pdf.bullet('261+ scammers indexed, 85+ tests, 7 scan surfaces \u2014 all shipped')

pdf.ln(2)
pdf.body_text('Seed round = full-time commitment + 2-3 hires (protocol engineer, ML engineer, community lead).')

# ===== USE OF FUNDS =====
pdf.section_title('USE OF FUNDS ($500K)')
widths7 = [57, 33, 82]
pdf.table_row(['Allocation', 'Amount', 'Purpose'], widths7, bold=True, bg_color=(20, 60, 120))
funds = [
    ['$JEEEVS Liquidity', '$150K', 'OpenBook listing, LP seeding, burn'],
    ['Node Farm', '$200K', '10+ Mac Studio nodes, hosting, DePIN scaling'],
    ['Browser Extension', '$100K', 'Chrome Safe Browse, Q3 2026'],
    ['Operations', '$50K', 'Legal, marketing, runway'],
]
pdf.set_font('SF', '', 8.5)
pdf.set_text_color(30, 30, 30)
for row in funds:
    pdf.table_row(row, widths7)

# ===== WHY EV3 =====
pdf.ln(6)
pdf.section_title('WHY EV3')

why_ev3 = [
    ('1.', 'Sal wrote the DePIN report.', 'You defined this investment category. We\'re building DePIN security infrastructure \u2014 the exact thesis you published.'),
    ('2.', 'Portfolio fit.', 'You invested in Opacity (identity), Unlink (privacy), MachineFi (DePIN). Security is the missing piece in your portfolio, and we fill it.'),
    ('3.', '60% of DePIN token market cap is on Solana.', '(Your own thesis.) Those projects and their users need protection. We provide it.'),
    ('4.', 'We ship.', '261+ scammers indexed, 7 surfaces, 85+ tests \u2014 all solo, all nights and weekends. Imagine what we do with $500K and full-time focus.'),
    ('5.', 'Sovereign inference, not API wrappers.', 'Mac Studio nodes running local Ollama. Fixed cost, 98%+ margins. This is the DePIN hardware thesis applied to security.'),
]

for num, title, desc in why_ev3:
    pdf.set_font('SF', 'B', 9.5)
    pdf.cell(8, 6, num)
    pdf.cell(55, 6, title)
    pdf.ln(6)
    pdf.set_x(pdf.l_margin + 8)
    pdf.set_font('SF', '', 9)
    pdf.multi_cell(0, 5, desc)
    pdf.ln(2)

# ===== CONTACT =====
pdf.ln(4)
pdf.section_title('CONTACT')
pdf.body_text('Earl Finney Jr., Founder')
pdf.body_text('Agentic Insights LLC')
pdf.body_text('Website: agenticbro.app')
pdf.body_text('LinkedIn: linkedin.com/in/earlfinneyjr')
pdf.body_text('X/Twitter: @agenticbro')

pdf.ln(4)
pdf.set_font('SF', 'I', 8)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 5, 'This document is confidential and intended solely for the named recipient.', align='C', new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 5, 'Do not distribute without written permission from Agentic Insights LLC.', align='C', new_x="LMARGIN", new_y="NEXT")

# Save
output_path = '/Users/efinney/.openclaw/workspace/EV3_PITCH.pdf'
pdf.output(output_path)
print(f'PDF saved to: {output_path}')
print(f'Size: {os.path.getsize(output_path)} bytes')