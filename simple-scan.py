#!/usr/bin/env python3
"""
Fallback X profile scanner - simpler method without WebSocket
Uses multiple sources to extract profile information
"""

import requests
from datetime import datetime
import re

HANDLE = "Sommy_web3"
SESSION = requests.Session()
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.116 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
]

def get_browser_headers():
    """Get fresh headers for each request"""
    return {
        'User-Agent': USER_AGENTS[len(SESSION.cookies) % len(USER_AGENTS)],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }

def fetch_from_domain(domain, path):
    """Fetch page content from domain with browser headers"""
    try:
        url = f"https://{domain}{path}"
        response = SESSION.get(url, headers=get_browser_headers(), timeout=10, allow_redirects=True)
        if response.status_code == 200:
            return response.text
        return None
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def extract_profile_data(html: str) -> dict:
    """Extract profile data from HTML using regex patterns"""
    data = {
        'handle': HANDLE,
        'display_name': '',
        'followers': 0,
        'following': 0,
        'posts': 0,
        'bio': '',
        'location': '',
        'verified': False,
        'account_age': ''
    }

    # Try various HTML structures and data attributes
    html_lower = html.lower()

    # Check for verified badge
    data['verified'] = 'icon-verified' in html_lower or 'verified.svg' in html_lower

    # Try to extract followers using various patterns
    follower_patterns = [
        r'<span class="css-1dbjc4n r-1p02bjf r-13qz1uu r-18u37iz r-sdzlij r-1s528n r-1ny4l3l">(\d+[,.]?\d*) followers</span>',
        r'followers">\s*(\d+[,.]?\d*)</span>',
        r'class="css-901oao r-18u37iz r-1b00rye r-1h0z5md r-d9yicf r-1q142lx">(\d+[,.]?\d*) Followers</span>',
        r'"followers":\s*"(\d+[,.]?\d*)"',
    ]

    for pattern in follower_patterns:
        matches = re.findall(pattern, html_lower)
        if matches:
            try:
                followers = float(matches[0].replace(',', '').replace('.', ''))
                if followers >= 10:  # Only meaningful followers
                    data['followers'] = int(followers)
                    break
            except:
                pass

    # Try to extract following
    following_patterns = [
        r'following">\s*(\d+[,.]?\d*)</span>',
        r'"following":\s*"(\d+[,.]?\d*)"',
    ]

    for pattern in following_patterns:
        matches = re.findall(pattern, html_lower)
        if matches:
            try:
                following = float(matches[0].replace(',', '').replace('.', ''))
                if following >= 10:
                    data['following'] = int(following)
                    break
            except:
                pass

    # Extract display name (usually in h1 tag)
    name_patterns = [
        r'<h1[^>]*class="[^"]*css-1dbjc4n[^"]*"[^>]*>([^<]+)</h1>',
        r'<h1[^>]*role="heading"[^>]*>([^<]+)</h1>',
        r'<h1[^>]*>([\w\.]+)</h1>',
    ]

    for pattern in name_patterns:
        matches = re.findall(pattern, html)
        if matches:
            data['display_name'] = matches[0].strip().strip('.').strip()
            break

    # Extract bio from meta description or in-profile text
    bio_patterns = [
        r'<meta name="description" content="([^"]+)"',
        r'class="css-901oao r-18u37iz r-1p0dtai r-1d2f490 r-u8s1d r-xoduu5 r-eqz5dr r-16y2uox r-1wbh5a2 r-1udh08x r-11c0sue r-qvutc0">([^<]+)<',
        r'class="css-901oao r-18u37iz r-1p0dtai r-1d2f490 r-u8s1d r-xoduu5 r-eqz5dr r-16y2uox r-1wbh5a2 r-1udh08x">([^<]+)<',
    ]

    for pattern in bio_patterns:
        matches = re.findall(pattern, html)
        if matches:
            bio = matches[0].strip()
            if len(bio) < 500:  # Reasonable bio length
                data['bio'] = bio
                break

    # Extract location
    loc_patterns = [
        r'location[^>]*>([^<]+)</span>',
        r'location":"([^"]+)"',
    ]

    for pattern in loc_patterns:
        matches = re.findall(pattern, html)
        if matches:
            data['location'] = matches[0].strip()
            break

    # Extract account age joined info
    age_patterns = [
        r'joined[^>]*>([^<]+)<',
    ]

    for pattern in age_patterns:
        matches = re.findall(pattern, html)
        if matches:
            data['account_age'] = matches[0].strip()
            break

    # Extract post count
    post_patterns = [
        r'posts">\s*(\d+[,.]?\d*)</span>',
        r'"posts":\s*"(\d+[,.]?\d*)"',
    ]

    for pattern in post_patterns:
        matches = re.findall(pattern, html_lower)
        if matches:
            try:
                posts = float(matches[0].replace(',', '').replace('.', ''))
                if posts > 0:
                    data['posts'] = int(posts)
                    break
            except:
                pass

    return data

def analyze_red_flags(profile_data: dict) -> dict:
    """Analyze for scam red flags"""
    bio = profile_data.get('bio', '').lower()
    display_name = profile_data.get('display_name', '').lower()
    followers = profile_data.get('followers', 0)

    red_flags = []
    scam_type = None

    # Standard pattern matches
    crypto_patterns = {
        'crypto': ['crypto', 'bitcoin', 'ethereum', 'bitcoin', 'cryptocurrency', 'token', 'tokenomics'],
        'investment': ['invest', 'investment', 'portfolio', 'trading', 'profit', 'return', 'alpha'],
        'suspicious': ['free', 'gift', 'giveaway', 'win', 'lottery', 'luck', 'lucky'],
        'urgent': ['urgent', 'act now', 'limited time', 'don\'t miss', 'today only', 'expires', 'hot'],
        'guaranteed': ['guaranteed', 'sure thing', '100%', 'risk-free'],
    }

    # Check crypto mentions
    if not profile_data.get('verified') and followers > 5000:
        red_flags.append("UNVERIFIED_LARGE_ACCOUNT")
    if followers > 0 and followers < 10:
        red_flags.append("SUSPICIOUSLY_LOW_FOLLOWER_COUNT")
    if followers > 0 and followers < 1000 and followers > 50:
        red_flags.append("LOW_FOLLOWER_COUNT")

    for keyword in crypto_patterns['crypto']:
        if keyword in bio or keyword in display_name:
            red_flags.append(f"CRYPTO_KEYWORD '{keyword.upper()}'")
            break

    for keyword in crypto_patterns['investment']:
        if keyword in bio:
            red_flags.append(f"INVESTMENT_KEYWORD '{keyword.upper()}'")
            scam_type = "Investment/Fraud"
            break

    for keyword in crypto_patterns['urgent']:
        if keyword in bio:
            red_flags.append("URGENCY_KEYWORD")
            scam_type = scam_type or "Urgency Tactics"
            break

    for keyword in crypto_patterns['suspicious']:
        if keyword in bio:
            red_flags.append("DUPLICITY_KEYWORD")
            scam_type = scam_type or "Suspicious Messages"
            break

    for keyword in crypto_patterns['guaranteed']:
        if keyword in bio:
            red_flags.append("GUARANTEE CLAIM")
            scam_type = scam_type or "Unrealistic Returns"
            break

    # Check for promise language in display name or bio
    promise_keywords = ['to', 'for', 'get', 'win', 'earn', 'invest']
    value_keywords = ['crypto', 'money', 'usdc', 'sol', 'bitcoin', 'btc']
    promises = []
    for kw in promise_keywords:
        if kw in bio:
            # Check if there's a value keyword after the promise
            after_promise = bio.split(kw)[1] if kw in bio else ''
            for vk in value_keywords:
                if vk in after_promise:
                    promises.append(f"{kw.upper()} {vk.upper()}")
                    break

    if len(promises) >= 2:
        red_flags.append("MANY_PROMISES")
        scam_type = scam_type or "Promissory Fraud"

    # Build risk score
    base_score = len([f for f in red_flags if f in ['UNVERIFIED_LARGE_ACCOUNT', 'SUSPICIOUSLY_LOW_FOLLOWER_COUNT', 'SUSPICIOUSLY_LOW_FOLLOWER_COUNT', 'CRYPTO_KEYWORD', 'INVESTMENT_KEYWORD', 'SUSPICIOUS_MESSAGES', 'MANY_PROMISES', 'PROMISE_PATTEN']])
    urgency_bonus = 2 if 'URGENCY_KEYWORD' in red_flags else 0
    guarantee_bonus = 2 if 'GUARANTEE CLAIM' in red_flags else 0

    risk_score = base_score * 1.0 + urgency_bonus + guarantee_bonus

    # Special cases
    if 'CRYPTO_KEYWORD' in red_flags and 'INVESTMENT_KEYWORD' in red_flags:
        risk_score += 3
        scam_type = scam_type or "Crypto Investment Scam"

    if base_score >= 3 and len(red_flags) >= 4:
        risk_score = min(risk_score, 9)  # Max score

    risk_score = round(risk_score, 1)

    # Determine verification level
    if risk_score >= 7:
        verification_level = "CRITICAL"
    elif risk_score >= 5:
        verification_level = "HIGH RISK"
    elif risk_score >= 3:
        verification_level = "MEDIUM RISK"
    elif risk_score >= 1:
        verification_level = "LOW RISK"
    else:
        verification_level = "LIKELY SAFE"

    return {
        'red_flags': red_flags,
        'risk_score': risk_score,
        'verification_level': verification_level,
        'scam_type': scam_type if scam_type else ('Unidentified' if not red_flags else 'Profile Scam Suspicion')
    }

def main():
    print(f"🔍 Scanning @{HANDLE}")
    print("="*70)

    # Try to fetch the profile page
    url = f"https://x.com/{HANDLE}"
    print(f"🔗 Fetching: {url}")
    print("⏳ This may take a moment due to rate limiting...\n")

    html = fetch_from_domain("x.com", f"/{HANDLE}")

    if not html or "This account doesn't exist" in html:
        print("❌ Account not found or could not be accessed")
        return

    # Extract profile data
    profile_data = extract_profile_data(html)

    print(f"📋 Profile Data:")
    print(f"   Handle: @{profile_data['handle']}")
    print(f"   Display Name: {profile_data['display_name'] or 'Not found'}")
    print(f"   Bio: {(profile_data['bio'][:200] + '...') if profile_data['bio'] else 'Not found'}")
    if profile_data['bio']:
        word_count = len(profile_data['bio'].split())
        print(f"   Bio length: {word_count} words")
    print(f"   Followers: {profile_data['followers']:,}")
    print(f"   Following: {profile_data['following']:,}")
    print(f"   Posts: {profile_data['posts']}")
    print(f"   Location: {profile_data['location'] or 'Not found'}")
    print(f"   Verified: {'✅ Yes' if profile_data['verified'] else '❌ No'}")
    print(f"   X URL: https://x.com/{HANDLE}")

    print(f"\n🚨 Red Flags Detected:")

    # Analyze red flags
    risk_analysis = analyze_red_flags(profile_data)

    for idx, flag in enumerate(risk_analysis['red_flags'], 1):
        print(f"   {idx}. ⚠️ {flag}")

    print(f"\n📊 Risk Assessment:")
    print(f"   Risk Score: {risk_analysis['risk_score']}/10")
    print(f"   Risk Level: {risk_analysis['verification_level']}")
    if risk_analysis['scam_type'] and risk_analysis['scam_type'] != 'Unidentified':
        print(f"   Scam Type: {risk_analysis['scam_type']}")

    # Conclusion
    print(f"\n{'='*70}")
    print(f"\n📝 Conclusion:")

    if risk_analysis['risk_score'] >= 7:
        conclusion = (
            f"⚠️ AI HIGH WARNING PRIORITY — Detection of potential insider risk. "
            f"{risk_analysis['verification_level'].lower()}: "
            f"Proceed with extreme caution, verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump"
        )
    elif risk_analysis['risk_score'] >= 5:
        conclusion = (
            f"⚠️ AI STRONG CAUTION REQUIRED — Red flags detected. "
            f"Verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump. "
            f"Proceed with caution."
        )
    elif risk_analysis['risk_score'] >= 3:
        conclusion = (
            f"⚠️ AI MEDIUM CAUTION — Some indicators suggest verification needed. "
            f"Verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump. "
            f"Confirm identity before engaging."
        )
    else:
        conclusion = (
            f"✅ AI LIKELY SAFE — Based on available data, appears legitimate. "
            f"Always verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump. "
            f"Trust but verify."
        )

    print(f"   {conclusion}")

    # Recommendations
    print(f"\n💡 Recommendations:")
    if risk_analysis['risk_score'] >= 7:
        recs = [
            "• ❌ NOT SAFE for investment",
            "• Independent verification highly recommended",
            "• Verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
            "• Cross-check with other sources",
            "• Never send USDC or SOL without verification",
            "• Report if you identify this as a scam"
        ]
    elif risk_analysis['risk_score'] >= 5:
        recs = [
            "• Proceed with extreme caution",
            "• Verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
            "• Cross-check with other sources",
            "• Be skeptical of all promises"
        ]
    elif risk_analysis['risk_score'] >= 3:
        recs = [
            "• Consider additional verification",
            "• Verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
            "• Research their claims independently"
        ]
    else:
        recs = [
            "• Based on available data, appears legitimate",
            "• Always verify contract address",
            "• Do your own research"
        ]

    for rec in recs:
        print(f"   {rec}")

    print(f"\n{'='*70}")
    print(f"Scan Date: {datetime.now().strftime('%Y-%m-%d %H:%M %Z')}")
    print(f"{'='*70}")
    print(f"\nScan first, Trust later! 🔐")

if __name__ == "__main__":
    main()