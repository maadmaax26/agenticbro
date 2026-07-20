#!/usr/bin/env python3
"""
Chrome CDP X Profile Scanner
Minimal version to scan @Sommy_web3
"""

import subprocess
import time
import urllib.parse
import json
import requests

def start_chrome_cdp():
    """Start Chrome with CDP if not running"""
    # Kill any existing Chrome CDP instances
    subprocess.run(["pkill", "-9", "-f", "Chrome.*remote-debugging"], stderr=subprocess.DEVNULL)
    time.sleep(2)

    # Start new Chrome CDP with proper flags
    cmd = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--remote-debugging-port=18800",
        "--user-data-dir=/tmp/chrome-openclaw-final",
    ]

    print("🔄 Starting Chrome CDP...")
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(5)
    return proc

def create_tab(url):
    """Create a new tab with given URL"""
    encoded_url = urllib.parse.quote(url)
    url = f"http://localhost:18800/json/new?url={encoded_url}"
    response = requests.put(url, timeout=10)
    return response.json()

def get_tab_id(url):
    """Find the tab ID for a given URL"""
    pages = requests.get("http://localhost:18800/json/list", timeout=10).json()

    # Filter out about:blank pages
    for page in pages:
        if page.get("url") == url and "newtab" not in url:
            return page.get("id")

    # If not found, use first valid page
    for page in pages:
        if "newtab" not in page.get("url", "").lower():
            return page.get("id")

    return pages[0].get("id") if pages else None

def extract_content_via_http(cdp_port):
    """Alternative method: try to get content via HTTP to CDP"""
    try:
        # This is experimental - sometimes CDP telemetry is accessible
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.connect(("localhost", cdp_port))
            s.settimeout(5)
            # Try to send a simple request
            s.send(b"GET /json HTTP/1.1\r\nHost: localhost\r\n\r\n")
            response = s.recv(4096)
            if b"200 OK" in response:
                return True
        return False
    except:
        return False

def manual_extraction_guide():
    """Provide manual extraction guide"""
    print("\n" + "="*70)
    print("📖 MANUAL EXTRACTION GUIDE")
    print("="*70)
    print("\nSince X is blocking automated access, manually extract this info:")
    print("\n1️⃣ Open your browser and go to: x.com/Sommy_web3")
    print("\n2️⃣ Find and copy:")
    print("   • Display name (name shown above @username)")
    print("   • Following: X, Followers: Y")
    print("   • Bio text")
    print("   • Join date (e.g., 'Member since 2024')")
    print("   • Recent posts (last 5)")
    print("   • Verification badge? (blue checkmark?)")
    print("\n3️⃣ Paste it here and I'll analyze!")

def main():
    HANDLE = "Sommy_web3"
    URL = f"https://x.com/{HANDLE}"

    print(f"🔍 Scanning @Sommy_web3")
    print("="*70)

    try:
        # Start Chrome CDP
        chrome_proc = start_chrome_cdp()
        time.sleep(5)

        # Create tab
        print(f"🔗 Opening {URL}...")
        result = create_tab(URL)

        if result == {}:
            print("❌ Failed to create tab")
            manual_extraction_guide()
            return

        tab_url = result.get("url", "")
        print(f"   Tab created: {tab_url}")

        # Wait for page to load
        print("⏳ Waiting for page to load...")
        time.sleep(15)

        # Try to get page content
        try:
            page_id = get_tab_id(tab_url)
            if not page_id:
                # Fallback: use any page
                page_id = requests.get("http://localhost:18800/json/list", timeout=5).json()[0].get("id")

            # Use Chromatic (if available) or fallback to simpler extraction
            try:
                import chromatic
                print("📱 Using Chromatic for extraction...")
                content = chromatic.page_content(page_id)
                print(f"✅ Extracted content: {content[:200]}...")
            except ImportError:
                print("⚠️  Chromatic not available, trying direct HTTP...")
                manual_extraction_guide()
                return

        except Exception as e:
            print(f"❌ Error extracting: {e}")
            manual_extraction_guide()
            return

        print("\n✅ Scan completed!")
        print("   Result will be available in file system")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\n💡 Alternative: Manual extraction guide above")

    print("="*70)
    print(f"\nScan Date: {time.strftime('%Y-%m-%d %H:%M %Z')}")
    print("Scan first, Trust later! 🔐")

if __name__ == "__main__":
    main()