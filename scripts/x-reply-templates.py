#!/usr/bin/env python3
"""
X Engagement Monitor — Reply Template Library
Loads and renders contextual reply templates for Agentic Bro engagement.

Templates are categorized by engagement type:
  - scam_victim: Person was scammed → offer free scan
  - safety_question: Person asking if something is legit → scan it for them
  - security_awareness: General security discussion → share tool as resource
  - meme_caution: Cautious about meme coins → highlight utility

Usage:
  python3 /Users/efinney/.openclaw/workspace/scripts/x-reply-templates.py <type> [context]
  python3 /Users/efinney/.openclaw/workspace/scripts/x-reply-templates.py list
  python3 /Users/efinney/.openclaw/workspace/scripts/x-reply-templates.py scam_victim "Solana wallet drained"
"""

import json
import random
import sys
import os

TEMPLATES_FILE = "/Users/efinney/.openclaw/workspace/scripts/reply-templates.json"

def load_templates():
    """Load templates from JSON file"""
    with open(TEMPLATES_FILE, 'r') as f:
        return json.load(f)

def list_types():
    """List available engagement types"""
    templates = load_templates()
    print("\n📋 Available Engagement Types:\n")
    for etype, data in templates.items():
        print(f"  {etype}")
        print(f"    {data['description']}")
        print(f"    Templates: {len(data['templates'])}")
        print()

def render_template(etype, context=""):
    """Render a random template for the given engagement type"""
    templates = load_templates()
    
    if etype not in templates:
        print(f"❌ Unknown type: {etype}")
        print(f"   Available: {', '.join(templates.keys())}")
        return
    
    data = templates[etype]
    template = random.choice(data['templates'])
    
    # Fill in context variables
    result = template
    if context:
        result = result.replace("{context}", context)
    
    # Add disclaimer
    result = result.rstrip()
    if not result.endswith(('🔐', '🔒', '🛡️')):
        result += ' 🔐'
    
    print(f"\n🎯 Engagement Type: {etype}")
    print(f"📝 Description: {data['description']}")
    print(f"✅ Suggested Reply:\n")
    print(result)
    print(f"\n⚠️  IMPORTANT: Customize this reply for the specific post.")
    print(f"   Never copy-paste the exact same message twice.")
    print(f"   Make it genuine, helpful, and contextual.")

def render_all(etype, context=""):
    """Show all templates for an engagement type"""
    templates = load_templates()
    
    if etype not in templates:
        print(f"❌ Unknown type: {etype}")
        return
    
    data = templates[etype]
    
    print(f"\n🎯 Engagement Type: {etype}")
    print(f"📝 Description: {data['description']}")
    print(f"📋 All Templates ({len(data['templates'])}):\n")
    
    for i, template in enumerate(data['templates'], 1):
        result = template
        if context:
            result = result.replace("{context}", context)
        print(f"  {i}. {result}")
        print()

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 x-reply-templates.py <type> [context]")
        print("       python3 x-reply-templates.py list")
        print("       python3 x-reply-templates.py scam_victim \"wallet drained\"")
        print("\nTypes: scam_victim, safety_question, security_awareness, meme_caution, holder_pitch")
        return
    
    command = sys.argv[1]
    
    if command == "list":
        list_types()
    elif command == "all":
        etype = sys.argv[2] if len(sys.argv) > 2 else None
        if etype:
            render_all(etype, " ".join(sys.argv[3:]) if len(sys.argv) > 3 else "")
        else:
            templates = load_templates()
            for t in templates:
                render_all(t)
    else:
        context = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else ""
        render_template(command, context)

if __name__ == "__main__":
    main()