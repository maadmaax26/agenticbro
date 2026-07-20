#!/usr/bin/env python3
"""
Improved CDP harvester.
"""

import json
import time
import websocket
import urllib.request

WIPO_URL = "https://www.wipo.int/amc/en/domains/search/"

def connect_cdp(port=18801):
    with urllib.request.urlopen(f"http://localhost:{port}/json") as response:
        tabs = json.loads(response.read())
    ws_url = tabs[0]["webSocketDebuggerUrl"]
    ws = websocket.create_connection(ws_url, timeout=10)
    return ws

def send(ws, method, params=None, timeout=10):
    msg_id = int(time.time() * 1000)
    msg = {"id": msg_id, "method": method}
    if params:
        msg["params"] = params
    ws.send(json.dumps(msg))

    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = json.loads(ws.recv())
            if resp.get("id") == msg_id:
                return resp
        except:
            pass
    return {"error": "timeout"}

def main():
    print("[cdp] Connecting...")
    try:
        ws = connect_cdp()
    except Exception as err:
        print("[cdp] Connection failed:", err)
        return

    print("[cdp] Connected.")
    send(ws, "Page.enable")
    send(ws, "Runtime.enable")

    print("[cdp] Navigating...")
    send(ws, "Page.navigate", {"url": WIPO_URL})
    time.sleep(8)

    print("[cdp] Extracting links...")
    expr = 'Array.from(document.querySelectorAll("a[href]")).map(a => a.href).filter(h => /D[A-Z]{0,3}\\d{4}-\\d{3,4}/.test(h))'
    result = send(ws, "Runtime.evaluate", {"expression": expr, "returnByValue": True}, timeout=15)

    try:
        links = result["result"]["result"]["value"]
        print("[cdp] Found", len(links), "case links")
        for link in links[:10]:
            print("  ", link)
    except Exception as err:
        print("[cdp] Extraction error:", err)

    ws.close()
    print("[cdp] Done.")

if __name__ == "__main__":
    main()
