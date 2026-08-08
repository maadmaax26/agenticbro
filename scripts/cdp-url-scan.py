#!/usr/bin/env python3
"""
CDP URL Scanner — JavaScript Detonation Analysis via Chrome CDP
================================================================
Loads a URL in headless Chrome (port 18801), monitors all network requests,
JavaScript execution, and detects in-memory malware patterns with
context-aware scoring to minimize false positives from legitimate libraries.

Detection categories:
- WASM (WebAssembly) payload compilation
- Dynamic code execution (eval, Function constructor)
- Obfuscated payloads (base64, charcode, hex)
- Crypto wallet targeting / drain attempts
- Credential / form theft
- Clipboard hijacking
- Data exfiltration (beacons, suspicious domains)
- DOM injection (hidden iframes, script injection)
- Persistence mechanisms (service workers)
- C2 channels (WebSockets to suspicious endpoints)

Scoring uses context-aware weighting:
- Known library domains (solana-web3, supabase, etc.) get reduced weights
- Pattern density + context determines severity
- Only flags as HIGH/CRITICAL when patterns appear in suspicious context

Usage:
  python3 cdp-url-scan.py <url> [--json] [--timeout 30]
"""

import asyncio
import json
import os
import sys
import time
import hashlib
import re
import argparse
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

try:
    import websockets
except ImportError:
    print("ERROR: websockets not installed. Run: pip3 install websockets", file=sys.stderr)
    sys.exit(1)

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip3 install requests", file=sys.stderr)
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────

CDP_HOST = os.environ.get("CDP_HOST", "localhost")
CDP_PORT = int(os.environ.get("CDP_PORT", "18801"))
DEFAULT_TIMEOUT = 30

# ── Known Library Domains (reduced scoring) ───────────────────────────────────

KNOWN_LIBRARY_DOMAINS = {
    # Solana / Web3
    "solana-web3", "solana-wallet", "solana-", "@solana",
    # Supabase
    "supabase",
    # React / Vue / Angular
    "react", "react-dom", "vue", "angular",
    # Google
    "googletagmanager", "google-analytics", "googlesyndication",
    "doubleclick", "googleadservices",
    # Cloudflare
    "cloudflare",
    # Vercel / Netlify
    "vercel", "netlify",
}

# Known safe domains for network requests
SAFE_DOMAINS = [
    "google.com", "googleapis.com", "gstatic.com", "googletagmanager.com",
    "cloudflare.com", "cloudflareinsights.com", "cdn.cloudflare.net",
    "jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com",
    "fonts.googleapis.com", "fonts.gstatic.com",
    "amazonaws.com", "supabase.co", "agenticbro.app",
    "doubleclick.net", "googleadservices.com",
    # Common CDNs
    "cdn.jsdelivr.net", "fonts.bunny.net", "fontawesome.com",
]

# Suspicious outbound domains
SUSPICIOUS_DOMAINS = [
    "pastebin.com", "paste.ee", "hastebin.com",
    "ngrok.io", "ngrok.app", "serveo.net", "loca.lt",
    "ipfs.io", "gateway.pinata.cloud",
    "raw.githubusercontent.com", "gist.githubusercontent.com",
    "transfer.sh", "0x0.st", "file.io",
    "webhook.site", "pipedream.net", "requestbin",
]

AFFILIATE_HASH_PARAMS = {"act", "pid", "uid", "vid", "ofid", "lid", "cid", "sid", "clickid", "subid", "s1", "s2", "s3"}
FREE_SUBDOMAIN_SUFFIXES = ("eu.org",)
REDIRECT_HOP_PREFIXES = ("hmd-", "clk-", "click-", "go-", "trk-", "track-", "rdr-", "redir-")

# ── Threat Patterns ──────────────────────────────────────────────────────────
# Scoring model: detect MALICIOUS behavior, not normal web patterns
# Tier 1 (critical): always malicious — these patterns have no legitimate use
# Tier 2 (suspicious): malicious only in combination — need 2+ to score
# Tier 3 (noise): common on legit sites — tracked but don't add to risk score

THREAT_PATTERNS = [
    # ── TIER 1: Critical indicators (no legitimate use) ──────────────
    # These ALWAYS score full weight — they have no innocent explanation

    # WASM in-memory malware assembly
    {"pattern": r"new\s+WebAssembly\s*\.\s*Module", "flag": "wasm_module_creation", "weight": 30, "context": "always_suspicious", "desc": "WASM module created in browser memory — in-memory malware assembly"},
    {"pattern": r"WebAssembly\s*\.\s*instantiate\s*\(", "flag": "wasm_instantiate", "weight": 25, "context": "context_dependent", "desc": "WASM instantiation — may be legitimate (games) or malware"},
    {"pattern": r"wasm\s*\[\s*0x[0-9a-fA-F]+\s*\]", "flag": "wasm_bytecode_manipulation", "weight": 25, "context": "always_suspicious", "desc": "Raw WASM bytecode manipulation"},

    # Active wallet drain — sending transactions without user consent
    {"pattern": r"ethereum\.request\s*\(\s*{\s*method:\s*['\"]eth_sendTransaction", "flag": "wallet_drain_attempt", "weight": 30, "context": "always_suspicious", "desc": "Auto-triggered ETH sendTransaction — wallet drain"},
    {"pattern": r"signAllTransactions\s*\(", "flag": "sol_batch_sign", "weight": 15, "context": "context_dependent", "desc": "Batch Solana transaction signing — suspicious if auto-triggered"},

    # Script injection via innerHTML — inserting executable scripts into DOM
    {"pattern": r"\.innerHTML\s*=\s*['\"]<script", "flag": "script_injection", "weight": 15, "context": "context_dependent", "desc": "Script injection via innerHTML — suspicious if loading external code"},

    # setTimeout/setInterval with string eval (indirect eval — rare in modern code)
    {"pattern": r"setTimeout\s*\(\s*['\"]", "flag": "settimeout_string", "weight": 10, "context": "context_dependent", "desc": "setTimeout with string — indirect eval"},
    {"pattern": r"setInterval\s*\(\s*['\"]", "flag": "setinterval_string", "weight": 10, "context": "context_dependent", "desc": "setInterval with string — indirect eval"},

    # Form auto-submission to external endpoint — credential exfiltration
    {"pattern": r"document\.forms\s*\[.*\].*\.submit\s*\(", "flag": "form_auto_submit", "weight": 25, "context": "always_suspicious", "desc": "Auto-submitting forms — credential exfiltration"},

    # Clipboard address swap — overwriting clipboard with a crypto address
    {"pattern": r"navigator\.clipboard\s*\.\s*writeText.*0x[a-fA-F0-9]{40}", "flag": "clipboard_address_swap", "weight": 15, "context": "context_dependent", "desc": "Clipboard overwrite with ETH address — swap pattern"},
    {"pattern": r"navigator\.clipboard\s*\.\s*writeText.*[1-9A-HJ-NP-Za-km-z]{32,44}", "flag": "clipboard_sol_swap", "weight": 15, "context": "context_dependent", "desc": "Clipboard write with Solana address — suspicious if auto-triggered"},

    # ── TIER 2: Suspicious (score only if 2+ found, or combined with Tier 1) ──
    # These CAN be legitimate but are suspicious in combination

    {"pattern": r"\beval\s*\(", "flag": "eval_execution", "weight": 10, "context": "context_dependent", "desc": "eval() — suspicious in combination"},
    {"pattern": r"new\s+Function\s*\(", "flag": "function_constructor", "weight": 8, "context": "context_dependent", "desc": "new Function() — dynamic code generation"},

    # Wallet object override (hijacking wallet providers)
    {"pattern": r"window\.ethereum\s*=\s*\{", "flag": "wallet_hijack_eth", "weight": 20, "context": "context_dependent", "desc": "Ethereum wallet object override — hijack attempt"},
    {"pattern": r"window\.solana\s*=\s*\{", "flag": "wallet_hijack_sol", "weight": 20, "context": "context_dependent", "desc": "Solana wallet object override — hijack attempt"},
    {"pattern": r"window\.phantom\s*=\s*\{", "flag": "wallet_hijack_phantom", "weight": 20, "context": "context_dependent", "desc": "Phantom wallet override — hijack attempt"},

    # Clipboard read — suspicious in combination with wallet activity
    {"pattern": r"navigator\.clipboard\s*\.\s*readText\s*\(", "flag": "clipboard_read", "weight": 8, "context": "context_dependent", "desc": "Clipboard read — suspicious with wallet access"},

    # Data exfiltration to non-standard endpoints
    {"pattern": r"navigator\.sendBeacon\s*\(", "flag": "data_beacon", "weight": 5, "context": "context_dependent", "desc": "Background data beacon"},

    # Service worker for persistence
    {"pattern": r"serviceWorker\s*\.\s*register", "flag": "service_worker_registration", "weight": 5, "context": "context_dependent", "desc": "Service worker registration"},

    # ── TIER 3: Noise (tracked as metadata, don't add to risk score) ─────
    # Common on legitimate sites — detected but not scored
    # UNLESS combined with Tier 1 (then flagged as corroborating evidence)

    {"pattern": r"atob\s*\(", "flag": "base64_decode", "weight": 0, "context": "noise", "desc": "Base64 decoding (common in web apps)"},
    {"pattern": r"String\.fromCharCode\s*\(", "flag": "charcode_obfuscation", "weight": 0, "context": "noise", "desc": "String.fromCharCode (common in minified code)"},
    {"pattern": r"\\x[0-9a-fA-F]{2}", "flag": "hex_obfuscation", "weight": 0, "context": "noise", "desc": "Hex-encoded strings (common in minified code)"},
    {"pattern": r"unescape\s*\(", "flag": "unescape_obfuscation", "weight": 0, "context": "noise", "desc": "unescape() (legacy)"},
    {"pattern": r"document\.write\s*\(", "flag": "document_write", "weight": 0, "context": "noise", "desc": "document.write (legacy ad delivery)"},
    {"pattern": r"document\.forms\s*\[", "flag": "form_access", "weight": 0, "context": "noise", "desc": "Form access (login/checkout forms)"},
    {"pattern": r"querySelector.*password|querySelector.*passwd", "flag": "password_field_access", "weight": 0, "context": "noise", "desc": "Password field access (login forms)"},
    {"pattern": r"navigator\.credentials", "flag": "credential_api_access", "weight": 0, "context": "noise", "desc": "Credential Manager API (auth libraries)"},
    {"pattern": r"navigator\.clipboard\s*\.\s*writeText", "flag": "clipboard_write", "weight": 0, "context": "noise", "desc": "Clipboard write (copy-to-clipboard)"},
    {"pattern": r"personal_sign|eth_signTypedData", "flag": "eth_signing", "weight": 0, "context": "noise", "desc": "Ethereum signing (dApp interaction)"},
    {"pattern": r"new\s+WebSocket\s*\(", "flag": "websocket_connection", "weight": 0, "context": "noise", "desc": "WebSocket connection"},
    {"pattern": r"fetch\s*\(\s*['\"]https?://", "flag": "fetch_request", "weight": 0, "context": "noise", "desc": "Outbound fetch request"},
    {"pattern": r"XMLHttpRequest", "flag": "xhr_request", "weight": 0, "context": "noise", "desc": "XHR request"},
    {"pattern": r"window\.ethereum", "flag": "wallet_present_eth", "weight": 0, "context": "noise", "desc": "Ethereum wallet detected (dApp)"},
    {"pattern": r"window\.solana", "flag": "wallet_present_sol", "weight": 0, "context": "noise", "desc": "Solana wallet detected (dApp)"},
    {"pattern": r"window\.phantom", "flag": "wallet_present_phantom", "weight": 0, "context": "noise", "desc": "Phantom wallet detected (dApp)"},
    {"pattern": r"history\.pushState|history\.replaceState", "flag": "history_manipulation", "weight": 0, "context": "noise", "desc": "History API (SPA routing)"},
]

# ── CDP Connection (async with background listener) ──────────────────────────

class CDPSession:
    """Manages a Chrome DevTools Protocol session with concurrent event listening."""

    def __init__(self, ws_url: str):
        self.ws_url = ws_url
        self.ws = None
        self.msg_id = 0
        self._response_futures = {}
        self._listener_task = None

        self.network_requests = []
        self.console_messages = []
        self.script_sources_meta = []
        self.script_sources_cache = {}  # scriptId -> source code
        self.errors = []

    async def connect(self):
        self.ws = await websockets.connect(self.ws_url, max_size=50 * 1024 * 1024)
        self._listener_task = asyncio.create_task(self._listen_loop())

        await self._send("Network.enable")
        await self._send("Runtime.enable")
        await self._send("Page.enable")
        await self._send("Debugger.enable")
        await self._send("Log.enable")

    async def _listen_loop(self):
        try:
            async for raw in self.ws:
                msg = json.loads(raw)
                msg_id = msg.get("id")

                if msg_id and msg_id in self._response_futures:
                    fut = self._response_futures.pop(msg_id)
                    if "error" in msg:
                        fut.set_exception(RuntimeError(f"CDP error: {msg['error']}"))
                    else:
                        fut.set_result(msg.get("result", {}))
                else:
                    self._handle_event(msg)
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception:
            pass

    async def _send(self, method: str, params: dict = None) -> dict:
        self.msg_id += 1
        msg = {"id": self.msg_id, "method": method}
        if params:
            msg["params"] = params

        fut = asyncio.get_event_loop().create_future()
        self._response_futures[self.msg_id] = fut

        await self.ws.send(json.dumps(msg))
        return await asyncio.wait_for(fut, timeout=15)

    def _handle_event(self, event: dict):
        method = event.get("method", "")
        params = event.get("params", {})

        if method == "Network.requestWillBeSent":
            req = params.get("request", {})
            self.network_requests.append({
                "url": req.get("url", ""),
                "method": req.get("method", ""),
                "type": params.get("type", ""),
                "headers": req.get("headers", {}),
                "initiator": params.get("initiator", {}).get("type", ""),
                "timestamp": params.get("timestamp", 0),
            })

        elif method == "Runtime.consoleAPICalled":
            args = params.get("args", [])
            msg_text = " ".join(str(a.get("value", a.get("description", ""))) for a in args)
            self.console_messages.append({
                "type": params.get("type", ""),
                "message": msg_text[:500],
            })

        elif method == "Runtime.exceptionThrown":
            exc = params.get("exceptionDetails", {})
            self.errors.append({
                "text": exc.get("text", "")[:200],
                "exception": exc.get("exception", {}).get("description", "")[:300],
            })

        elif method == "Debugger.scriptParsed":
            self.script_sources_meta.append({
                "scriptId": params.get("scriptId", ""),
                "url": params.get("url", ""),
                "length": params.get("length", 0),
            })

    async def get_script_source(self, script_id: str) -> str:
        if script_id in self.script_sources_cache:
            return self.script_sources_cache[script_id]
        try:
            result = await self._send("Debugger.getScriptSource", {"scriptId": script_id})
            source = result.get("scriptSource", "")
            self.script_sources_cache[script_id] = source
            return source
        except Exception:
            return ""

    async def navigate(self, url: str):
        await self._send("Page.navigate", {"url": url})

    async def evaluate(self, expression: str) -> dict:
        return await self._send("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
        })

    async def wait_for_load(self, duration: int):
        await asyncio.sleep(duration)

    async def close(self):
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        if self.ws:
            await self.ws.close()


# ── Analysis Functions ────────────────────────────────────────────────────────

def is_library_script(script_url: str) -> bool:
    """Check if a script URL is from a known library/domain."""
    if not script_url:
        return False
    script_lower = script_url.lower()
    for lib in KNOWN_LIBRARY_DOMAINS:
        if lib in script_lower:
            return True
    # Check if from same origin as the scanned site
    # (first-party scripts are more likely legitimate)
    return False


def is_first_party(script_url: str, base_domain: str) -> bool:
    """Check if script is first-party (same domain as the scanned URL)."""
    if not script_url or not base_domain:
        return False
    try:
        parsed = urlparse(script_url)
        script_host = parsed.hostname or ""
        return script_host == base_domain or script_host.endswith(f".{base_domain}")
    except Exception:
        return False


def analyze_script_source(source: str, script_url: str, base_domain: str) -> list:
    """Analyze script source with context-aware scoring."""
    findings = []
    is_lib = is_library_script(script_url)
    is_first = is_first_party(script_url, base_domain)

    for check in THREAT_PATTERNS:
        matches = re.findall(check["pattern"], source, re.IGNORECASE)
        if not matches:
            continue

        weight = check["weight"]
        context = check.get("context", "always_suspicious")

        # Adjust weight based on context
        if context == "library_common":
            if is_lib or is_first:
                weight = max(weight // 3, 1)  # Reduce to 1/3 for known libraries
        elif context == "context_dependent":
            if is_lib or is_first:
                weight = max(weight // 2, 2)  # Reduce to 1/2 for known libraries
        # always_suspicious: no reduction

        findings.append({
            "flag": check["flag"],
            "weight": weight,
            "description": check["desc"],
            "occurrences": len(matches),
            "script_url": script_url,
            "context": check.get("context", "noise"),
            "is_library": is_lib,
            "is_first_party": is_first,
            "original_weight": check["weight"],
        })

    return findings


def analyze_network_requests(requests: list, base_domain: str) -> list:
    """Analyze outbound network requests for suspicious activity."""
    findings = []
    external_domains = set()

    for req in requests:
        url = req.get("url", "")
        if not url:
            continue

        try:
            parsed = urlparse(url)
            domain = parsed.hostname or ""
        except Exception:
            continue

        if not domain or domain == base_domain or domain.endswith(f".{base_domain}"):
            continue

        is_suspicious = any(s in domain for s in SUSPICIOUS_DOMAINS)
        is_safe = any(domain.endswith(s) for s in SAFE_DOMAINS)

        if is_suspicious:
            findings.append({
                "flag": "suspicious_domain",
                "weight": 15,
                "description": f"Connection to suspicious domain: {domain}",
                "url": url,
            })
        elif not is_safe and domain not in external_domains:
            external_domains.add(domain)

    if len(external_domains) > 50:
        findings.append({
            "flag": "excessive_external_connections",
            "weight": 10,
            "description": f"{len(external_domains)} unique external domains contacted",
        })

    return findings


def analyze_url_structure(scan_url: str) -> list:
    """Detect disposable redirect and affiliate-tracking URL patterns."""
    findings = []
    parsed = urlparse(scan_url)
    host = (parsed.hostname or "").lower()
    labels = host.split(".") if host else []
    fragment_params = parse_qs(parsed.fragment, keep_blank_values=True)
    query_params = parse_qs(parsed.query, keep_blank_values=True)
    all_param_names = set(fragment_params) | set(query_params)
    affiliate_params = sorted(all_param_names & AFFILIATE_HASH_PARAMS)

    free_subdomain = any(host.endswith(f".{suffix}") for suffix in FREE_SUBDOMAIN_SUFFIXES)
    redirect_hop = bool(labels and labels[0].startswith(REDIRECT_HOP_PREFIXES))
    hash_affiliate_stack = len(set(fragment_params) & AFFILIATE_HASH_PARAMS) >= 4
    affiliate_stack = len(affiliate_params) >= 5

    if free_subdomain:
        findings.append({
            "flag": "free_subdomain_redirect_abuse",
            "weight": 25,
            "context": "always_suspicious",
            "description": f"Free subdomain infrastructure used for redirect/tracking: {host}",
        })

    if redirect_hop:
        findings.append({
            "flag": "automated_redirect_hop_subdomain",
            "weight": 25,
            "context": "always_suspicious",
            "description": f"Automated redirect-hop subdomain naming pattern: {labels[0]}",
        })

    if hash_affiliate_stack:
        findings.append({
            "flag": "hash_fragment_affiliate_evasion",
            "weight": 30,
            "context": "always_suspicious",
            "description": "Affiliate tracking parameters hidden in URL fragment, invisible to normal server-side logging",
            "parameters": sorted(set(fragment_params) & AFFILIATE_HASH_PARAMS),
        })

    if affiliate_stack:
        findings.append({
            "flag": "affiliate_tracking_stack",
            "weight": 25,
            "context": "always_suspicious",
            "description": "Full affiliate/CPA tracking parameter stack detected",
            "parameters": affiliate_params,
        })

    if free_subdomain and redirect_hop and hash_affiliate_stack and affiliate_stack:
        findings.append({
            "flag": "known_affiliate_scam_redirect_pattern",
            "weight": 95,
            "context": "always_suspicious",
            "description": "Known threat pattern: disposable affiliate scam redirect using free subdomain, redirect-hop naming, and hash-fragment tracking evasion",
        })

    return findings


def apply_url_structure_verdict(result: dict, findings: list) -> dict:
    if not findings:
        return result

    flag_scores = {}
    for finding in findings:
        flag_scores[finding["flag"]] = {
            "weight": finding["weight"],
            "count": 1,
            "description": finding["description"],
            "context": finding.get("context", "always_suspicious"),
            "is_library": False,
            "is_first_party": True,
        }
        if finding.get("parameters"):
            flag_scores[finding["flag"]]["parameters"] = finding.get("parameters")

    risk_score = min(100, sum(min(f["weight"], 95) for f in findings))
    if any(f["flag"] == "known_affiliate_scam_redirect_pattern" for f in findings):
        risk_score = 95
        result["verdict"] = "🛑 KNOWN THREAT — Affiliate scam redirect. Disposable tracking hop using hash-fragment evasion."
        result["risk_level"] = "CRITICAL"
    else:
        result["verdict"] = "⚠️ HIGH RISK — Suspicious redirect or affiliate tracking URL structure detected."
        result["risk_level"] = "HIGH RISK" if risk_score >= 40 else "CAUTION"

    result["risk_score"] = max(int(result.get("risk_score", 0) or 0), risk_score)
    result["findings"] = [{"flag": k, **v} for k, v in flag_scores.items()]
    result["finding_count"] = len(flag_scores)
    result.setdefault("all_findings_raw", findings)
    return result


def analyze_console_and_errors(session: CDPSession) -> list:
    """Check console messages and errors for WASM/malware indicators."""
    findings = []

    for msg in session.console_messages:
        text = msg.get("message", "").lower()
        if "webassembly" in text and "compile" in text:
            findings.append({
                "flag": "wasm_compiled_console",
                "weight": 25,
                "description": f"WASM compilation logged in console: {msg['message'][:100]}",
            })
        elif "wasm" in text and "instantiat" in text:
            findings.append({
                "flag": "wasm_instantiate_console",
                "weight": 20,
                "description": f"WASM instantiation logged: {msg['message'][:100]}",
            })

    for err in session.errors:
        text = (err.get("text", "") + err.get("exception", "")).lower()
        if "webassembly" in text or "wasm" in text:
            findings.append({
                "flag": "wasm_error",
                "weight": 12,
                "description": f"WASM-related error: {text[:150]}",
            })

    return findings


async def analyze_dom(session: CDPSession) -> list:
    """Check rendered DOM for injected elements."""
    findings = []

    try:
        dom_result = await session.evaluate("""
            JSON.stringify({
                iframes: Array.from(document.querySelectorAll('iframe')).map(f => ({
                    src: f.src, hidden: f.hidden, display: f.style.display
                })),
                inlineScripts: Array.from(document.querySelectorAll('script:not([src])')).length,
                walletObjects: {
                    ethereum: typeof window.ethereum !== 'undefined',
                    solana: typeof window.solana !== 'undefined',
                    phantom: typeof window.phantom !== 'undefined',
                },
                hiddenElements: document.querySelectorAll('[style*="display:none"], [hidden]').length,
                scripts: Array.from(document.querySelectorAll('script[src]')).map(s => s.src).slice(0, 20),
            })
        """)

        if "result" in dom_result:
            dom_data = json.loads(dom_result["result"].get("value", "{}"))

            # Hidden iframes — suspicious
            hidden_iframes = [f for f in dom_data.get("iframes", [])
                            if f.get("hidden") or f.get("display") == "none"]
            if hidden_iframes:
                findings.append({
                    "flag": "hidden_iframes",
                    "context": "context_dependent",
                    "weight": 10,
                    "description": f"{len(hidden_iframes)} hidden iframe(s) — potential stealth loading",
                })

            # Inline scripts count
            inline_count = dom_data.get("inlineScripts", 0)
            if inline_count > 30:
                findings.append({
                    "flag": "excessive_inline_scripts",
                    "weight": 10,
                    "description": f"{inline_count} inline script blocks — potential obfuscation",
                })

            # Hidden elements
            hidden_count = dom_data.get("hiddenElements", 0)
            if hidden_count > 50:
                findings.append({
                    "flag": "excessive_hidden_elements",
                    "weight": 8,
                    "description": f"{hidden_count} hidden elements — potential stealth content",
                })

    except Exception as e:
        pass

    return findings


# ── Scanner ──────────────────────────────────────────────────────────────────

def get_or_create_tab() -> tuple:
    """Get existing tab or create new one. Returns (ws_url, tab_id)."""
    try:
        resp = requests.put(f"http://{CDP_HOST}:{CDP_PORT}/json/new?about:blank", timeout=5)
        data = resp.json()
        return data.get("webSocketDebuggerUrl", ""), data.get("id", "")
    except Exception:
        try:
            resp = requests.get(f"http://{CDP_HOST}:{CDP_PORT}/json", timeout=5)
            tabs = resp.json()
            for tab in tabs:
                if tab.get("type") == "page":
                    return tab.get("webSocketDebuggerUrl", ""), tab.get("id", "")
        except Exception:
            pass
    return "", ""


def close_cdp_tab(tab_id: str):
    try:
        requests.get(f"http://{CDP_HOST}:{CDP_PORT}/json/close/{tab_id}", timeout=5)
    except Exception:
        pass


async def scan_url(url: str, timeout: int = DEFAULT_TIMEOUT) -> dict:
    """Main scan function — detonate URL in Chrome CDP and analyze."""
    scan_id = f"urlscan-{int(time.time())}-{hashlib.md5(url.encode()).hexdigest()[:8]}"
    scan_time = datetime.now(timezone.utc).isoformat()
    parsed = urlparse(url)
    base_domain = parsed.hostname or ""

    result = {
        "scan_id": scan_id,
        "url": url,
        "domain": base_domain,
        "scan_date": scan_time,
        "scanner": "cdp-url-scan v2.0",
        "findings": [],
        "network_summary": {},
        "risk_score": 0,
        "risk_level": "UNKNOWN",
        "verdict": "",
    }
    initial_url_findings = analyze_url_structure(url)

    # Check CDP
    try:
        resp = requests.get(f"http://{CDP_HOST}:{CDP_PORT}/json/version", timeout=5)
        if resp.status_code != 200:
            raise Exception("CDP not responding")
    except Exception as e:
        result["error"] = f"Chrome CDP not available on port {CDP_PORT}: {e}"
        result["risk_level"] = "ERROR"
        result["verdict"] = "Scanner unavailable — Chrome CDP not running"
        apply_url_structure_verdict(result, initial_url_findings)
        return result

    ws_url, tab_id = get_or_create_tab()
    if not ws_url:
        result["error"] = "Could not get CDP tab"
        result["risk_level"] = "ERROR"
        result["verdict"] = "Scanner unavailable — no CDP tab"
        return result

    session = CDPSession(ws_url)

    try:
        await session.connect()
        await session.navigate(url)
        await session.wait_for_load(timeout)

        # Analyze scripts
        script_findings = []
        scripts_analyzed = 0

        for script_meta in session.script_sources_meta:
            script_id = script_meta.get("scriptId", "")
            script_url = script_meta.get("url", "")
            if not script_id:
                continue
            source = await session.get_script_source(script_id)
            if source and len(source) > 10:
                scripts_analyzed += 1
                findings = analyze_script_source(source, script_url, base_domain)
                script_findings.extend(findings)

        # Analyze URL structure
        url_findings = initial_url_findings

        # Analyze network
        network_findings = analyze_network_requests(session.network_requests, base_domain)

        # Analyze console/errors
        console_findings = analyze_console_and_errors(session)

        # Analyze DOM
        dom_findings = await analyze_dom(session)

        # Combine all findings
        all_findings = url_findings + script_findings + network_findings + console_findings + dom_findings

        # Aggregate by flag — use MAX weight per flag (not sum), then cap
        flag_scores = {}
        for f in all_findings:
            flag = f["flag"]
            weight = f["weight"]
            if flag not in flag_scores:
                flag_scores[flag] = {
                    "weight": 0,
                    "count": 0,
                    "description": f["description"],
                    "context": f.get("context", "noise"),
                    "is_library": f.get("is_library", False),
                    "is_first_party": f.get("is_first_party", False),
                }
                if f.get("parameters"):
                    flag_scores[flag]["parameters"] = f.get("parameters")
            # Use MAX weight across occurrences, not sum (avoid stacking)
            flag_scores[flag]["weight"] = max(flag_scores[flag]["weight"], weight)
            flag_scores[flag]["count"] += 1

        # ── 3-tier scoring: only score actual malicious behavior ─────────────
        tier1_findings = []  # always_suspicious: critical, no legitimate use
        tier2_findings = []  # context_dependent: suspicious in combination
        tier3_findings = []  # noise: tracked but don't score

        for flag, data in flag_scores.items():
            context = data.get("context", "noise")
            if context == "always_suspicious":
                tier1_findings.append(data)
            elif context == "context_dependent":
                tier2_findings.append(data)
            else:
                tier3_findings.append(data)

        # Tier 1: each finding scores full weight (these are always malicious)
        tier1_score = sum(min(d["weight"], 30) for d in tier1_findings)

        # Tier 2: only scores if 2+ findings, or if any Tier 1 present
        # (single suspicious pattern alone is not enough)
        # Cap total Tier 2 at 25 (multiple low-weight findings don't stack to critical)
        if len(tier2_findings) >= 2 or (tier1_findings and tier2_findings):
            tier2_score = min(sum(min(d["weight"], 15) for d in tier2_findings), 25)
        else:
            tier2_score = 0

        # Tier 3: never scores — just metadata
        tier3_score = 0

        # Network: only suspicious domains and excessive connections score
        # (not just having external requests — that's normal for ad-supported sites)
        network_score = 0
        for flag, data in flag_scores.items():
            if flag == "suspicious_domain":
                network_score += data["weight"]
            elif flag == "excessive_external_connections":
                # Only flag if 50+ external domains (very excessive)
                network_score += min(data["weight"], 10)

        # DOM: hidden iframes only score if 10+ (ad sites have a few)
        dom_score = 0
        for flag, data in flag_scores.items():
            if flag == "hidden_iframes" and data["count"] >= 20:
                dom_score += data["weight"]

        risk_score = min(int(tier1_score + tier2_score + tier3_score + network_score + dom_score), 100)
        if "known_affiliate_scam_redirect_pattern" in flag_scores:
            risk_score = 95

        # Determine verdict
        if risk_score >= 70:
            risk_level = "CRITICAL"
            if "known_affiliate_scam_redirect_pattern" in flag_scores:
                verdict = "🛑 KNOWN THREAT — Affiliate scam redirect. Disposable tracking hop using hash-fragment evasion."
            else:
                verdict = "🛑 KNOWN THREAT — Active malicious JavaScript detected. Do not interact with this site."
        elif risk_score >= 40:
            risk_level = "HIGH RISK"
            verdict = "⚠️ HIGH RISK — Suspicious JavaScript activity detected. Exercise extreme caution."
        elif risk_score >= 20:
            risk_level = "CAUTION"
            verdict = "⚡ CAUTION — Some suspicious indicators found. Verify before interacting."
        elif risk_score >= 5:
            risk_level = "LOW RISK"
            verdict = "✅ LOW RISK — Minor indicators found. Appears mostly safe."
        else:
            risk_level = "CLEAN"
            verdict = "✅ CLEAN — No suspicious activity detected."

        external_requests = [r for r in session.network_requests
                            if r.get("url") and base_domain not in r.get("url", "")]

        result.update({
            "findings": [{"flag": k, **v} for k, v in flag_scores.items()],
            "finding_count": len(flag_scores),
            "network_summary": {
                "total_requests": len(session.network_requests),
                "external_requests": len(external_requests),
                "external_domains": list(set(
                    urlparse(r.get("url", "")).hostname or ""
                    for r in external_requests
                ))[:20],
            },
            "scripts_analyzed": scripts_analyzed,
            "console_messages": len(session.console_messages),
            "errors": len(session.errors),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "verdict": verdict,
            "all_findings_raw": [
                {k: v for k, v in f.items() if k != "original_weight"}
                for f in all_findings[:50]
            ],
        })

    except Exception as e:
        result["error"] = str(e)
        result["risk_level"] = "ERROR"
        result["verdict"] = f"Scan error: {e}"
        apply_url_structure_verdict(result, initial_url_findings)
    finally:
        await session.close()
        if tab_id:
            close_cdp_tab(tab_id)

    return result


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="CDP URL Scanner — JS Detonation Analysis")
    parser.add_argument("url", help="URL to scan")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT,
                       help=f"Seconds to let page run (default: {DEFAULT_TIMEOUT})")
    args = parser.parse_args()

    if not args.url.startswith("http"):
        args.url = "https://" + args.url

    result = asyncio.run(scan_url(args.url, args.timeout))

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\n━━━ 🔍 URL SCAN REPORT — JS Detonation Analysis ━━━\n")
        print(f"URL:       {result.get('url', '')}")
        print(f"Domain:    {result.get('domain', '')}")
        print(f"Scan ID:   {result.get('scan_id', '')}")
        print(f"Date:      {result.get('scan_date', '')}")
        print(f"Scripts:   {result.get('scripts_analyzed', 0)} analyzed")
        print(f"Requests:  {result.get('network_summary', {}).get('total_requests', 0)} total, "
              f"{result.get('network_summary', {}).get('external_requests', 0)} external")
        print(f"\n{'─'*60}")
        print(f"Risk Score: {result.get('risk_score', 0)}/100 — {result.get('risk_level', 'UNKNOWN')}")
        print(f"Verdict:    {result.get('verdict', '')}")
        print(f"{'─'*60}\n")

        findings = result.get("findings", [])
        if findings:
            print(f"Findings ({len(findings)}):\n")
            for i, f in enumerate(findings, 1):
                lib_tag = " [library]" if f.get("is_library") else ""
                fp_tag = " [first-party]" if f.get("is_first_party") else ""
                print(f"  {i}. [{f.get('weight', 0)}pts] {f.get('description', '')}{lib_tag}{fp_tag}")
            print()

        net = result.get("network_summary", {})
        ext_domains = net.get("external_domains", [])
        if ext_domains:
            print(f"External domains contacted ({len(ext_domains)}):")
            for d in ext_domains[:10]:
                print(f"  • {d}")
            print()

        print("\n⚠️  DISCLAIMER: This scan is for educational purposes only.")
        print("Not a guarantee of safety. Always DYOR.\n")


if __name__ == "__main__":
    main()
