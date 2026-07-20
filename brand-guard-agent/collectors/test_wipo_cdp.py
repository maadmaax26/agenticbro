#!/usr/bin/env python3
"""
CDP-based WIPO harvester test.
Requires Chrome running with --remote-debugging-port=18801
"""

import json
import urllib.request

CDP = "http://localhost:18801"

def get_ws_url():
    url = CDP + "/json/new"
    with urllib.request.urlopen(url) as response:
        data = response.read()
        tab = json.loads(data)
    return tab["webSocketDebuggerUrl"]

def main():
    print("CDP WIPO test")
    try:
        ws = get_ws_url()
        print("New tab WebSocket URL:", ws)
        print("CDP connection successful.")
    except Exception as err:
        print("CDP error:", err)

if __name__ == "__main__":
    main()