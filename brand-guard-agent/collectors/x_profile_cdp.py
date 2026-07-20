"""
X (Twitter) profile scanner over local CDP  (Tier 1A — PUBLIC VICTIM)

Goal: find companies that have PUBLICLY posted scam/impersonation warnings on X
("⚠️ we are NOT affiliated with @fake_us", "beware of fake accounts", etc.).
Those companies are harmed, aware, and motivated — the warmest possible prospects.

How it works:
  Drive YOUR OWN already-open, already-logged-in Chrome via the Chrome DevTools
  Protocol (CDP). We read the public, already-rendered DOM of a profile page — the
  same content a human visitor sees — and pull recent post text for keyword + LLM
  triage.

============================  READ THIS  ====================================
Scope & compliance (deliberately conservative):
  * Public content only, through your own authenticated browser session.
  * NO bot-detection / CAPTCHA evasion, NO headless stealth tricks, NO credential
    automation. If a page challenges the browser, stop and let a human handle it.
  * Automated scraping of X can violate its Terms of Service. Keep volume LOW,
    add real delays, and treat this as human-in-the-loop triage — not a firehose.
  * Prefer X's official API if/when you have access; this CDP path is a pragmatic
    fallback for low-volume research, not a scale channel.
============================================================================

Setup — start Chrome with the debugging port (use a separate profile dir):
    # macOS
    /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\
        --remote-debugging-port=9222 --user-data-dir="$HOME/.bg-chrome"
    # then log into x.com in that window once.

Deps:  pip install websocket-client    (stdlib urllib used for the /json endpoint)
Usage: python x_profile_cdp.py northwindcoffee acmetools
"""
from __future__ import annotations

import json
import sys
import time
import urllib.request

try:
    from websocket import create_connection           # pip install websocket-client
except ImportError:
    create_connection = None  # type: ignore

try:
    from common.models import RawSignal, SignalTier, ImpersonationType
    from common.llm import classify_signal
except ImportError:
    RawSignal = SignalTier = ImpersonationType = None  # type: ignore
    classify_signal = None  # type: ignore

CDP_HTTP = "http://localhost:9222"
PAGE_SETTLE_S = 4.0           # let the SPA render
PER_PROFILE_DELAY_S = 6.0     # politeness between profiles — do NOT lower for scale

# First-pass keyword filter (cheap) before spending an LLM call.
WARNING_KEYWORDS = [
    "not affiliated", "beware", "fake account", "fake page", "impersonat",
    "scam", "fraud", "phishing", "we will never", "official account",
    "pretending to be", "do not send", "report this",
]

# JS that scrapes visible post text from a rendered X profile.
SCRAPE_JS = r"""
(() => {
  const out = [];
  document.querySelectorAll('article [data-testid="tweetText"]').forEach(el => {
    const t = (el.innerText || '').trim();
    if (t) out.push(t);
  });
  return JSON.stringify(out.slice(0, 30));
})()
"""


def _http_json(path: str):
    with urllib.request.urlopen(f"{CDP_HTTP}{path}", timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))


def _get_page_target() -> dict:
    """Pick an existing 'page' tab from the running Chrome."""
    targets = _http_json("/json")
    pages = [t for t in targets if t.get("type") == "page" and t.get("webSocketDebuggerUrl")]
    if not pages:
        raise RuntimeError("No debuggable page tab. Start Chrome with --remote-debugging-port=9222.")
    return pages[0]


class CDPTab:
    """Minimal CDP client: navigate + evaluate JS in one tab."""
    def __init__(self, ws_url: str):
        if create_connection is None:
            raise RuntimeError("pip install websocket-client")
        self.ws = create_connection(ws_url, max_size=None)
        self._id = 0

    def _send(self, method: str, params: dict | None = None) -> dict:
        self._id += 1
        self.ws.send(json.dumps({"id": self._id, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == self._id:
                return msg

    def navigate(self, url: str):
        self._send("Page.enable")
        self._send("Page.navigate", {"url": url})
        time.sleep(PAGE_SETTLE_S)

    def eval_js(self, expr: str):
        res = self._send("Runtime.evaluate",
                         {"expression": expr, "returnByValue": True})
        return res.get("result", {}).get("result", {}).get("value")

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass


def _looks_like_warning(text: str) -> bool:
    low = text.lower()
    return any(k in low for k in WARNING_KEYWORDS)


def scan_profile(tab: CDPTab, handle: str) -> list:
    """Open one profile, scrape recent posts, keep ones that look like warnings."""
    handle = handle.lstrip("@")
    tab.navigate(f"https://x.com/{handle}")
    raw = tab.eval_js(SCRAPE_JS)
    try:
        posts = json.loads(raw) if raw else []
    except (TypeError, json.JSONDecodeError):
        posts = []

    signals = []
    for text in posts:
        if not _looks_like_warning(text):
            continue
        # Optional second-pass LLM confirmation to cut false positives.
        verdict = None
        if classify_signal is not None:
            try:
                verdict = classify_signal(text, source="x_profile")
                if not verdict.get("is_victim_signal"):
                    continue
            except Exception:
                pass  # if the model is down, keep the keyword hit for human review

        if RawSignal is None:
            signals.append({"handle": handle, "text": text, "verdict": verdict})
        else:
            itype = ImpersonationType.SOCIAL
            if verdict and verdict.get("impersonation_type"):
                try:
                    itype = ImpersonationType(verdict["impersonation_type"])
                except ValueError:
                    pass
            signals.append(RawSignal(
                source="x_profile",
                tier=SignalTier.PUBLIC_VICTIM,
                signal_type="public_scam_warning",
                impersonation_type=itype,
                impersonated_brand=(verdict or {}).get("impersonated_brand") or handle,
                signal_url=f"https://x.com/{handle}",
                snippet=text,
                extra={"handle": handle, "llm_verdict": verdict},
            ))
    return signals


def collect(handles: list[str]) -> list:
    target = _get_page_target()
    tab = CDPTab(target["webSocketDebuggerUrl"])
    out = []
    try:
        for h in handles:
            out.extend(scan_profile(tab, h))
            time.sleep(PER_PROFILE_DELAY_S)     # keep it slow + human-paced
    finally:
        tab.close()
    return out


if __name__ == "__main__":
    handles = sys.argv[1:] or ["northwindcoffee"]
    try:
        results = collect(handles)
    except Exception as e:
        print(f"[!] {e}", file=sys.stderr)
        print("    Is Chrome running with --remote-debugging-port=9222 and logged into x.com?",
              file=sys.stderr)
        sys.exit(1)
    out = [r.to_dict() if hasattr(r, "to_dict") else r for r in results]
    print(json.dumps(out, indent=2, default=str))
    print(f"\n{len(out)} warning-style post(s) across {len(handles)} profile(s)", file=sys.stderr)
