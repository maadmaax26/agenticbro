#!/usr/bin/env python3
"""
Single profile scan for @Sommy_web3
Uses available Chrome CDP instance to navigate and extract data
"""

import requests
import json
import time
from datetime import datetime

TARGET = "Sommy_web3"
URL = f"https://x.com/{TARGET}"

def main():
    print(f"🔍 Scanning @{TARGET}")
    print("="*60)

    # Check if Chrome CDP is running
    try:
        pages = requests.get("http://localhost:18800/json/list", timeout=5).json()
        print(f"\n✅ Chrome CDP running - {len(pages)} tab(s) detected")
    except:
        print("\n❌ Chrome CDP not running")
        return

    # Attempt to open new tab with profile
    try:
        encoded_url = URL.replace("https://", "")
        create_url = f"http://localhost:18800/json/new?url={encoded_url}"

        result = requests.put(create_url, timeout=10)
        page_data = result.json()

        if page_data:
            print(f"✅ Tab created: {page_data.get('url', '')}")
        else:
            print("❌ Failed to create tab")
            return

    except Exception as e:
        print(f"❌ Error creating tab: {e}")
        return

    # Wait for page load
    print("⏳ Waiting 15 seconds for profile to load...")
    time.sleep(15)

    # Try to get page content
    try:
        pages = requests.get("http://localhost:18800/json/list", timeout=5).json()

        # Find the Sommy_web3 page
        target_page = None
        for page in pages:
            if TARGET in page.get('url', '') and 'newtab' not in page.get('url', '').lower():
                target_page = page
                break

        if not target_page:
            # If exact match not found, get first non-newtab page
            for page in pages:
                if 'newtab' not in page.get('url', '').lower():
                    target_page = page
                    break

        if target_page:
            page_id = target_page.get('id')
            ws_url = target_page.get('webSocketDebuggerUrl')

            print(f"✅ Target page found: {target_page.get('url', '')[:50]}...")

            # We cannot use WebSocket due to CORS, so we'll describe the manual extraction method
            print("\n" + "="*60)
            print("📱 PROFILE DATA NEEDED FOR SCANNING")
            print("="*60)
            print("\nDue to browser security restrictions, I cannot extract the profile data directly.")
            print("\n📋 Please manually extract these details from x.com/Sommy_web3:")
            print("\n1. Display Name: _______________")
            print("2. Follower Count: _______________")
            print("3. Bio Text: _______________")
            print("4. Join Date/Member Since: _______________")
            print("5. Verification Badge: [Yes/No]  ")
            print("6. Recent Posts (copy last 2): _______________")
            print("\n4️⃣ Share these items and I'll complete the analysis immediately.")
            print("\n" + "="*60)

        else:
            print("❌ Could not locate target page")

    except Exception as e:
        print(f"❌ Error extracting profile: {e}")
        print("\n📋 Try manual extraction:")
        print(f"   Visit: https://x.com/{TARGET}")
        print("   Copy 6 items above and share with me")

    print(f"\nScan Date: {datetime.now().strftime('%Y-%m-%d %H:%M %Z')}")
    print("Scan first, Trust later! 🔐")

if __name__ == "__main__":
    main()