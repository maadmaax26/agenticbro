import puppeteer from 'puppeteer-core';
import fs from 'fs';

const USERNAME = process.argv[2];
const PROFILE_URL = `https://x.com/${USERNAME}`;
const TIMESTAMP = process.argv[3] || new Date().toISOString();
const OUTPUT_FILE = process.argv[4];

const RED_FLAGS = {
    "Guaranteed Returns": 10,
    "Private Alpha": 10,
    "Unrealistic Claims": 10,
    "Urgency Tactics": 10,
    "No Track Record": 10,
    "Requests Crypto": 10,
    "No Verification": 10,
    "Fake Followers": 10,
    "New Account": 5,
    "VIP Upsell": 5
};

let totalWeight = 0;

try {
    console.log("");
    console.log("🔍 STEP 1: NAVIGATING TO PROFILE...");
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Extract username
    const usernameEl = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="user-mentioned-username"]');
        return el ? el.textContent.replace(/["&]/g, '') : 'Unknown';
    });

    // Extract display name
    const displayName = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="user-mentioned-displayname"]');
        return el ? el.textContent.trim().replace(/[“"]/g, '').replace(/\*+$/, '') : 'N/A';
    });

    // Verification badge
    const verified = await page.evaluate(() => {
        try { return !!document.querySelector('[data-testid="icon-verified"]'); } catch { return false; }
    });

    // Bio
    const bio = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="tweetText"]');
        return el ? el.textContent.replace(/["&]/g, '').trim() : '';
    });

    // Follower/following counts
    const html = await page.content();
    const followerMatch = html.match(/(\d{1,3}(?:,\d{3})*(?:,\d{3})?)(?:\s+followers?\s)?/);
    const followingMatch = html.match(/(\d{1,3}(?:,\d{3})*(?:,\d{3})?)(?:\s+following?\s)?/);
    
    const followerCount = followerMatch ? followerMatch[1].replace(/,/g, '') : '0';
    const followingCount = followingMatch ? followingMatch[1].replace(/,/g, '') : '0';

    // Join date
    const joinDate = await page.evaluate(() => {
        const text = document.body.innerText || '';
        const match = text.match(/Since?\s+(\w+\s+\d{1,2},?\s+\d{4})/);
        return match ? match[1] : 'Unknown';
    });

    console.log("✅ Data extracted");
    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 PROFILE DATA EXTRACTED");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log(`Username: @${usernameEl}`);
    console.log(`Display Name: ${displayName}`);
    console.log(`Verified: ${verified ? '✅' : '❌'}`);
    console.log(`Bio: ${bio || '(none)'}`);
    console.log(`Followers: ${followerCount}`);
    console.log(`Following: ${followingCount}`);
    console.log(`Joined: ${joinDate}`);

    // Red flag analysis
    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🚨 RED FLAG ANALYSIS");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    const bioLower = (bio || '').toLowerCase();
    const results = [];

    if (bioLower.includes('guaranteed') || bioLower.includes('100x') || bioLower.includes('never lose')) {
        console.log("🚨 Red Flag: Unrealistic claims detected");
        totalWeight += RED_FLAGS["Unrealistic Claims"];
        results.push({ flag: "Unrealistic Claims", points: RED_FLAGS["Unrealistic Claims"] });
    }

    if (bioLower.includes('dm') || bioLower.includes('message') || bioLower.includes('contact')) {
        console.log("🚨 Red Flag: DM solicitation");
        totalWeight += RED_FLAGS["Requests Crypto"];
        results.push({ flag: "DM Solicitation", points: RED_FLAGS["Requests Crypto"] });
    }

    if (bioLower.includes('giveaway') || bioLower.includes('airdrop') || bioLower.includes('free crypto')) {
        console.log("🚨 Red Flag: Crypto giveaway/airdrop");
        totalWeight += RED_FLAGS["Private Alpha"];
        results.push({ flag: "Airdrop/Giveaway", points: RED_FLAGS["Private Alpha"] });
    }

    if (!verified) {
        console.log("⚠️  Warning: No verification badge");
        totalWeight += RED_FLAGS["No Verification"];
        results.push({ flag: "No Verification", points: RED_FLAGS["No Verification"] });
    }

    // Risk level
    let riskLevel = "LOW";
    if (totalWeight >= 70) riskLevel = "CRITICAL";
    else if (totalWeight >= 50) riskLevel = "HIGH";
    else if (totalWeight >= 20) riskLevel = "MEDIUM";

    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 RISK ASSESSMENT");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log(`Risk Score: ${totalWeight}/90`);
    console.log(`Risk Level: ${riskLevel}`);
    console.log("");
    console.log(`Red Flags Found: ${results.length}`);
    results.forEach(r => console.log(`  - ${r.flag}: \`${r.points}\` points`));
    console.log("");

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⚠️  DISCLAIMER");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR.");
    console.log(`Scan date: ${TIMESTAMP}`);
    console.log("");
    console.log("Red flags: guaranteed_returns • giveaway_airdrop • dm_solicitation • free_crypto • alpha_dm_scheme • unrealistic_claims • download_install • urgency_tactics • emotional_manipulation • low_credibility");

    // Write report
    const report = `# X Profile Scan — Fixed CDP Method

**Date:** ${TIMESTAMP}
**Platform:** X/Twitter
**Account:** @${usernameEl}
**URL:** ${PROFILE_URL}

---

## Profile Data

- **Username:** ${usernameEl}
- **Display Name:** ${displayName}
- **Verified:** ${verified ? '✅' : '❌'}
- **Bio:** ${bio || '(none)'}
- **Followers:** ${followerCount}
- **Following:** ${followingCount}
- **Joined:** ${joinDate}

---

## Risk Assessment

**Risk Score:** ${totalWeight}/90
**Risk Level:** ${riskLevel}

**Red Flags Found:** ${results.length}
\`\`\`
${results.map(r => `- \`${r.flag}\`: \`${r.points}\` points`).join('\n') || '(none)'}
\`\`\`

---

## Disclaimer

Educational purposes only. Not financial advice. Not a guarantee of safety. Always DYOR.

**Red flags:** guaranteed_returns • giveaway_airdrop • dm_solicitation • free_crypto • alpha_dm_scheme • unrealistic_claims • download_install • urgency_tactics • emotional_manipulation • low_credibility
`;

    fs.writeFileSync(OUTPUT_FILE, report);
    console.log("");
    console.log(`✅ Report saved to: ${OUTPUT_FILE}`);

} catch (error) {
    console.error("❌ Error:", error.message);
    
    const errorReport = `# X Profile Scan — Error

**Date:** ${TIMESTAMP}
**Platform:** X/Twitter
**Account:** ${USERNAME}
**Error:** ${error.message}

---

Scan failed.
`;
    fs.writeFileSync(OUTPUT_FILE, errorReport);
    console.log(`Report saved to: ${OUTPUT_FILE}`);
}

await browser.close();
