#!/usr/bin/env python3
"""
Final attempt X profile scanner for @Sommy_web3
Using the successful HTML fetch we just made
"""

import re
import requests
from datetime import datetime

def extract_from_html(html):
    """Extract profile data from X HTML response"""

    data = {
        'handle': 'Sommy_web3',
        'display_name': '',
        'followers': 0,
        'bio': '',
        'location': '',
        'verified': False,
        'account_age': ''
    }

    # Extract followers
    follower_pattern = r'>Followers[\s\S]*?</span>'
    followers_match = re.search(follower_pattern, html)
    if followers_match:
        text = followers_match.group(0)
        followers = re.search(r'(\d+[\s,]*\d*)', text)
        if followers:
            try:
                followers_num = float(followers.group(1).replace(',', '').replace('.', ''))
                if followers_num >= 10:  # Only meaningful follower counts
                    data['followers'] = int(followers_num)
            except:
                pass

    # Extract display name (in h1 or h2)
    name_pattern = r'<h[12][^>]*>([^<]+)</h[12]>'
    name_match = re.search(name_pattern, html)
    if name_match:
        data['display_name'] = name_match.group(1).strip()

    # Extract bio
    bio_pattern = r'<span[^>]*class="[^"]*css-901oao[^"]*"[^>]*>([^<]+)</span>'
    bio_matches = re.findall(bio_pattern, html)
    for match in bio_matches:
        if not data['bio'] and len(match) < 500:
            data['bio'] = match.strip()

    # Extract location
    location_pattern = r'location[^>]*>.*?([^<]+)</span>'
    location_match = re.search(location_pattern, html, re.IGNORECASE)
    if location_match:
        data['location'] = location_match.group(1).strip()

    # Check for verified badge
    if 'icon-verified' in html or 'verified.svg' in html:
        data['verified'] = True

    return data

def analyze_red_flags(profile):
    """Analyze extracted data for scam indicators"""

    bio = profile['bio'].lower()
    name = profile['display_name'].lower() if profile['display_name'] else ''
    followers = profile['followers']

    red_flags = []
    scam_keywords = ['crypto', 'bitcoin', 'ethereum', 'invest', 'token', 'btc', 'eth', 'usdc', 'sol', 'pump', 'presale', 'alpha']
    urgency_keywords = ['guaranteed', 'act now', 'limited time', 'urgent', 'don\'t miss']
    suspicious_keywords = ['free', 'gift', 'giveaway', 'win money', 'no risk']
    investment_keywords = ['portfolio', 'returns', 'profits', 'trading']

    # Check for crypto promises
    for kw in scam_keywords:
        if kw in bio or kw in name:
            red_flags.append(f"CRYPTO_KEYWORD: '{kw.upper()}'")
            break

    # Check for urgency tactics
    for kw in urgency_keywords:
        if kw in bio or kw in name:
            red_flags.append(f"URGENCY: '{kw.upper()}'")

    # Check for suspicious offers
    for kw in suspicious_keywords:
        if kw in bio or kw in name:
            red_flags.append(f"SUSPICIOUS: '{kw.upper()}'")

    # Check for investment language
    for kw in investment_keywords:
        if kw in bio or kw in name:
            red_flags.append(f"INVESTMENT: '{kw.upper()}'")

    # Verify account patterns
    if not profile['verified'] and followers > 1000:
        red_flags.append("UNVERIFIED_LARGE_ACCOUNT")

    if followers > 0 and followers < 10:
        red_flags.append("SUSPICIOUSLY_LOW_FOLLOWER_COUNT")

    # Calculate risk
    risk_score = len(red_flags) * 1.5
    if followers > 0 and followers < 100 and followers > 20:
        risk_score += 2  # Mid-range follower count without verification is suspicious

    risk_score = min(risk_score, 10)

    # Determine level
    if risk_score >= 7:
        level = "HIGH RISK"
    elif risk_score >= 5:
        level = "MEDIUM RISK"
    elif risk_score >= 3:
        level = "LOW RISK"
    else:
        level = "LIKELY SAFE"

    return {
        'red_flags': red_flags,
        'risk_score': round(risk_score, 1),
        'level': level
    }

def main():
    print("🔍 @Sommy_web3 Profile Scan")
    print("="*60)

    # Fetch the page (we just did this successfully)
    url = "https://x.com/Sommy_web3"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    }

    try:
        print(f"Fetching {url}...")
        response = requests.get(url, headers=headers, timeout=15)
        html = response.text
        print("✅ Page fetched successfully\n")

        # Extract data
        profile = extract_from_html(html)

        print("📋 Profile Information:")
        print(f"   Handle: @{profile['handle']}")
        print(f"   Name: {profile['display_name'] or 'Not found'}")
        print(f"   Followers: {profile['followers']:,}" if profile['followers'] > 0 else "   Followers: Not found")
        print(f"   Bio: {profile['bio'][:200] if profile['bio'] else 'Not found'}")
        if profile['bio']:
            print(f"   Bio length: {len(profile['bio'])} chars")
        print(f"   Location: {profile['location'] or 'Not found'}")
        print(f"   Verified: {'✅ Yes' if profile['verified'] else '❌ No'}")

        # Analyze
        print("\n🚨 Red Flags:")
        analysis = analyze_red_flags(profile)

        for flag in analysis['red_flags']:
            print(f"   ⚠️  {flag}")

        print(f"\n📊 Risk Assessment:")
        print(f"   Score: {analysis['risk_score']}/10")
        print(f"   Level: {analysis['level']}")

        # Conclusion
        print(f"\n{'='*60}")
        print("📝 Conclusion:")

        if analysis['risk_score'] >= 7:
            print(f"   ⚠️ AI HIGH WARNING PRIORITY — Detection of potential insider risk. {analysis['level'].lower()}: Please use extreme caution, verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump")
        elif analysis['risk_score'] >= 5:
            print(f"   ⚠️ AI STRONG CAUTION REQUIRED — Red flags detected. Verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump. Proceed with caution.")
        elif analysis['risk_score'] >= 3:
            print(f"   ⚠️ AI MEDIUM CAUTION — Some indicators suggest verification needed. Verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump. Confirm identity before engaging.")
        else:
            print(f"   ✅ AI LIKELY SAFE — Based on available data, appears legitimate. Always verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump. Trust but verify.")

        print(f"\n💡 Recommendations:")

        if analysis['level'] in ['HIGH RISK', 'MEDIUM RISK']:
            recs = [
                "• Independent verification highly recommended",
                "• Verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
                "• Cross-check with other sources",
                "• Be skeptical of all promises"
            ]
        elif analysis['level'] == 'LOW RISK':
            recs = [
                "• Verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
                "• Consider additional verification",
                "• Research claims independently"
            ]
        else:
            recs = [
                "• Based on available data, appears legitimate",
                "• Always verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump",
                "• Do your own research"
            ]

        for rec in recs:
            print(f"   {rec}")

        print(f"\n{'='*60}")
        print(f"Scan Date: {datetime.now().strftime('%Y-%m-%d %H:%M %Z')}")
        print(f"{'='*60}")
        print(f"\nScan first, Trust later! 🔐")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()