#!/usr/bin/env python3
"""
TikTok Profile Scanner - OpenClaw Compatible
Scans TikTok profiles for scam patterns using direct HTTP requests
Bypasses browser SSRF policy
No shell variable injection vulnerabilities

v2: Only extracts and scores profile-specific content (bio, display name),
    not the full page HTML which contains template/navigation noise.
"""

import requests
import re
import json
import sys
import os


def extract_profile_content(html: str) -> dict:
    """Extract only the profile-specific content from TikTok page HTML.
    
    Avoids flagging on template text, navigation, sidebar, and ad content
    that appears on every TikTok page regardless of the user.
    """
    profile_text = ""
    display_name = ""
    bio = ""
    
    # Try to extract from JSON-LD or __NEXT_DATA__ which contains structured profile data
    # Method 1: Look for the profile bio in meta tags
    og_desc_match = re.search(
        r'<meta\s+property="og:description"\s+content="([^"]*)"', html
    )
    if og_desc_match:
        bio = og_desc_match.group(1)
    
    # Method 2: Look for the profile title
    og_title_match = re.search(
        r'<meta\s+property="og:title"\s+content="([^"]*)"', html
    )
    if og_title_match:
        display_name = og_title_match.group(1)
    
    # Method 3: Extract from __NEXT_DATA__ JSON blob if present
    next_data_match = re.search(
        r'<script\s+id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL
    )
    if next_data_match:
        try:
            data = json.loads(next_data_match.group(1))
            # Navigate the JSON structure to find user info
            props = data.get("props", {})
            page_props = props.get("pageProps", {})
            user_info = page_props.get("userInfo", {})
            user_detail = user_info.get("user", {})
            
            if not bio:
                bio = user_detail.get("signature", "")
            if not display_name:
                display_name = user_detail.get("nickname", "")
            
            # Also check for stats that indicate bot activity
            stats = user_info.get("stats", {})
            follower_count = stats.get("followerCount", 0)
            following_count = stats.get("followingCount", 0)
            video_count = stats.get("videoCount", 0)
            heart_count = stats.get("heartCount", 0)
            
        except (json.JSONDecodeError, KeyError, TypeError):
            pass
    
    # Method 4: Try extracting from the share metadata section
    if not bio:
        desc_match = re.search(
            r'"signature"\s*:\s*"([^"]*)"', html
        )
        if desc_match:
            bio = desc_match.group(1)
    
    if not display_name:
        nick_match = re.search(
            r'"nickname"\s*:\s*"([^"]*)"', html
        )
        if nick_match:
            display_name = nick_match.group(1)
    
    # Combine only profile-specific text for analysis
    profile_text = f"{display_name} {bio}".strip()
    
    return {
        "display_name": display_name,
        "bio": bio,
        "profile_text": profile_text.lower(),
    }


def scan_tiktok_profile(username: str) -> dict:
    """Scan a TikTok profile and return risks - v2 profile-content-only"""

    url = f"https://www.tiktok.com/@{username}"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }

    red_flags = []
    risk_score = 0
    profile_data = {}

    try:
        response = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
        
        if response.status_code == 404:
            return {
                "status": "error",
                "username": username,
                "error": "Profile not found (404)",
                "risk_score": 0,
                "risk_level": "ERROR",
                "red_flags": [],
                "scan_method": "Direct_HTTP_Request",
                "disclaimer_version": "tiktok-scan-fixed-v2"
            }
        
        content = response.text
        profile = extract_profile_content(content)
        text = profile["profile_text"]
        
        profile_data = {
            "display_name": profile["display_name"],
            "bio": profile["bio"],
        }

        # Only analyze the PROFILE-SPECIFIC text, not the full page

        # Flag 1: Guaranteed returns in bio (25 pts)
        if any(w in text for w in ["guaranteed return", "guaranteed profit", "guaranteed money", "100% return"]):
            red_flags.append("Guaranteed returns")
            risk_score += 25

        # Flag 2: Airdrop/giveaway in bio (20 pts)
        if "airdrop" in text or "giveaway" in text:
            red_flags.append("Airdrop/giveaway language detected")
            risk_score += 20

        # Flag 3: DM solicitation for crypto/alpha (15 pts)
        if "dm" in text and any(w in text for w in ["crypto", "alpha", "signal", "trade", "invest", "pump"]):
            red_flags.append("DM solicitation for crypto/alpha")
            risk_score += 15

        # Flag 4: Free crypto/money in bio (15 pts)
        if any(w in text for w in ["free crypto", "free money", "free token", "free sol", "free btc"]):
            red_flags.append("Free crypto claims")
            risk_score += 15

        # Flag 5: Alpha DM scheme (15 pts)
        if "alpha" in text and "dm" in text:
            red_flags.append("Alpha DM scheme")
            risk_score += 15

        # Flag 6: Unrealistic claims (10 pts)
        if any(w in text for w in ["100x", "1000x", "overnight", "get rich", "millionaire overnight"]):
            red_flags.append("Unrealistic claims")
            risk_score += 10

        # Flag 7: Download/install push (10 pts)
        if any(w in text for w in [".exe", ".apk", "download now", "install now"]):
            red_flags.append("Download/install push")
            risk_score += 10

        # Flag 8: Urgency tactics (10 pts)
        if any(w in text for w in ["act now", "today only", "limited time", "urgent", "hurry"]):
            red_flags.append("Urgency tactics")
            risk_score += 10

        # Flag 9: Emotional manipulation (10 pts)
        if any(w in text for w in ["don't miss out", "fomo", "last chance", "you're losing"]):
            red_flags.append("Emotional manipulation")
            risk_score += 10

        # Flag 10: Low credibility signals (10 pts)
        if any(w in text for w in ["not financial advice", "dyor", "nfa"]) and risk_score >= 15:
            # "Not financial advice" disclaimer on a high-risk profile is itself a red flag
            red_flags.append("Low credibility (disclaimer on risky content)")
            risk_score += 10

        # Scale to 0-10
        risk_score = min(risk_score, 90)  # cap at 90-point system max
        scaled_score = round(risk_score / 9, 1)  # scale to 0-10
        scaled_score = min(scaled_score, 10)
        scaled_score = int(scaled_score) if scaled_score == int(scaled_score) else scaled_score

        # Determine risk level
        if scaled_score >= 7:
            risk_level = "CRITICAL"
        elif scaled_score >= 5:
            risk_level = "HIGH RISK"
        elif scaled_score >= 3:
            risk_level = "MEDIUM RISK"
        elif scaled_score >= 1:
            risk_level = "LOW RISK"
        else:
            risk_level = "LIKELY SAFE"

        result = {
            "status": "success",
            "username": username,
            "profile_url": url,
            "profile_data": profile_data,
            "risk_score": scaled_score,
            "raw_score": risk_score,
            "risk_level": risk_level,
            "red_flags": red_flags,
            "scan_method": "Direct_HTTP_Request",
            "disclaimer_version": "tiktok-scan-fixed-v2"
        }

        return result

    except requests.exceptions.RequestException as e:
        return {
            "status": "error",
            "username": username,
            "error": f"Network error: {str(e)}",
            "risk_score": 0,
            "risk_level": "ERROR",
            "red_flags": [],
            "scan_method": "Direct_HTTP_Request",
            "disclaimer_version": "tiktok-scan-fixed-v2"
        }
    except Exception as e:
        return {
            "status": "error",
            "username": username,
            "error": f"Unexpected error: {str(e)}",
            "risk_score": 0,
            "risk_level": "ERROR",
            "red_flags": [],
            "scan_method": "Direct_HTTP_Request",
            "disclaimer_version": "tiktok-scan-fixed-v2"
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 tiktok-scan-fixed.py <username>")
        print("\nExample:")
        print("  python3 tiktok-scan-fixed.py investment_chat_dm")
        print("\nWithout @ prefix:")
        print("  python3 tiktok-scan-fixed.py @investment_chat_dm")
        sys.exit(1)

    username = sys.argv[1]
    if username.startswith("@"):
        username = username[1:]

    result = scan_tiktok_profile(username)
    print(json.dumps(result, indent=2))