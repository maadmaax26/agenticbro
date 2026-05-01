#!/usr/bin/env python3
"""
X/Twitter Profile Scanner via Chrome CDP
Extracts profile data + recent tweets, applies 90-point risk scoring.
"""

import json, time, sys, os, re, websocket, urllib.request

USERNAME = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("SCAN_USERNAME", "")
if not USERNAME:
    print("Error: No username provided")
    sys.exit(1)

USERNAME = USERNAME.lstrip("@")
PROFILE_URL = f"https://x.com/{USERNAME}"
CDP_PORT = 18801

WORKSPACE = os.environ.get("WORKSPACE", "/Users/efinney/.openclaw/workspace")

# ── Connect to Chrome CDP ──────────────────────────────────────────
try:
    tabs = json.loads(urllib.request.urlopen(f'http://localhost:{CDP_PORT}/json').read().decode())
except Exception as e:
    print(f"Error: Cannot connect to Chrome CDP on port {CDP_PORT}: {e}")
    sys.exit(1)

# Find an existing X tab
target = None
for t in tabs:
    if 'x.com' in t.get('url', '').lower():
        target = t
        break

if not target:
    print("Error: No Chrome X tab found. Open x.com in Chrome first.")
    sys.exit(1)

ws_url = target['webSocketDebuggerUrl']

# ── Navigate to profile ──────────────────────────────────────────────
ws = websocket.create_connection(ws_url, timeout=30)
cmd = {"id": 1, "method": "Page.navigate", "params": {"url": PROFILE_URL}}
ws.send(json.dumps(cmd))
resp = ws.recv()
print(f"📞 Navigating to {PROFILE_URL}...")

# Wait for initial page load
time.sleep(6)

# Scroll to trigger lazy-loaded content (followers, tweets)
for scroll_cmd in [
    {"id": 10, "method": "Runtime.evaluate", "params": {"expression": "window.scrollTo(0, 400)"}},
    {"id": 11, "method": "Runtime.evaluate", "params": {"expression": "window.scrollTo(0, 800)"}},
    {"id": 12, "method": "Runtime.evaluate", "params": {"expression": "window.scrollTo(0, 0)"}},
]:
    ws.send(json.dumps(scroll_cmd))
    try:
        ws.recv()
    except:
        pass

time.sleep(4)  # Wait for dynamic content after scroll

# ── Extract profile data ─────────────────────────────────────────────
EXTRACT_JS = """
(function() {
    function parseNum(val) {
        if (!val) return 0;
        var str = String(val).toUpperCase().replace(/,/g, '').trim();
        if (str.endsWith('K')) return parseFloat(str) * 1000;
        if (str.endsWith('M')) return parseFloat(str) * 1000000;
        if (str.endsWith('B')) return parseFloat(str) * 1000000000;
        return parseInt(str) || 0;
    }

    var data = {
        username: null,
        displayName: null,
        verified: false,
        verifiedType: null,
        followers: 0,
        following: 0,
        bio: null,
        location: null,
        website: null,
        profileImage: null,
        recentTweets: []
    };

    // Username + Display name from UserName component
    var userEl = document.querySelector('[data-testid="UserName"]');
    if (userEl) {
        var spans = userEl.querySelectorAll('span');
        var texts = [];
        spans.forEach(function(s) { if (s.textContent) texts.push(s.textContent); });
        if (texts.length > 0) data.displayName = texts[0].trim();
        for (var i = 0; i < texts.length; i++) {
            if (texts[i].startsWith('@')) {
                data.username = texts[i].replace('@', '').trim();
            }
        }
    }

    // Verified badge
    var verifiedEl = document.querySelector('[data-testid="icon-verified"]') ||
                     document.querySelector('[aria-label="Verified account"]') ||
                     document.querySelector('svg[aria-label*="Verified"]');
    data.verified = !!verifiedEl;
    if (verifiedEl) data.verifiedType = 'blue';

    // Bio
    var bioEl = document.querySelector('[data-testid="UserDescription"]');
    if (bioEl) data.bio = bioEl.innerText.trim();

    // Follow stats - try multiple selector strategies
    var allLinks = document.querySelectorAll('a[href*="/verified_followers"], a[href*="/followers"], a[href*="/following"]');
    allLinks.forEach(function(link) {
        var href = link.getAttribute('href') || '';
        var text = link.textContent || '';
        var match = text.match(/([\\d,\\.]+[KMk]?)\\s*(Followers?|Following)/i);
        if (match) {
            if (match[2].toLowerCase().startsWith('follower')) {
                if (data.followers === 0) data.followers = parseNum(match[1]);
            } else if (match[2].toLowerCase() === 'following') {
                if (data.following === 0) data.following = parseNum(match[1]);
            }
        }
    });

    // Fallback: search spans for follower/following text
    if (data.followers === 0 || data.following === 0) {
        var allSpans = document.querySelectorAll('span');
        allSpans.forEach(function(span) {
            var text = span.textContent || '';
            if (data.followers === 0) {
                var m = text.match(/([\\d,\\.]+[KMk]?)\\s*Followers?/i);
                if (m) data.followers = parseNum(m[1]);
            }
            if (data.following === 0) {
                var m2 = text.match(/([\\d,\\.]+[KMk]?)\\s*Following/i);
                if (m2) data.following = parseNum(m2[1]);
            }
        });
    }

    // Location
    var locationEl = document.querySelector('[data-testid="UserLocation"]');
    if (locationEl) {
        data.location = locationEl.textContent.trim();
    } else {
        var headerItems = document.querySelector('[data-testid="UserProfileHeader_Items"]');
        if (headerItems) {
            var itemSpans = headerItems.querySelectorAll('span');
            itemSpans.forEach(function(s) {
                var t = s.textContent.trim();
                if (t.includes(',') || /\\b(NY|CA|TX|FL|UK|USA|United States)\\b/i.test(t)) {
                    if (!data.location) data.location = t;
                }
            });
        }
    }

    // Website
    var urlEl = document.querySelector('[data-testid="UserUrl"]');
    if (urlEl) {
        data.website = urlEl.textContent.trim();
    } else if (headerItems) {
        var headerLinks = headerItems.querySelectorAll('a[href]');
        headerLinks.forEach(function(a) {
            var href = a.getAttribute('href') || '';
            if (href.startsWith('http') && !href.includes('x.com') && !href.includes('twitter.com')) {
                if (!data.website) data.website = href;
            }
        });
    }

    // Profile image
    var imgEl = document.querySelector('[data-testid="UserAvatar"] img') ||
               document.querySelector('img[src*="profile_images"]');
    if (imgEl) data.profileImage = imgEl.src;

    // Recent tweets (up to 10) - critical for engagement bait detection
    var tweetEls = document.querySelectorAll('[data-testid="tweetText"]');
    tweetEls.forEach(function(el, i) {
        if (i < 10) {
            data.recentTweets.push(el.innerText.substring(0, 300));
        }
    });

    return JSON.stringify(data);
})();
"""

cmd = {"id": 2, "method": "Runtime.evaluate", "params": {"expression": EXTRACT_JS, "returnByValue": True}}
ws.send(json.dumps(cmd))

result = None
start = time.time()
while time.time() - start < 15:
    try:
        msg = ws.recv()
        msg_data = json.loads(msg)
        if msg_data.get("id") == 2:
            result = msg_data
            break
    except:
        continue

ws.close()

if not result:
    print("Error: No response from Chrome CDP")
    sys.exit(1)

result_value = result.get("result", {}).get("result", {}).get("value", "")
if not result_value:
    print("Error: Could not extract profile data")
    sys.exit(1)

try:
    profile = json.loads(result_value)
except json.JSONDecodeError:
    print(f"Error: Could not parse profile data: {result_value[:200]}")
    sys.exit(1)

# ── Output profile data ──────────────────────────────────────────────
print("")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("📊 PROFILE DATA EXTRACTED")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print(f"Username: @{profile.get('username', USERNAME)}")
print(f"Display Name: {profile.get('displayName', 'N/A')}")
print(f"Verified: {'✅ Yes' if profile.get('verified') else '❌ No'}")
print(f"Followers: {profile.get('followers', 0):,}")
print(f"Following: {profile.get('following', 0):,}")
bio_text = profile.get('bio', 'None') or 'None'
print(f"Bio: {bio_text[:200]}{'...' if len(bio_text) > 200 else ''}")
print(f"Location: {profile.get('location', 'N/A')}")
print(f"Website: {profile.get('website', 'N/A')}")
tweets = profile.get('recentTweets', [])
print(f"Recent tweets analyzed: {len(tweets)}")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

# ── Risk Analysis (90-point unified scoring) ──────────────────────────
bio = (profile.get('bio') or '').lower()
display = (profile.get('displayName') or '').lower()
recent_tweets = [t.lower() for t in (profile.get('recentTweets') or [])]
combined = f"{bio} {display}".lower()
tweets_text = ' '.join(recent_tweets).lower()
all_text = f"{combined} {tweets_text}".lower()
followers = profile.get('followers', 0)
following = profile.get('following', 0)

red_flags = []
total_points = 0

# guaranteed_returns (25pts)
if re.search(r'guarantee|100%|risk.?free|can\'?t lose|sure.?thing|guaranteed.?return|safe.?bet', all_text):
    red_flags.append({"flag": "Guaranteed returns language", "points": 25})
    total_points += 25

# giveaway_airdrop (20pts) - includes engagement bait like "I'll pay your rent"
if re.search(r'giveaway|airdrop|free.*token|free.*crypto|claim.*now|give.?away|raffle|pay.*rent|i\'ll pay|drop acct|drop.*details|pick one with|retweet.*win', all_text):
    red_flags.append({"flag": "Giveaway/airdrop promotion", "points": 20})
    total_points += 20

# dm_solicitation (15pts)
if re.search(r'dm.?for|dm.?me|slide.?into|slide.?dm|dm.?to.?join|dm.?lfg|dm.?now|message.?me|hit.?my.?dm|drop.*acct.*details|retweet.*dm', all_text):
    red_flags.append({"flag": "DM solicitation", "points": 15})
    total_points += 15

# free_crypto (15pts) - includes paying for people
if re.search(r'free.*crypto|free.*sol|free.*btc|free.*eth|mining.*reward|passive.*income|stake.*earn|earn.*free|pay.*for.*you|pay.*your.*rent|pay.*now', all_text):
    red_flags.append({"flag": "Free crypto/money offers", "points": 15})
    total_points += 15

# alpha_dm_scheme (15pts)
if re.search(r'private.*alpha|vip.*group|exclusive.*signal|signal.*group|premium.*group|inner.?circle|secret.?group|t\\.me/', all_text):
    red_flags.append({"flag": "Alpha/DM scheme — private group funnel", "points": 15})
    total_points += 15

# unrealistic_claims (10pts)
if re.search(r'\d+x(?!.*size)|100x|1000x|moonshot|to.?the.?moon|get.?rich|lamborghini|financial.?freedom|10x.?100x', all_text):
    red_flags.append({"flag": "Unrealistic profit claims", "points": 10})
    total_points += 10

# download_install (10pts)
if re.search(r'download|install.*app|get.*app|app.?store|play.?store|download.*now', all_text):
    red_flags.append({"flag": "Download/install request", "points": 10})
    total_points += 10

# urgency_tactics (10pts) - includes time-bound engagement bait
if re.search(r'limited.*spot|act.?now|last.?chance|hurry|time.?sensitive|ending.?soon|closing.?soon|few.?left|don\'?t.?wait|fomo|pay.*from.*now.*till|till.*\d+(am|pm)|until.*\d+(am|pm)', all_text):
    red_flags.append({"flag": "Urgency tactics", "points": 10})
    total_points += 10

# emotional_manipulation (10pts)
if re.search(r'you\'?ll.?regret|don\'?t.?miss.?out|life.?changing|once.?in.?lifetime|never.?again|must.?have|opportunity.?of', all_text):
    red_flags.append({"flag": "Emotional manipulation", "points": 10})
    total_points += 10

# low_credibility (10pts)
if following > 0 and followers > 0:
    ratio = following / followers
    if ratio > 2.0 and followers < 5000:
        red_flags.append({"flag": f"Suspicious follower ratio ({following}/{followers:,})", "points": 10})
        total_points += 10
    elif following > 10000 and followers < following * 0.3:
        red_flags.append({"flag": "Engagement pod pattern (following >> followers)", "points": 10})
        total_points += 10
elif followers < 100:
    red_flags.append({"flag": "Very low follower count", "points": 10})
    total_points += 10

# Additional: Telegram link
if re.search(r't\.me/|telegram\.me/', all_text):
    already_alpha = any(f['flag'].startswith('Alpha/DM') for f in red_flags)
    if not already_alpha:
        red_flags.append({"flag": "Telegram link in bio (common scam vector)", "points": 5})
        total_points += 5

# Additional: Marketing/shill
if re.search(r'advertis|market.*agency|promo.*service|shill|paid.*promo|sponsored.*post', all_text):
    red_flags.append({"flag": "Marketing/advertising service (paid shill account)", "points": 5})
    total_points += 5

# Convert 90-point total to 0-10 scale
risk_score = min(total_points / 9, 10)
risk_score_rounded = round(risk_score * 10) / 10

# Risk level
if risk_score >= 7:
    risk_level = "CRITICAL"
elif risk_score >= 5:
    risk_level = "HIGH"
elif risk_score >= 3:
    risk_level = "MEDIUM"
else:
    risk_level = "LOW"

print("")
print("🚨 RED FLAGS:")
if red_flags:
    for f in red_flags:
        print(f"  • {f['flag']} ({f['points']}pts)")
else:
    print("  None detected")

print("")
print(f"📊 Risk Score: {risk_score_rounded}/10 — {risk_level}")
print(f"   Total red flag points: {total_points}/90")
print("")

# Behavioral pattern
if total_points >= 40:
    pattern = "High-probability scam/engagement farming account"
elif total_points >= 25:
    pattern = "Suspicious activity — engagement bait with potential scam indicators"
elif total_points >= 15:
    pattern = "Some concerning patterns — exercise caution"
elif total_points >= 5:
    pattern = "Minor signals detected — verify independently"
else:
    pattern = "No significant scam patterns identified"

print(f"🎯 Behavioral Pattern: {pattern}")

# Disclaimer
print("")
print("⚠️ Educational purposes only. Not financial advice. Not a guarantee of safety.")
print("⚠️ Always do your own due diligence. Scan date: " + time.strftime("%B %d, %Y"))
print("")

# Save JSON report
os.makedirs(f"{WORKSPACE}/output/x_profile_reports", exist_ok=True)
report_file = f"{WORKSPACE}/output/x_profile_reports/{USERNAME}_{int(time.time())}.json"
report = {
    "scan_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "scan_method": "Chrome CDP Browser Automation",
    "profile": profile,
    "analysis": {
        "red_flags": red_flags,
        "total_points": total_points,
        "max_points": 90,
        "risk_score": risk_score_rounded,
        "risk_level": risk_level,
        "behavioral_pattern": pattern
    }
}
with open(report_file, 'w') as f:
    json.dump(report, f, indent=2, default=str)
print(f"📂 Full report saved to: {report_file}")