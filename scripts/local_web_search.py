#!/usr/bin/env python3
"""
Local web search — scrapes DuckDuckGo, falls back to SearXNG/Google.
No API keys needed. Replaces Brave API for X engagement monitor.

Usage:
  python3 local_web_search.py "solana scam alert" --count 10
  python3 local_web_search.py "query" --engine ddg --no-cache --verbose
"""

import argparse
import hashlib
import json
import os
import random
import re
import sys
import time
import urllib.parse
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ── Config ──────────────────────────────────────────────────────────────────

CACHE_DIR = Path("/Users/efinney/.openclaw/workspace/.cache/web_search")
CACHE_TTL = 3600  # 1 hour

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
]

SEARXNG_INSTANCES = [
    "https://searx.tiekoetter.com",
    "https://search.sapti.me",
    "https://searx.be",
    "https://search.mdosch.de",
    "https://priv.au",
]

REQUEST_TIMEOUT = 15
DELAY_BETWEEN_REQUESTS = 1.5


# ── Helpers ─────────────────────────────────────────────────────────────────

def _cache_key(query: str, count: int, engine: str) -> str:
    raw = f"{engine}:{query}:{count}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _cache_get(key: str):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{key}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
        if time.time() - data.get("ts", 0) < CACHE_TTL:
            return data.get("results")
    except Exception:
        pass
    return None


def _cache_put(key: str, results: list):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{key}.json"
    path.write_text(json.dumps({"ts": time.time(), "results": results}))


def _ua() -> str:
    return random.choice(USER_AGENTS)


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": _ua()})
    s.headers.update({"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"})
    s.headers.update({"Accept-Language": "en-US,en;q=0.5"})
    s.headers.update({"Accept-Encoding": "gzip, deflate, br"})
    s.headers.update({"Connection": "keep-alive"})
    s.headers.update({"Upgrade-Insecure-Requests": "1"})
    s.headers.update({"Sec-Fetch-Dest": "document"})
    s.headers.update({"Sec-Fetch-Mode": "navigate"})
    s.headers.update({"Sec-Fetch-Site": "none"})
    return s


# ── Engine: DuckDuckGo ─────────────────────────────────────────────────────

def search_ddg(query: str, count: int = 10, verbose: bool = False) -> tuple[list, bool]:
    """Search DuckDuckGo (tries lite + html endpoints). Returns (results, captcha_flag)."""
    results = []
    captcha = False

    for endpoint in ["https://lite.duckduckgo.com/lite/", "https://html.duckduckgo.com/html/"]:
        if len(results) >= count:
            break

        sess = _session()
        data = {"q": query, "kl": "us-en"}

        try:
            resp = sess.post(endpoint, data=data, timeout=REQUEST_TIMEOUT)

            if resp.status_code in (202, 429):
                if verbose:
                    print(f"[DDG] Rate limited on {endpoint} (status {resp.status_code})", file=sys.stderr)
                continue

            resp.raise_for_status()

            if "captcha" in resp.text.lower() or "are you a robot" in resp.text.lower():
                captcha = True
                if verbose:
                    print("[DDG] CAPTCHA detected", file=sys.stderr)
                continue

            soup = BeautifulSoup(resp.text, "lxml")

            # HTML endpoint uses .result
            for item in soup.select(".result"):
                title_el = item.select_one(".result__a")
                snippet_el = item.select_one(".result__snippet")
                if not title_el:
                    continue

                title = title_el.get_text(strip=True)
                href = title_el.get("href", "")

                parsed = urllib.parse.urlparse(href)
                ddg_params = urllib.parse.parse_qs(parsed.query)
                real_url = ddg_params.get("uddg", [href])[0]
                real_url = urllib.parse.unquote(real_url)

                snippet = snippet_el.get_text(strip=True) if snippet_el else ""

                if title and real_url.startswith("http"):
                    results.append({
                        "title": title,
                        "url": real_url,
                        "snippet": snippet,
                        "source_engine": "duckduckgo",
                    })

                if len(results) >= count:
                    break

            # Lite endpoint uses table rows
            if not results:
                for row in soup.select("tr"):
                    link = row.select_one("a.result-link, a.link")
                    snippet_td = row.select_one("td.result-snippet, td.snippet")
                    if not link:
                        continue
                    title = link.get_text(strip=True)
                    href = link.get("href", "")
                    snippet = snippet_td.get_text(strip=True) if snippet_td else ""
                    if title and href.startswith("http"):
                        results.append({
                            "title": title,
                            "url": href,
                            "snippet": snippet,
                            "source_engine": "duckduckgo-lite",
                        })
                    if len(results) >= count:
                        break

        except requests.exceptions.RequestException as e:
            if verbose:
                print(f"[DDG] Error on {endpoint}: {e}", file=sys.stderr)
            continue

    return results, captcha


# ── Engine: SearXNG ────────────────────────────────────────────────────────

def search_searxng(query: str, count: int = 10, verbose: bool = False) -> list:
    """Try multiple SearXNG instances (JSON then HTML fallback). Returns results."""
    results = []
    random.shuffle(SEARXNG_INSTANCES)

    for instance in SEARXNG_INSTANCES:
        if len(results) >= count:
            break

        sess = _session()

        # Try JSON API first
        try:
            params = {"q": query, "format": "json", "categories": "general", "language": "en"}
            resp = sess.get(f"{instance}/search", params=params, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 429:
                if verbose:
                    print(f"[SearXNG] {instance}: rate limited", file=sys.stderr)
                continue
            resp.raise_for_status()
            data = resp.json()

            for item in data.get("results", []):
                results.append({
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "snippet": item.get("content", ""),
                    "source_engine": f"searxng:{instance}",
                })
                if len(results) >= count:
                    break

            if verbose and data.get("results"):
                print(f"[SearXNG] {instance}: {len(data.get('results', []))} JSON results", file=sys.stderr)
            continue  # Success — only try next instance if we need more

        except (requests.exceptions.RequestException, json.JSONDecodeError):
            pass  # Fall through to HTML

        # HTML fallback
        try:
            sess2 = _session()
            params = {"q": query, "categories": "general", "language": "en"}
            resp = sess2.get(f"{instance}/search", params=params, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 429:
                continue

            soup = BeautifulSoup(resp.text, "lxml")
            for article in soup.select("article.result, .result"):
                title_el = article.select_one("h3 a, .result_title a")
                snippet_el = article.select_one("p, .result-content, .snippet")
                if not title_el:
                    continue
                url = title_el.get("href", "")
                if url.startswith("/"):
                    url = instance + url
                results.append({
                    "title": title_el.get_text(strip=True),
                    "url": url,
                    "snippet": snippet_el.get_text(strip=True) if snippet_el else "",
                    "source_engine": f"searxng-html:{instance}",
                })
                if len(results) >= count:
                    break
        except requests.exceptions.RequestException as e:
            if verbose:
                print(f"[SearXNG] {instance} HTML failed: {e}", file=sys.stderr)
            continue

    return results


# ── Engine: Google (last resort) ───────────────────────────────────────────

def search_google(query: str, count: int = 10, verbose: bool = False) -> tuple[list, bool]:
    """Scrape Google search. Returns (results, captcha_flag)."""
    results = []
    captcha = False
    sess = _session()

    url = "https://www.google.com/search"
    params = {"q": query, "num": str(min(count, 10)), "hl": "en"}

    try:
        resp = sess.get(url, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()

        if "captcha" in resp.text.lower() or "sorry" in resp.text.lower():
            captcha = True
            if verbose:
                print("[Google] CAPTCHA detected", file=sys.stderr)
            return results, captcha

        soup = BeautifulSoup(resp.text, "lxml")

        for g in soup.select("div.g"):
            title_el = g.select_one("h3")
            link_el = g.select_one("a[href]")
            snippet_el = g.select_one("div[data-sncf], span.aC73Re, div.VwiC3b")

            if not title_el or not link_el:
                continue

            title = title_el.get_text(strip=True)
            href = link_el.get("href", "")
            if href.startswith("/url?"):
                parsed = urllib.parse.urlparse(href)
                qs = urllib.parse.parse_qs(parsed.query)
                href = qs.get("q", [href])[0]

            snippet = snippet_el.get_text(strip=True) if snippet_el else ""

            if title and href.startswith("http"):
                results.append({
                    "title": title,
                    "url": href,
                    "snippet": snippet,
                    "source_engine": "google",
                })

            if len(results) >= count:
                break

    except requests.exceptions.RequestException as e:
        if verbose:
            print(f"[Google] Error: {e}", file=sys.stderr)

    return results, captcha


# ── Main search function ───────────────────────────────────────────────────

def search(query: str, count: int = 10, engine: str = "auto",
           use_cache: bool = True, verbose: bool = False) -> list:
    """
    Search the web locally. Engine order: ddg → searxng → google.
    Returns list of {"title", "url", "snippet", "source_engine"}.
    """
    # Cache lookup
    if use_cache:
        ckey = _cache_key(query, count, engine)
        cached = _cache_get(ckey)
        if cached:
            if verbose:
                print(f"[Cache] Hit for '{query}'", file=sys.stderr)
            return cached

    all_results = []
    captcha_engines = []

    engines = ["ddg", "searxng", "google"] if engine == "auto" else [engine]

    for eng in engines:
        if len(all_results) >= count:
            break

        if eng == "ddg":
            results, capt = search_ddg(query, count, verbose)
            if capt:
                captcha_engines.append("ddg")
            all_results.extend(results)

        elif eng == "searxng":
            results = search_searxng(query, count - len(all_results), verbose)
            all_results.extend(results)
            time.sleep(DELAY_BETWEEN_REQUESTS)

        elif eng == "google":
            results, capt = search_google(query, count - len(all_results), verbose)
            if capt:
                captcha_engines.append("google")
            all_results.extend(results)

    # Deduplicate by URL
    seen = set()
    deduped = []
    for r in all_results:
        if r["url"] not in seen:
            seen.add(r["url"])
            deduped.append(r)

    results = deduped[:count]

    # Cache store
    if use_cache and results:
        ckey = _cache_key(query, count, engine)
        _cache_put(ckey, results)

    if captcha_engines and verbose:
        print(f"[Warning] CAPTCHA detected on: {', '.join(captcha_engines)}", file=sys.stderr)

    return results


# ── CLI ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Local web search (no API keys)")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--count", "-n", type=int, default=10, help="Max results (default: 10)")
    parser.add_argument("--engine", "-e", choices=["ddg", "searxng", "google", "auto"],
                        default="auto", help="Search engine (default: auto)")
    parser.add_argument("--no-cache", action="store_true", help="Skip cache")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")
    parser.add_argument("--clear-cache", action="store_true", help="Clear all cached results")

    args = parser.parse_args()

    if args.clear_cache:
        import shutil
        if CACHE_DIR.exists():
            shutil.rmtree(CACHE_DIR)
            print("Cache cleared.")
        else:
            print("No cache to clear.")
        return

    results = search(
        query=args.query,
        count=args.count,
        engine=args.engine,
        use_cache=not args.no_cache,
        verbose=args.verbose,
    )

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        if not results:
            print("No results found.")
        for i, r in enumerate(results, 1):
            print(f"\n{i}. {r['title']}")
            print(f"   {r['url']}")
            if r['snippet']:
                print(f"   {r['snippet'][:200]}")
            print(f"   [via {r['source_engine']}]")


if __name__ == "__main__":
    main()