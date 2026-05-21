#!/usr/bin/env python3
"""
Pig Butchering Detection Test Scan
Scans a profile using the pig butchering detection framework
"""

import json
import websocket
import time
from datetime import datetime

def run_pb_scan(handle):
    ws_url = "ws://localhost:18801/devtools/page/3DF00D48DED51E65C6B27F0FA4028A5E"
    ws = websocket.create_connection(ws_url)
    
    # Navigate to profile
    nav_cmd = {"id": 1, "method": "Page.navigate", "params": {"url": f"https://x.com/{handle}"}}
    ws.send(json.dumps(nav_cmd))
    ws.recv()
    time.sleep(12)
    
    # Scroll to load content
    for i in range(3):
        scroll = f"window.scrollTo(0, {(i+1) * 600});"
        ws.send(json.dumps({"id": 2+i, "method": "Runtime.evaluate", "params": {"expression": scroll}}))
        ws.recv()
        time.sleep(2)
    
    # Extract and analyze
    script = open('/Users/efinney/.openclaw/workspace/scripts/pb_scan_script.js').read()
    ws.send(json.dumps({"id": 10, "method": "Runtime.evaluate", "params": {"expression": script}}))
    result = ws.recv()
    parsed = json.loads(result)
    
    if 'result' in parsed and 'result' in parsed['result']:
        profile = json.loads(parsed['result']['result']['value'])
        return profile
    
    ws.close()
    return None

if __name__ == "__main__":
    handle = "raynft_"
    result = run_pb_scan(handle)
    
    if result:
        print("=" * 70)
        print(f"🔍 PIG BUTCHERING DETECTION SCAN — @{handle}")
        print("=" * 70)
        print(f"\nRisk Score: {result['riskScore']:.1f}/10")
        print(f"Risk Level: {result['riskLevel']}")
        print(f"Scam Type: {result['scamType']}")
        print(f"\nRed Flags:")
        for flag in result['redFlags']:
            print(f"  - {flag}")
        print("=" * 70)