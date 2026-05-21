#!/usr/bin/env python3
"""CDP helper: navigate Chrome, get page content, extract profile info and engagement data."""

import json
import sys
import time
import websocket

CDP_PORT = 18801
WS_BASE = f"ws://localhost:{CDP_PORT}"

def get_page_targets():
    import urllib.request
    resp = urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json/list")
    tabs = json.loads(resp.read())
    return [t for t in tabs if t.get("type") == "page"]

def get_first_page_ws():
    tabs = get_page_targets()
    if tabs:
        return tabs[0]["webSocketDebuggerUrl"]
    return None

def cdp_command(ws_url, method, params=None, msg_id=1):
    """Send a CDP command and return the result."""
    ws = websocket.create_connection(ws_url, timeout=15)
    cmd = {"id": msg_id, "method": method}
    if params:
        cmd["params"] = params
    ws.send(json.dumps(cmd))
    result = None
    # Read responses until we get ours
    for _ in range(10):
        try:
            resp = json.loads(ws.recv())
            if resp.get("id") == msg_id:
                result = resp
                break
        except:
            break
    ws.close()
    return result

def navigate_and_get_dom(ws_url, url, wait=4):
    """Navigate to URL and return the page DOM content."""
    ws = websocket.create_connection(ws_url, timeout=20)
    msg_id = 1
    
    # Enable Page events
    ws.send(json.dumps({"id": msg_id, "method": "Page.enable"}))
    ws.recv()
    msg_id += 1
    
    # Navigate
    ws.send(json.dumps({"id": msg_id, "method": "Page.navigate", "params": {"url": url}}))
    nav_result = None
    for _ in range(20):
        try:
            resp = json.loads(ws.recv())
            if resp.get("id") == msg_id:
                nav_result = resp
                break
        except:
            pass
    
    # Wait for page load
    time.sleep(wait)
    
    # Get DOM content
    msg_id += 1
    ws.send(json.dumps({"id": msg_id, "method": "Runtime.evaluate", "params": {
        "expression": "document.body.innerText",
        "returnByValue": True
    }}))
    
    dom_result = None
    for _ in range(20):
        try:
            resp = json.loads(ws.recv())
            if resp.get("id") == msg_id:
                dom_result = resp
                break
        except:
            pass
    
    ws.close()
    
    if dom_result and "result" in dom_result:
        return dom_result["result"].get("result", {}).get("value", "")
    return ""

def scroll_page(ws_url, pixels=2000, wait=2):
    """Scroll down on the current page."""
    ws = websocket.create_connection(ws_url, timeout=10)
    msg_id = 1
    ws.send(json.dumps({"id": msg_id, "method": "Runtime.evaluate", "params": {
        "expression": f"window.scrollBy(0, {pixels})",
        "returnByValue": True
    }}))
    for _ in range(5):
        try:
            resp = json.loads(ws.recv())
            if resp.get("id") == msg_id:
                break
        except:
            pass
    ws.close()
    time.sleep(wait)

def click_element(ws_url, selector, wait=3):
    """Click an element using a CSS selector."""
    ws = websocket.create_connection(ws_url, timeout=10)
    msg_id = 1
    ws.send(json.dumps({"id": msg_id, "method": "Runtime.evaluate", "params": {
        "expression": f"document.querySelector('{selector}')?.click(); 'clicked'",
        "returnByValue": True
    }}))
    for _ in range(5):
        try:
            resp = json.loads(ws.recv())
            if resp.get("id") == msg_id:
                break
        except:
            pass
    ws.close()
    time.sleep(wait)

if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "help"
    
    if action == "navigate":
        url = sys.argv[2]
        wait = int(sys.argv[3]) if len(sys.argv) > 3 else 4
        ws_url = get_first_page_ws()
        if ws_url:
            content = navigate_and_get_dom(ws_url, url, wait)
            print(content[:8000])
        else:
            print("ERROR: No Chrome page found")
    
    elif action == "scroll":
        pixels = int(sys.argv[2]) if len(sys.argv) > 2 else 2000
        ws_url = get_first_page_ws()
        if ws_url:
            scroll_page(ws_url, pixels)
            # Get updated content
            ws = websocket.create_connection(ws_url, timeout=10)
            ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {
                "expression": "document.body.innerText",
                "returnByValue": True
            }}))
            for _ in range(10):
                try:
                    resp = json.loads(ws.recv())
                    if resp.get("id") == 1:
                        print(resp.get("result", {}).get("result", {}).get("value", "")[:8000])
                        break
                except:
                    pass
            ws.close()
    
    elif action == "click":
        selector = sys.argv[2]
        wait = int(sys.argv[3]) if len(sys.argv) > 3 else 3
        ws_url = get_first_page_ws()
        if ws_url:
            click_element(ws_url, selector, wait)
    
    elif action == "content":
        ws_url = get_first_page_ws()
        if ws_url:
            ws = websocket.create_connection(ws_url, timeout=10)
            ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {
                "expression": "document.body.innerText",
                "returnByValue": True
            }}))
            for _ in range(10):
                try:
                    resp = json.loads(ws.recv())
                    if resp.get("id") == 1:
                        print(resp.get("result", {}).get("result", {}).get("value", "")[:10000])
                        break
                except:
                    pass
            ws.close()
    
    elif action == "extract":
        # Extract specific data using JS
        js_expr = sys.argv[2]
        ws_url = get_first_page_ws()
        if ws_url:
            ws = websocket.create_connection(ws_url, timeout=10)
            ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {
                "expression": js_expr,
                "returnByValue": True
            }}))
            for _ in range(10):
                try:
                    resp = json.loads(ws.recv())
                    if resp.get("id") == 1:
                        print(resp.get("result", {}).get("result", {}).get("value", "")[:10000])
                        break
                except:
                    pass
            ws.close()
    
    else:
        print("Usage: cdp-helper.py [navigate|scroll|click|content|extract] [args]")