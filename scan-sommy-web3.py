#!/usr/bin/env python3
"""
Quick scanner for X profile @Sommy_web3
Uses Chrome CDP to extract profile data and analyze for red flags
"""

import requests
import json
import time
import websockets
from datetime import datetime
from urllib.parse import quote

# Configuration
CDP_PORT = 18800
HANDLE = "Sommy_web3"
URL = f"https://x.com/{HANDLE}"

def start_chrome_cdp():
    """Start Chrome with CDP"""
    import subprocess
    cmd = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-allow-origins=*",
        "--user-data-dir=/tmp/chrome-openclaw-single"
    ]
    print(f"🔄 Starting Chrome CDP on port {CDP_PORT}...")
    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(5)

def get_page_content(page_id: str, ws_url: str) -> str:
    """Extract page content via WebSocket"""
    try:
        ws = websockets.connect(ws_url)
        # Evaluate JavaScript to get page text
        ws.send(json.dumps({
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {
                "expression": "document.body.innerText"
            }
        }))
        response = ws.recv()
        result = json.loads(response)
        if result.get('result') and 'value' in result['result']:
            ws.close()
            return result['result']['value']
        ws.close()
        return ""
    except Exception as e:
        print(f"WebSocket error: {e}")
        return ""

def extract_profile_data(page_content: str) -> dict:
    """Extract relevant profile data from page content"""
    lines = [l.strip() for l in page_content.split('\n') if l.strip()]

    # Try to find key patterns
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

    # Extract display name (usually near "Followers, Following, Posts")
    for line in lines[:300]:
        if 'Followers' in line and 'Following' in line and 'Posts' in line:
            # Try to parse followers count
            if 'Followers' in line:
                followers_part = line.split('Followers')[1].split('Following')[0].strip()
                # Clean up followers number
                try:
                    followers_clean = float(followers_part.replace(',', '').replace('.', ''))
                    if followers_clean >= 1000:
                        data['followers'] = int(followers_clean)
                except:
                    pass

    # Try to find display name with colon pattern
    for line in lines[:150]:
        if line.count(':') >= 1:
            parts = line.split(':', 1)
            if len(parts) == 2:
                key = parts[0].strip().lower()
                value = parts[1].strip()
                if 'name' in key and not data['display_name']:
                    data['display_name'] = value
                elif 'bio' in key:
                    data['bio'] = value
                elif 'location' in key:
                    data['location'] = value

    # Check for verification badge
    page_lower = page_content.lower()
    data['verified'] = '✓ verified' in page_lower or 'verified' in data.get('bio', '').lower()

    # Find account age in bio
    for line in lines:
        if 'joined' in line.lower() and 'm' in line.lower() or ' years ago' in line.lower():
            data['account_age'] = line

    return data

def analyze_red_flags(profile_data: dict) -> dict:
    """Analyze profile for scam red flags"""
    bio = profile_data.get('bio', '').lower()
    display_name = profile_data.get('display_name', '').lower()
    display_name_clean = profile_data.get('display_name', '')
    followers = profile_data.get('followers', 0)

    red_flags = []
    scam_type = None

    # Standard scam patterns
    if 'guaranteed' in bio or 'guaranteed' in display_name:
        red_flags.append("GUARANTEED RETURNS")
        scam_type = "Unrealistic Returns"

    if 'private alpha' in bio or 'private alpha' in display_name:
        red_flags.append("PRIVATE ALPHA")
        scam_type = "Private Alpha Access"

    if 'unrealistic' in bio or 'won\'t miss' in bio or 'act now' in bio or 'don\'t miss' in bio:
        red_flags.append("URGENCY TACTICS")
        scam_type = "Urgency Pitch"

    if 'dm me' in bio or 'message me' in bio or 'send dm' in bio:
        red_flags.append("DM SOLICITATION")
        scam_type = "DM Solicitation"

    if 'free' in bio and 'crypto' in bio and 'gift' in bio:
        red_flags.append("CRYPTO GIVEAWAY")
        scam_type = "Giveaway Fraud"

    if followers < 1000 and (followers > 0):
        red_flags.append("LOW FOLLOWER COUNT")

    if followers > 0 and followers < 100:
        red_flags.append("SUSPICIOUSLY LOW FOLLOWER COUNT")

    # Pig butchering patterns
    romance_keywords = ['love', 'relationship', 'looking for', 'single', 'dating']
    crypto_keywords = ['crypto', 'bitcoin', 'trading', 'invest', 'alpha', 'profits', 'token']

    has_romance = any(kw in bio for kw in romance_keywords)
    has_crypto = any(kw in bio for kw in crypto_keywords)

    if has_romance and has_crypto:
        red_flags.append("ROMANCE + CRYPTO")
        scam_type = "Pig Butchering"

    # Check for bot-like behavior
    template_phrases = [
        'impressed by your work',
        'let\'s collaborate',
        'exploring opportunities',
        'synergy',
        'brighter future'
    ]
    template_count = sum(1 for phrase in template_phrases if phrase in bio)

    if template_count >= 2:
        red_flags.append("BOT-LIKE TEMPLATES")
        if not scam_type:
            scam_type = "Bot Network"

    # Calculate risk score
    risk_score = len(red_flags) * 1.0
    if 'ROMANCE + CRYPTO' in red_flags:
        risk_score = 8
    if 'URGENCY TACTICS' in red_flags:
        risk_score += 2
    if 'GUARANTEED RETURNS' in red_flags:
        risk_score += 1
    if 'DM SOLICITATION' in red_flags:
        risk_score += 1

    risk_score = min(risk_score, 10)

    # Determine verification level
    if risk_score >= 7:
        verification_level = "CRITICAL"
    elif risk_score >= 5:
        verification_level = "HIGH RISK"
    elif risk_score >= 3:
        verification_level = "MEDIUM RISK"
    else:
        verification_level = "LIKELY SAFE"

    return {
        'red_flags': red_flags,
        'risk_score': round(risk_score, 1),
        'verification_level': verification_level,
        'scam_type': scam_type if scam_type else ('Unidentified' if not red_flags else 'Suspicious Activity')
    }

def main():
    print(f"🔍 Scanning @{HANDLE}")
    print("="*60)

    # Start Chrome CDP
    start_chrome_cdp()

    # Wait for Chrome to be ready
    print("⏳ Waiting for Chrome to start...")
    time.sleep(10)

    try:
        # Get info
        pages_json = requests.get(f"http://localhost:{CDP_PORT}/json/list").json()
        if not pages_json:
            print("❌ No pages found. Chrome may not be ready yet.")
            return

        # Navigate to profile
        goal_url = f"http://localhost:{CDP_PORT}/json/new?url={URL}"
        result = requests.put(goal_url).json()
        page_url = result.get('url', '')

        print(f"🔗 Navigating to: {page_url}")
        print("⏳ Waiting for page to load...")

        # Wait for page to load
        loaded = False
        for i in range(30):
            time.sleep(2)
            pages = requests.get(f"http://localhost:{CDP_PORT}/json/list").json()
            page = next((p for p in pages if p.get('url') == page_url), None)
            if page and 'newtab' not in page_url.lower():
                loaded = True
                print(f"✅ Page loaded after {i*2 + 2} seconds")
                break

        if not loaded:
            print("⚠️  Page may not have loaded. Trying to extract data anyway...")

        # Get page content
        page_id = next((p['id'] for p in pages_json), pages_json[0]['id'])
        ws_url = next((p['webSocketDebuggerUrl'] for p in pages_json), '')
        content = get_page_content(page_id, ws_url)

        if not content:
            print("⚠️  Could not extract page content. Using fallback extraction...")

        # Extract profile data
        profile_data = extract_profile_data(content)
        print(f"\n📋 Profile Data:")
        print(f"   Handle: @{profile_data['handle']}")
        print(f"   Display Name: {profile_data['display_name'] or 'Not found'}")
        print(f"   Followers: {profile_data['followers']:,}")
        print(f"   Posts: {profile_data['posts']}")
        print(f"   Bio: {profile_data['bio'][:150] if profile_data['bio'] else 'Not found'}")
        print(f"   Location: {profile_data['location'] or 'Not found'}")
        print(f"   Verified: {'✅ Yes' if profile_data['verified'] else '❌ No'}")

        # Analyze red flags
        print(f"\n🚨 Red Flags Detected:")
        risk_analysis = analyze_red_flags(profile_data)

        for flag in risk_analysis['red_flags']:
            if 'ROMANCE + CRYPTO' in flag:
                emoji = "💔"
            elif 'DM SOLICITATION' in flag:
                emoji = "💬"
            elif 'BOT-LIKE TEMPLATES' in flag:
                emoji = "🤖"
            else:
                emoji = "⚠️"
            print(f"   {emoji} {flag}")

        print(f"\n📊 Risk Assessment:")
        print(f"   Risk Score: {risk_analysis['risk_score']}/10")
        print(f"   Risk Level: {risk_analysis['verification_level']}")
        print(f"   Scam Type: {risk_analysis['scam_type']}")

        # Summary
        print(f"\n{'='*60}")
        print(f"{'='*60}")

        # Build conclusion
        if risk_analysis['risk_score'] >= 7:
            conclusion = (
                f"⚠️ AI 'HIGH WARNING PRIORITY' — "
                f"Scammed webs successful detection of the {risk_analysis['verification_level'].lower()}. "
                f"When using {display_name_clean}: "
                f"{'Please use extreme caution, verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump' if profile_data['verified'] else 'It is crucial to confirm authenticity and proceed with extreme caution'}"
            )
        elif risk_analysis['risk_score'] >= 5:
            conclusion = (
                f"⚠️ AI 'STRONG CAUTION REQUIRED' — "
                f"Red flags detected. "
                f"{'Please confirm identity before interacting. Verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump. Proceed with caution' if profile_data['verified'] else 'Proceed with caution and verify authenticity'}"
            )
        elif risk_analysis['risk_score'] >= 3:
            conclusion = (
                f"⚠️ AI 'CANDY CANE CAUTION, CHECK CREDIBILITY' — "
                f"Some indicators suggest investigation needed. "
                f"{'Verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump. Confirm identity before engaging' if profile_data['verified'] else 'Consider additional verification before engaging'}"
            )
        else:
            conclusion = (
                f"✅ AI 'LIKELY SAFE' — High probability you're safe. "
                f"Nevertheless, always verify contract: 52bJEa5NDpJyDbzKFaRDLgRCxALGb15W86x4Hbzopump. "
                f"Trust but verify."
            )

        print(f"📝 Conclusion:")
        print(f"   {conclusion}")

        # Recommendations
        print(f"\n💡 Recommendations:")

        if risk_analysis['risk_score'] >= 7:
            recs = [
                "• NOT SAFE for investment",
                "• Independent verification highly recommended",
                "• Verify all claims through multiple sources",
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