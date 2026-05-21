#!/usr/bin/env python3
"""Fix TikTok scanner disclaimer to be comprehensive"""

# Read the file
with open('/Users/efinney/.openclaw/workspace/scripts/tiktok-scan-fixed.py', 'r') as f:
    content = f.read()

# Find and replace the simple disclaimer section
old_disclaimer = '''        print(f"⚠️  DISCLAIMER NOTICE")
        print(f"This scan is an AI-powered threat assessment of social media content.")
        print(f"For complete accuracy, verify information through multiple sources.\n")

        print(f"INDEPENDENT VERIFICATION REQUIRED:")
        print(f"• Cross-check username across multiple platforms")
        print(f"• Never send money or share private keys\n")

        print(f"{'='*70}")
        print(f"┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓")
        print(f"┃                    ⚠️  DISCLAIMER NOTICE ⚠️                       ┃")
        print(f"┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n")'''

# New comprehensive disclaimer
new_disclaimer = '''        print(f"⚠️  DISCLAIMER NOTICE")
        print(f"This scan is an AI-powered threat assessment of social media content.")
        print(f"For complete accuracy, verify information through multiple sources.")
        print(f"\n")
        print(f"LIMITATIONS:")
        print(f"• Only scans public profile data")
        print(f"• Does NOT verify user identity")
        print(f"• May miss sophisticated, well-hidden scams")
        print(f"• Scans HTML/timestamp - not reliable for all assets")
        print(f"• Subject to website rules and rate limiting")
        print(f"\n")
        print(f"INDEPENDENT VERIFICATION REQUIRED:")
        print(f"• Cross-check username across multiple platforms")
        print(f"• Verify contract addresses manually")
        print(f"• Beware of guaranteed returns or insider information")
        print(f"• Never send money or share private keys")
        print(f"\n")
        print(f"{'='*70}")
        print(f"┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓")
        print(f"┃                    ⚠️  DISCLAIMER NOTICE ⚠️                       ┃")
        print(f"┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n")'''

# Replace
if old_disclaimer in content:
    content = content.replace(old_disclaimer, new_disclaimer)
    print("✅ Changed disclaimer from simple to comprehensive format")
else:
    print("❌ Could not find disclaimer section")
    # Try to find what we do have
    if "LIMITATIONS:" in content:
        print("   LIMITATIONS: section already present")
    else:
        print("   LIMITATIONS: section NOT found")

# Write back
with open('/Users/efinney/.openclaw/workspace/scripts/tiktok-scan-fixed.py', 'w') as f:
    f.write(content)

print("✅ TikTok scanner disclaimer updated")