# AgenticBro Website Disclaimer Banner

**Paste this on the website homepage and every scan results page.**

---

## Version 1: Compact Banner (Homepage)

```
⚠️ DISCLAIMER
AgenticBro provides informational scans for EDUCATIONAL PURPOSES ONLY.
NOT FINANCIAL ADVICE. NOT A GUARANTEE OF SAFETY.
Always do your own due diligence before investing.
[Learn More]
```

---

## Version 2: Full Banner (Scan Results)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DISCLAIMER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This scan result is for EDUCATIONAL PURPOSES ONLY.

• NOT FINANCIAL ADVICE
• NOT AN INVESTMENT RECOMMENDATION  
• NOT A GUARANTEE OF SAFETY
• NOT A STATEMENT OF FACT

AgenticBro does not guarantee the accuracy of scan results.
A "low risk" result does NOT mean an account or token is safe.

Always conduct your own due diligence before making any
investment decisions. Never invest more than you can afford to lose.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scan Date: YYYY-MM-DD HH:MM:SS TZ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Version 3: Footer Disclaimer (Every Page)

```
© 2026 AgenticBro. All scan results are educational and informational only.
Not financial advice. Not a guarantee. See Terms of Service for full details.
AGNTCBRO | Solana
```

---

## Version 4: Payment Page Disclaimer

```
⚠️ BEFORE YOU PAY

By purchasing a scan, you acknowledge:

☐ Scan results are for EDUCATIONAL PURPOSES ONLY
☐ AgenticBro is NOT a financial advisor
☐ Scan results are NOT guarantees of safety
☐ You will conduct your own due diligence
☐ You accept full responsibility for your investment decisions
☐ AgenticBro is NOT liable for any financial losses

[I Accept] [Cancel]
```

---

## HTML Implementation

### Homepage Banner

```html
<div class="disclaimer-banner" style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
  <p style="margin: 0; color: #856404;">
    ⚠️ <strong>DISCLAIMER:</strong> AgenticBro provides informational scans for 
    <strong>EDUCATIONAL PURPOSES ONLY</strong>. NOT FINANCIAL ADVICE. 
    NOT A GUARANTEE OF SAFETY. Always do your own due diligence before investing.
    <a href="/terms">Learn More</a>
  </p>
</div>
```

### Scan Results Disclaimer

```html
<div class="scan-disclaimer" style="background: #f8f9fa; padding: 20px; border: 2px solid #dee2e6; border-radius: 8px; margin: 20px 0;">
  <h3 style="color: #495057; margin-top: 0;">📋 DISCLAIMER</h3>
  <p style="color: #6c757d;">This scan result is for <strong>EDUCATIONAL PURPOSES ONLY</strong>.</p>
  <ul style="color: #6c757d; padding-left: 20px;">
    <li>NOT FINANCIAL ADVICE</li>
    <li>NOT AN INVESTMENT RECOMMENDATION</li>
    <li>NOT A GUARANTEE OF SAFETY</li>
    <li>NOT A STATEMENT OF FACT</li>
  </ul>
  <p style="color: #6c757d;">A "low risk" result does NOT mean an account or token is safe.</p>
  <p style="color: #6c757d;"><strong>Always conduct your own due diligence.</strong></p>
  <hr style="border: 0; border-top: 1px solid #dee2e6;">
  <p style="color: #6c757d; font-size: 12px; margin-bottom: 0;">
    Scan Date: <span id="scan-timestamp">YYYY-MM-DD HH:MM:SS EST</span>
  </p>
</div>
```

### Footer

```html
<footer style="background: #212529; color: #adb5bd; padding: 20px; text-align: center;">
  <p style="margin: 0; font-size: 12px;">
    © 2026 AgenticBro. All scan results are educational and informational only.
    Not financial advice. Not a guarantee.
    <a href="/terms" style="color: #fff;">Terms of Service</a> |
    <a href="/privacy" style="color: #fff;">Privacy Policy</a>
  </p>
  <p style="margin: 10px 0 0 0; font-size: 11px;">
    AGNTCBRO | Solana
  </p>
</footer>
```

---

## React Component

```tsx
const DisclaimerBanner: React.FC<{ variant?: 'compact' | 'full' | 'footer' }> = ({ variant = 'compact' }) => {
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  if (variant === 'full') {
    return (
      <div className="scan-disclaimer">
        <h3>📋 DISCLAIMER</h3>
        <p>This scan result is for <strong>EDUCATIONAL PURPOSES ONLY</strong>.</p>
        <ul>
          <li>NOT FINANCIAL ADVICE</li>
          <li>NOT AN INVESTMENT RECOMMENDATION</li>
          <li>NOT A GUARANTEE OF SAFETY</li>
          <li>NOT A STATEMENT OF FACT</li>
        </ul>
        <p>A "low risk" result does NOT mean an account or token is safe.</p>
        <p><strong>Always conduct your own due diligence.</strong></p>
        <hr />
        <p className="timestamp">Scan Date: {timestamp}</p>
      </div>
    );
  }

  return (
    <div className="disclaimer-banner">
      ⚠️ EDUCATIONAL PURPOSES ONLY. NOT FINANCIAL ADVICE. NOT A GUARANTEE.
      <a href="/terms">Learn More</a>
    </div>
  );
};
```

---

## Placement Checklist

- [ ] Homepage: Compact banner
- [ ] Scan results page: Full banner with timestamp
- [ ] Payment page: Checkbox acknowledgment
- [ ] Footer: Link to Terms and Privacy
- [ ] Email receipts: Disclaimer in footer
- [ ] Telegram scan results: Compact disclaimer
- [ ] PDF exports: Full disclaimer

---

**END OF WEBSITE DISCLAIMER TEMPLATE**