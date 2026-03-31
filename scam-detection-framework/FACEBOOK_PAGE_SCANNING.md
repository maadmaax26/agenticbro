# Scam Detection Framework - Facebook Page Scanning

**Date:** March 28, 2026  
**Feature:** Facebook Page Scanning (Feature #7)  
**Purpose:** Detect scam indicators on Facebook pages and groups that target crypto investors

---

## 📊 Feature Overview

**What:** Scan Facebook pages and groups for scam indicators

**Current State:** System only scans X/Twitter and Telegram
**Enhancement:** Add Facebook page scanning support

**Scanning Methods:**
- Browser automation (Chrome CDP) for page navigation
- Web fetch for public page content
- Meta Graph API for page data (if available)

---

## 🔍 Facebook Scam Patterns

### Common Scam Indicators

1. **Unverified Pages**
   - No blue checkmark verification badge
   - New pages claiming to be official projects
   - Impersonation of legitimate projects

2. **New Pages**
   - Created < 30 days ago
   - High activity but no track record
   - Suspicious posting patterns

3. **Fake Testimonials**
   - Paid actors or fabricated success stories
   - Generic praise ("This changed my life!")
   - Repetitive language across posts

4. **Fake Engagement**
   - Suspicious like-to-post ratio
   - Low comments despite high likes
   - Bots or paid accounts

5. **Suspicious Content**
   - Guaranteed returns promises
   - VIP tier structures
   - Pool trading / investment pools
   - Urgency tactics ("limited time only!")

---

## 🛠️ Implementation

### Method 1: Browser Automation (Chrome CDP)

```javascript
/**
 * Scan Facebook page for scam indicators
 * @param {string} pageUrl - Facebook page URL
 * @returns {object} Scan results with risk score
 */
async function scanFacebookPage(pageUrl) {
  const browser = await connectToChromeCDP(18800);
  const page = await browser.newPage();
  
  // Navigate to Facebook page
  await page.goto(pageUrl);
  await page.waitForTimeout(3000);
  
  // Extract page data
  const pageData = {
    url: pageUrl,
    name: await getPageName(page),
    isVerified: await checkVerificationBadge(page),
    pageAge: await calculatePageAge(page),
    followerCount: await getFollowerCount(page),
    postCount: await getPostCount(page),
    bio: await getBio(page),
    recentPosts: await getRecentPosts(page, 10)
  };
  
  // Analyze for red flags
  const redFlags = analyzeRedFlags(pageData);
  
  // Calculate risk score
  const riskScore = calculateRiskScore(pageData, redFlags);
  
  // Determine risk level
  const riskLevel = getRiskLevel(riskScore);
  
  // Generate report
  const report = generateFacebookReport(pageData, redFlags, riskScore, riskLevel);
  
  await page.close();
  
  return report;
}

/**
 * Check verification badge
 */
async function checkVerificationBadge(page) {
  const verified = await page.evaluate(() => {
    const badge = document.querySelector('[aria-label*="Verified"]');
    return badge !== null;
  });
  return verified;
}

/**
 * Calculate page age
 */
async function calculatePageAge(page) {
  const createdDate = await page.evaluate(() => {
    const joinedElement = document.querySelector('[data-pagelet="ProfileTimelineSectionHeader"]');
    if (joinedElement) {
      const joinedText = joinedElement.textContent;
      const joinedDate = new Date(joinedText.match(/(\d{4})/)[1]);
      return joinedDate;
    }
    return null;
  });
  
  if (createdDate) {
    const now = new Date();
    const daysOld = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
    return daysOld;
  }
  
  return null; // Cannot determine
}

/**
 * Get recent posts
 */
async function getRecentPosts(page, count = 10) {
  const posts = await page.evaluate((limit) => {
    const postElements = document.querySelectorAll('[role="article"]');
    const posts = [];
    
    postElements.forEach((post, index) => {
      if (index >= limit) return;
      
      const text = post.querySelector('[data-testid="post_message"]');
      const likes = post.querySelector('[data-testid="LikeButton"] span');
      const comments = post.querySelector('[data-testid="UFI2CommentsCount/root"] span');
      const shares = post.querySelector('[data-testid="ShareButton"] span');
      
      posts.push({
        text: text ? text.textContent : '',
        likes: likes ? likes.textContent : '0',
        comments: comments ? comments.textContent : '0',
        shares: shares ? shares.textContent : '0'
      });
    });
    
    return posts;
  }, count);
  
  return posts;
}

/**
 * Analyze red flags
 */
function analyzeRedFlags(pageData) {
  const redFlags = [];
  
  // Red Flag 1: Unverified page
  if (!pageData.isVerified) {
    redFlags.push({
      type: 'unverified_page',
      weight: 5,
      description: 'Page is not verified by Meta'
    });
  }
  
  // Red Flag 2: New page (< 30 days)
  if (pageData.pageAge && pageData.pageAge < 30) {
    redFlags.push({
      type: 'new_page',
      weight: 4,
      description: `Page is only ${pageData.pageAge} days old`
    });
  }
  
  // Red Flag 3: Guaranteed returns
  const guaranteedReturnsKeywords = ['guaranteed returns', 'guaranteed profit', 'risk-free', '100% returns'];
  pageData.recentPosts.forEach(post => {
    guaranteedReturnsKeywords.forEach(keyword => {
      if (post.text.toLowerCase().includes(keyword)) {
        redFlags.push({
          type: 'guaranteed_returns',
          weight: 9,
          description: `Post contains "${keyword}"`
        });
      }
    });
  });
  
  // Red Flag 4: VIP tier structure
  const vipKeywords = ['vip tier', 'premium tier', 'subscription', 'join vip'];
  pageData.recentPosts.forEach(post => {
    vipKeywords.forEach(keyword => {
      if (post.text.toLowerCase().includes(keyword)) {
        redFlags.push({
          type: 'vip_tier',
          weight: 7,
          description: `Post mentions "${keyword}"`
        });
      }
    });
  });
  
  // Red Flag 5: Pool trading / investment pools
  const poolKeywords = ['pool trading', 'investment pool', 'collective investment', 'group investment'];
  pageData.recentPosts.forEach(post => {
    poolKeywords.forEach(keyword => {
      if (post.text.toLowerCase().includes(keyword)) {
        redFlags.push({
          type: 'pool_trading',
          weight: 8,
          description: `Post mentions "${keyword}"`
        });
      }
    });
  });
  
  // Red Flag 6: Fake engagement (low comment-to-like ratio)
  pageData.recentPosts.forEach(post => {
    const likes = parseInt(post.likes) || 0;
    const comments = parseInt(post.comments) || 0;
    
    if (likes > 100) {
      const commentRatio = comments / likes;
      if (commentRatio < 0.01) {  // Less than 1% comments to likes
        redFlags.push({
          type: 'fake_engagement',
          weight: 4,
          description: `Suspicious engagement: ${likes} likes, ${comments} comments (${(commentRatio * 100).toFixed(1)}% ratio)`
        });
      }
    }
  });
  
  // Red Flag 7: Urgency tactics
  const urgencyKeywords = ['limited time', 'act now', 'only today', 'last chance', 'spots remaining'];
  pageData.recentPosts.forEach(post => {
    urgencyKeywords.forEach(keyword => {
      if (post.text.toLowerCase().includes(keyword)) {
        redFlags.push({
          type: 'urgency_tactics',
          weight: 6,
          description: `Post contains "${keyword}"`
        });
      }
    });
  });
  
  // Red Flag 8: Requests crypto / wallet address
  const cryptoKeywords = ['send to wallet', 'deposit to', 'transfer to', 'solana address', 'eth address'];
  pageData.recentPosts.forEach(post => {
    cryptoKeywords.forEach(keyword => {
      if (post.text.toLowerCase().includes(keyword)) {
        redFlags.push({
          type: 'requests_crypto',
          weight: 10,
          description: `Post mentions "${keyword}"`
        });
      }
    });
  });
  
  return redFlags;
}

/**
 * Calculate risk score (0-10 scale)
 */
function calculateRiskScore(pageData, redFlags) {
  const baseScore = 0;
  
  // Add red flag weights
  const redFlagScore = redFlags.reduce((sum, flag) => sum + flag.weight, 0);
  
  // Normalize to 0-10 scale (based on max possible score of ~70)
  const normalizedScore = (redFlagScore / 70) * 10;
  
  return Math.min(Math.round(normalizedScore * 10) / 10, 10);
}

/**
 * Get risk level
 */
function getRiskLevel(riskScore) {
  if (riskScore >= 7) return 'CRITICAL';
  if (riskScore >= 5) return 'HIGH';
  if (riskScore >= 3) return 'MEDIUM';
  return 'LOW';
}

/**
 * Generate report
 */
function generateFacebookReport(pageData, redFlags, riskScore, riskLevel) {
  return {
    platform: 'Facebook',
    url: pageData.url,
    name: pageData.name,
    scannedAt: new Date().toISOString(),
    
    pageInfo: {
      isVerified: pageData.isVerified,
      pageAge: pageData.pageAge,
      followerCount: pageData.followerCount,
      postCount: pageData.postCount,
      bio: pageData.bio
    },
    
    redFlags: redFlags,
    redFlagCount: redFlags.length,
    
    riskScore: riskScore,
    riskLevel: riskLevel,
    
    recommendations: generateRecommendations(pageData, redFlags, riskLevel)
  };
}

/**
 * Generate recommendations
 */
function generateRecommendations(pageData, redFlags, riskLevel) {
  const recommendations = [];
  
  if (!pageData.isVerified) {
    recommendations.push('⚠️ Page is not verified - verify legitimacy before trusting');
  }
  
  if (pageData.pageAge && pageData.pageAge < 30) {
    recommendations.push('⚠️ New page - high risk, check track record');
  }
  
  if (riskLevel === 'CRITICAL') {
    recommendations.push('🚨 HIGH RISK - Do not interact or send crypto');
    recommendations.push('🔍 Report page to Meta and community');
  } else if (riskLevel === 'HIGH') {
    recommendations.push('⚠️ High risk - Exercise extreme caution');
    recommendations.push('🔍 Research thoroughly before engaging');
  } else if (riskLevel === 'MEDIUM') {
    recommendations.push('⚠️ Medium risk - Be cautious');
    recommendations.push('🔍 Verify claims with external sources');
  } else {
    recommendations.push('✅ Low risk - Still verify before sending crypto');
  }
  
  return recommendations;
}
```

---

## 📊 Risk Scoring

### Red Flags & Weights

| Red Flag | Weight | Max Score |
|----------|--------|-----------|
| **Unverified page** | +5 | 0.7 |
| **New page (<30 days)** | +4 | 0.6 |
| **Guaranteed returns** | +9 | 1.3 |
| **VIP tier structure** | +7 | 1.0 |
| **Pool trading** | +8 | 1.1 |
| **Fake engagement** | +4 | 0.6 |
| **Urgency tactics** | +6 | 0.9 |
| **Requests crypto** | +10 | 1.4 |

### Risk Levels

| Risk Score | Risk Level | Action |
|------------|------------|--------|
| **0-3** | LOW | Verify, but generally safe |
| **3-5** | MEDIUM | Exercise caution, verify claims |
| **5-7** | HIGH | Avoid interaction, warn others |
| **7-10** | CRITICAL | Do not interact, report immediately |

---

## 🎯 Example Workflow

### Example: Scan Legitimate Page

**URL:** https://facebook.com/solana

**Expected Result:**
```
Facebook Page Scan: Solana
Risk Score: 0.5/10 (LOW RISK)
Risk Level: LOW

Key Findings:
• Page is verified ✅
• 1M+ followers
• Page age: 5+ years
• No red flags detected
• Official Solana Foundation page

Recommendation: ✅ Legitimate official page

$AGNTCBRO #ScamDetection #CryptoSafety
```

### Example: Scan Scam Page

**URL:** https://facebook.com/solana-vip-signals-official

**Expected Result:**
```
Facebook Page Scan: Solana VIP Signals (FAKE)
Risk Score: 8.5/10 (HIGH RISK)
Risk Level: HIGH

Red Flags Detected (6):
• ⚠️ Page is not verified (+5)
• ⚠️ Page is 15 days old (+4)
• ⚠️ VIP tier structure in bio (+7)
• ⚠️ Post mentions "guaranteed returns" (+9)
• ⚠️ Pool trading mentioned (+8)
• ⚠️ Urgency tactics: "limited time only" (+6)

Recommendation: 🚨 HIGH RISK - Do not interact or send crypto

$AGNTCBRO #ScamDetection #CryptoSafety
```

---

## 🔧 Integration with Web Scraper Agent

### Update web-scraper Agent

Add Facebook scanning capability to web-scraper agent:

```javascript
// In /agents/web-scraper/agent/config.json
{
  "tools": {
    "read": true,
    "write": true,
    "edit": true,
    "exec": false,
    "process": false,
    "web_search": true,
    "web_fetch": true,
    "browser_automation": {
      "enabled": true,
      "supported_platforms": ["x", "twitter", "facebook"]
    }
  }
}
```

### Routing Logic Update

```javascript
// In main agent routing logic
function selectAgent(analysis) {
  // ... existing logic ...
  
  // Add Facebook scanning
  if (content.includes('facebook.com/') || 
      content.includes('fb.com/') ||
      (content.toLowerCase().includes('facebook') && content.toLowerCase().includes('page'))) {
    return {
      agent: 'web-scraper',
      sessionKey: 'agent:web-scraper:main',
      reason: 'Facebook page scan',
      method: 'browser_automation'
    };
  }
  
  // ... rest of logic ...
}
```

---

## 📝 Usage

### Command Line

```bash
# Scan Facebook page
node scripts/scan_facebook_page.js "https://facebook.com/solana-vip-signals-official"
```

### Via Telegram

```
User: Scan Facebook page: https://facebook.com/solana-vip-signals-official

Main Agent: Analyzes request → Facebook page detected → Delegates to web-scraper

Web Scraper: 
1. Opens browser tab
2. Navigates to Facebook page
3. Extracts page data
4. Analyzes red flags
5. Calculates risk score
6. Generates report

Main Agent: Formats and returns result
```

---

## 🚀 Implementation Status

### Complete
✅ Algorithm designed
✅ Red flags defined (8 types)
✅ Risk scoring formula implemented
✅ Report format specified

### In Progress
⏳ Integration with web-scraper agent
⏳ Update routing logic for Facebook URLs
⏳ Test with real Facebook pages

### Ready For
✅ Implementation in web-scraper agent
✅ Testing with legitimate and scam pages
✅ Performance monitoring
✅ User feedback

---

## 📊 Success Metrics

### Performance Targets
- Page scan time: < 5 seconds
- Red flag detection accuracy: > 90%
- False positive rate: < 10%
- User satisfaction: > 4.5/5

### Success Indicators
- Detect fake Facebook pages accurately
- Flag high-risk pages for user warnings
- Reduce victim reports related to Facebook scams
- Improve overall scam detection coverage

---

## 📝 Notes

### Limitations
- Facebook has anti-scraping measures - may block automated access
- Some pages require login to view full content
- Fake pages may impersonate verified pages (blue checkmark)
- Facebook algorithm may limit data extraction

### Mitigations
- Use browser automation for dynamic content
- Respect rate limits (1 scan per 10 seconds)
- Focus on public pages only
- Verify with other sources (X, official website)

### Privacy
- Only collect publicly available data
- Respect user privacy (no personal data collection)
- Use scans for community protection only

---

**Created:** March 28, 2026  
**Feature:** #7 - Facebook Page Scanning  
**Status:** Algorithm complete, integration in progress  
**Next:** Implement in web-scraper agent  

---

**Remember:** Scan first, ape later! 🔐