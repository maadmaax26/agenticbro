#!/usr/bin/env python3
"""
CDP Bot Activity Scorer for X/Twitter Profiles

Connects to Chrome DevTools Protocol (port 18801) to extract profile
and engagement data, then calculates a bot-activity score (0-100).

Usage:
  Standalone:  python3 cdp_bot_scorer.py "username" [--tweet URL] [--human]
  Integrated:  Called from scan-x-cdp.sh (output is machine-parseable)

Output format (stdout):
  BOT_SCORE=<0-100>
  BOT_CLASSIFICATION=<label>
  BOT_EMOJI=<emoji>
  FLAG|<name>|<points>|<detail>
  ...
"""

from collections import Counter
import json
import argparse
import re
import sys
import time
import urllib.parse
import urllib.request

# ---------------------------------------------------------------------------
# CDP Connection
# ---------------------------------------------------------------------------

CDP_PORT = 18801
CDP_HOST = "localhost"
CDP_TIMEOUT = 15  # seconds


def cdp_http_get(path: str):
    """Simple HTTP GET to CDP endpoint."""
    url = f"http://{CDP_HOST}:{CDP_PORT}{path}"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"CDP_HTTP_ERROR|{e}", file=sys.stderr)
        return None


def get_ws_url_for_tab(target_url_fragment: str = ""):
    """Return the WebSocket debugger URL for the best matching tab.

    If *target_url_fragment* is given (e.g. "x.com/elonmusk"), prefer a tab
    whose URL contains that fragment.  Otherwise fall back to the first
    'page'-type tab, or open a new one.
    """
    pages = cdp_http_get("/json/list")
    if pages is None:
        return None

    # Filter page-type tabs
    page_tabs = [p for p in pages if p.get("type") == "page"]

    # Prefer a tab that already shows the target profile
    if target_url_fragment and page_tabs:
        for p in page_tabs:
            if target_url_fragment.lower() in (p.get("url") or "").lower():
                ws_url = p.get("webSocketDebuggerUrl")
                if ws_url:
                    return ws_url, p

    # Otherwise use any available page tab
    for p in page_tabs:
        ws_url = p.get("webSocketDebuggerUrl")
        if ws_url:
            return ws_url, p

    return None, None


def open_new_tab(url: str):
    """Open a new tab via CDP /json/new endpoint."""
    try:
        req = urllib.request.Request(
            f"http://{CDP_HOST}:{CDP_PORT}/json/new?{urllib.parse.quote(url, safe='')}",
            method="PUT",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read().decode())
            ws_url = result.get("webSocketDebuggerUrl")
            return ws_url, result
    except Exception as e:
        print(f"CDP_NEW_TAB_ERROR|{e}", file=sys.stderr)
        return None, None


# ---------------------------------------------------------------------------
# WebSocket CDP helpers (using websocket-client)
# ---------------------------------------------------------------------------

try:
    import websocket  # websocket-client package
except ImportError:
    websocket = None  # will fall back gracefully


class CDPConnection:
    """Manage a single CDP WebSocket session."""

    def __init__(self, ws_url: str):
        if websocket is None:
            raise RuntimeError("websocket-client not installed")
        self.ws = websocket.create_connection(ws_url, timeout=CDP_TIMEOUT)
        self._msg_id = 0

    def send(self, method: str, params: dict = None):
        self._msg_id += 1
        msg = {"id": self._msg_id, "method": method}
        if params:
            msg["params"] = params
        self.ws.send(json.dumps(msg))

        # Read responses until we get ours
        deadline = time.time() + CDP_TIMEOUT
        while time.time() < deadline:
            self.ws.settimeout(max(1, deadline - time.time()))
            try:
                raw = self.ws.recv()
                data = json.loads(raw)
                if data.get("id") == self._msg_id:
                    return data
            except websocket.WebSocketTimeoutException:
                break
            except Exception:
                continue
        return None

    def evaluate(self, expression: str, await_promise: bool = False):
        result = self.send("Runtime.evaluate", {
            "expression": expression,
            "awaitPromise": await_promise,
            "returnByValue": True,
        })
        if result and "result" in result:
            r = result["result"].get("result")
            if r and r.get("type") == "object" and r.get("subtype") == "error":
                return None
            return r.get("value") if r else None
        return None

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Profile data extraction
# ---------------------------------------------------------------------------

PROFILE_JS = """
(function() {
    function parseNum(v) {
        if (!v) return 0;
        var s = String(v).toUpperCase().replace(/,/g, '').trim();
        if (s.endsWith('K')) return parseFloat(s) * 1000;
        if (s.endsWith('M')) return parseFloat(s) * 1000000;
        if (s.endsWith('B')) return parseFloat(s) * 1000000000;
        return parseInt(s) || 0;
    }

    var d = {
        username: null,
        displayName: null,
        bio: null,
        followers: 0,
        following: 0,
        tweetsCount: 0,
        verified: false,
        verifiedType: null,
        hasDefaultAvatar: false,
        location: null,
        website: null,
        profileImageUrl: null,
        joinDate: null
    };

    // Username
    var uEl = document.querySelector('[data-testid="UserScreenName"] span')
            || document.querySelector('[data-testid="UserName"] + div span');
    if (uEl) d.username = uEl.textContent.replace('@','').trim();

    // Display name
    var nEl = document.querySelector('[data-testid="UserName"]');
    if (nEl) {
        var nameSpan = nEl.querySelector('span span, div[dir="ltr"] span');
        d.displayName = nameSpan ? nameSpan.textContent.trim() : nEl.textContent.trim();
    }

    // Verified
    var vEl = document.querySelector('[data-testid="icon-verified"]')
           || document.querySelector('[data-testid="verified-badge"]')
           || document.querySelector('svg[aria-label*="Verified"]');
    d.verified = !!vEl;

    // Bio
    var bEl = document.querySelector('[data-testid="UserDescription"] div[dir="ltr"]')
           || document.querySelector('[data-testid="UserDescription"]');
    if (bEl) d.bio = bEl.textContent.trim();

    // Follow stats - try links first
    var links = document.querySelectorAll('a[href*="/followers"], a[href*="/verified_followers"], a[href*="/following"]');
    links.forEach(function(a) {
        var text = a.textContent || '';
        var m = text.match(/([\\d,\\.]+[KMk]?)\\s*(Followers?|Following)/i);
        if (m) {
            if (m[2].toLowerCase().startsWith('follower')) d.followers = parseNum(m[1]);
            else if (m[2].toLowerCase() === 'following') d.following = parseNum(m[1]);
        }
    });
    // Fallback: scan all spans
    if (d.followers === 0) {
        document.querySelectorAll('span').forEach(function(s) {
            var m = (s.textContent||'').match(/([\\d,\\.]+[KMk]?)\\s*Followers?/i);
            if (m) d.followers = parseNum(m[1]);
        });
    }
    if (d.following === 0) {
        document.querySelectorAll('span').forEach(function(s) {
            var m = (s.textContent||'').match(/([\\d,\\.]+[KMk]?)\\s*Following/i);
            if (m) d.following = parseNum(m[1]);
        });
    }

    // Tweet/post count
    var tEl = document.querySelector('[data-testid="primaryColumn"] span')
           || document.querySelector('div[data-testid="primaryColumn"]');
    // Often embedded in header; try the cellInnerDiv pattern
    document.querySelectorAll('span').forEach(function(s) {
        var m = (s.textContent||'').match(/([\\d,\\.]+[KMk]?)\\s*(Posts?|Tweets?)/i);
        if (m && d.tweetsCount === 0) d.tweetsCount = parseNum(m[1]);
    });

    // Profile image
    var imgEl = document.querySelector('[data-testid="UserAvatar"] img')
             || document.querySelector('img[src*="profile_images"]');
    if (imgEl) {
        d.profileImageUrl = imgEl.src || '';
        // Check if default avatar (contains "default_profile" or is a placeholder)
        d.hasDefaultAvatar = d.profileImageUrl.includes('default_profile')
                          || d.profileImageUrl.includes('default_profile_images')
                          || d.profileImageUrl.includes('/sticky/default_profile_images/');
    }

    // Location
    var locEl = document.querySelector('[data-testid="UserLocation"] span')
             || document.querySelector('[data-testid="UserLocation"]');
    if (locEl) d.location = locEl.textContent.trim();

    // Website
    var urlEl = document.querySelector('[data-testid="UserUrl"] span')
             || document.querySelector('[data-testid="UserUrl"]');
    if (urlEl) d.website = urlEl.textContent.trim();

    // Join date
    var joinEl = document.querySelector('[data-testid="UserProfessionalCategory"]')
              || document.querySelector('span[data-testid="joinDate"]');
    document.querySelectorAll('span').forEach(function(s) {
        var t = (s.textContent||'').trim();
        if (/^Joined\\s/i.test(t) || /\\bJoined\\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)/i.test(t)) {
            d.joinDate = t;
        }
    });

    return JSON.stringify(d);
})();
"""


def extract_profile_data(cdp: CDPConnection) -> dict:
    """Extract profile metadata via CDP JavaScript."""
    raw = cdp.evaluate(PROFILE_JS)
    if raw and isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
    return raw if isinstance(raw, dict) else {}


# ---------------------------------------------------------------------------
# Tweet engagement extraction
# ---------------------------------------------------------------------------

TWEETS_JS = """
(function() {
    function parseNum(v) {
        if (!v) return 0;
        var s = String(v).toUpperCase().replace(/,/g, '').trim();
        if (s.endsWith('K')) return parseFloat(s) * 1000;
        if (s.endsWith('M')) return parseFloat(s) * 1000000;
        if (s.endsWith('B')) return parseFloat(s) * 1000000000;
        return parseInt(s) || 0;
    }

    var results = [];
    // Find tweet articles on the profile timeline
    var articles = document.querySelectorAll('article[data-testid="tweet"]');
    var seen = {};

    articles.forEach(function(art) {
        // Tweet link
        var timeEl = art.querySelector('time');
        var link = timeEl ? timeEl.parentElement.getAttribute('href') : '';
        var tweetId = '';
        if (link) {
            var parts = link.split('/');
            tweetId = parts[parts.length - 1] || parts[parts.length - 2];
        }

        if (seen[tweetId] || !tweetId) return;
        seen[tweetId] = true;

        // Engagement metrics from aria-labels
        var views = 0, replies = 0, likes = 0, reposts = 0;
        var groups = art.querySelectorAll('[role="group"] [aria-label]');
        groups.forEach(function(el) {
            var label = (el.getAttribute('aria-label') || '').toLowerCase();
            var numMatch = label.match(/([\\d,\\.]+[KMk]?)/);
            var num = numMatch ? parseNum(numMatch[1]) : (label.includes('no') || label === '' ? 0 : 1);
            if (label.includes('repl')) replies = num;
            else if (label.includes('like') || label.includes('heart')) likes = num;
            else if (label.includes('repost') || label.includes('re-tweet') || label.includes('share')) reposts = num;
            else if (label.includes('view')) views = num;
        });

        // Also try separate counters inside the group
        if (replies === 0 && likes === 0 && views === 0) {
            art.querySelectorAll('[data-testid]').forEach(function(el) {
                var tid = el.getAttribute('data-testid') || '';
                var txt = el.textContent || '';
                if (tid === 'reply') replies = parseNum(txt) || (txt ? 1 : 0);
                if (tid === 'like') likes = parseNum(txt) || (txt ? 1 : 0);
                if (tid === 'retweet' || tid === 'unretweet') reposts = parseNum(txt) || (txt ? 1 : 0);
                if (tid.startsWith('view')) views = parseNum(txt) || 0;
            });
        }

        // First commenter usernames (from replies in the thread)
        var commenters = [];
        // Look for reply tweets below this article
        var parent = art.parentElement;
        // Not easily available from profile page; skip for now

        results.push({
            tweetId: tweetId,
            link: link,
            views: views,
            replies: replies,
            likes: likes,
            reposts: reposts,
            commenters: commenters
        });
    });

    return JSON.stringify(results.slice(0, 10));  // up to 10 tweets
})();
"""

SCROLL_JS = "window.scrollBy(0, 2000);"


def extract_recent_tweets(cdp: CDPConnection, limit: int = 5):
    """Scroll and extract recent tweet engagement data."""
    # Scroll down to load tweets
    for _ in range(3):
        cdp.evaluate(SCROLL_JS)
        time.sleep(1.5)

    raw = cdp.evaluate(TWEETS_JS)
    if raw and isinstance(raw, str):
        try:
            tweets = json.loads(raw)
            return tweets[:limit]
        except json.JSONDecodeError:
            pass
    return raw if isinstance(raw, list) else []


# ---------------------------------------------------------------------------
# Ghost Comments Detection
# ---------------------------------------------------------------------------

GHOST_COMMENTS_JS = """
(function() {
    function parseNum(v) {
        if (!v) return 0;
        var s = String(v).toUpperCase().replace(/,/g, '').trim();
        if (s.endsWith('K')) return parseFloat(s) * 1000;
        if (s.endsWith('M')) return parseFloat(s) * 1000000;
        if (s.endsWith('B')) return parseFloat(s) * 1000000000;
        return parseInt(s) || 0;
    }

    // Get reply count from the main tweet's reply button
    var replyBtn = document.querySelector('[data-testid="reply"]');
    var replyCountMatch = replyBtn ? replyBtn.innerText.match(/([\\d,+.]+[KkMm]?)/) : null;
    var replyCount = replyCountMatch ? parseNum(replyCountMatch[1]) : 0;

    // Also try aria-label approach on the first tweet's role=group
    if (replyCount === 0) {
        var firstTweet = document.querySelector('article[data-testid="tweet"]');
        if (firstTweet) {
            var groupBtns = firstTweet.querySelectorAll('[role="group"] [aria-label]');
            groupBtns.forEach(function(el) {
                var label = (el.getAttribute('aria-label') || '').toLowerCase();
                if (label.includes('repl')) {
                    var m = label.match(/([\\d,+.]+[KkMm]?)/);
                    if (m) replyCount = parseNum(m[1]);
                    else if (!label.includes('no') && label !== '') replyCount = 1;
                }
            });
        }
    }

    // Count visible reply tweet elements (exclude the original tweet)
    var allTweets = document.querySelectorAll('[data-testid="tweet"]');
    var visibleReplies = Math.max(0, allTweets.length - 1);

    // Check for "No replies" / "Be the first" message
    var bodyText = document.body.innerText || '';
    var noReplies = bodyText.includes('No replies') || bodyText.includes('Be the first');

    // If "No replies" is shown but count > 0, all are ghost
    if (noReplies && replyCount > 0) {
        visibleReplies = 0;
    }

    return JSON.stringify({
        replyCount: replyCount,
        visibleReplies: visibleReplies,
        noRepliesMessage: noReplies,
        tweetUrl: window.location.href
    });
})();
"""


def detect_ghost_comments(cdp: CDPConnection, tweet_url: str) -> dict:
    """Open a specific tweet and detect ghost comments.

    Ghost comments occur when X's spam filter hides bot replies but keeps
    the reply count inflated. This is a strong bot engagement indicator.

    Args:
        cdp: CDPConnection to use
        tweet_url: URL of the tweet to analyze

    Returns:
        dict with reply_count, visible_replies, hidden_ratio,
        ghost_comments (bool), points (int)
    """
    default_result = {
        "reply_count": 0,
        "visible_replies": 0,
        "hidden_ratio": 0.0,
        "ghost_comments": False,
        "points": 0,
    }

    try:
        # Navigate to tweet
        cdp.evaluate(f'window.location.href = "{tweet_url}"')
        time.sleep(5)  # wait for page to load

        # Scroll down a bit to load reply thread
        for _ in range(2):
            cdp.evaluate(SCROLL_JS)
            time.sleep(1.5)

        # Run ghost detection JS
        raw = cdp.evaluate(GHOST_COMMENTS_JS)
        if not raw:
            print("GHOST_COMMENTS_ERROR|JS returned empty", file=sys.stderr)
            return default_result

        if isinstance(raw, str):
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                print(f"GHOST_COMMENTS_ERROR|Invalid JSON: {raw[:100]}", file=sys.stderr)
                return default_result
        elif isinstance(raw, dict):
            data = raw
        else:
            print(f"GHOST_COMMENTS_ERROR|Unexpected type: {type(raw)}", file=sys.stderr)
            return default_result

        reply_count = data.get("replyCount", 0)
        visible_replies = data.get("visibleReplies", 0)
        no_replies_msg = data.get("noRepliesMessage", False)

        # If "No replies" message shown but count > 0, all replies are ghost
        if no_replies_msg and reply_count > 0:
            visible_replies = 0

        # Calculate hidden ratio
        if reply_count > 0:
            hidden_ratio = max(0, min(1, (reply_count - visible_replies) / reply_count))
        else:
            hidden_ratio = 0.0

        # Determine points based on hidden ratio thresholds
        ghost_comments = hidden_ratio >= 0.5
        if hidden_ratio >= 0.95:
            points = 20
        elif hidden_ratio >= 0.70:
            points = 15
        elif hidden_ratio >= 0.50:
            points = 10
        else:
            points = 0
            ghost_comments = False

        return {
            "reply_count": reply_count,
            "visible_replies": visible_replies,
            "hidden_ratio": round(hidden_ratio, 4),
            "ghost_comments": ghost_comments,
            "points": points,
        }

    except Exception as e:
        print(f"GHOST_COMMENTS_ERROR|{e}", file=sys.stderr)
        return default_result


# ---------------------------------------------------------------------------
# Bot scoring engine
# ---------------------------------------------------------------------------

def calculate_bot_score(profile: dict, tweets: list) -> dict:
    score = 0
    flags = []

    followers = profile.get("followers") or 0
    following = profile.get("following") or 0
    bio = (profile.get("bio") or "").strip()
    location = (profile.get("location") or "").strip()
    website = (profile.get("website") or "").strip()
    username = (profile.get("username") or "").strip()
    has_default_avatar = profile.get("hasDefaultAvatar", False)

    # ---- Profile-level flags ----

    # 1. Suspicious Follow Ratio (15pts)
    if followers > 0 and following > followers * 3:
        pts = 15
        score += pts
        flags.append({
            "name": "Suspicious Follow Ratio",
            "points": pts,
            "detail": f"Following {following:,} > 3x followers {followers:,}"
        })
    elif following > 0 and followers == 0:
        # Following many but zero followers
        pts = 15
        score += pts
        flags.append({
            "name": "Suspicious Follow Ratio",
            "points": pts,
            "detail": f"Following {following:,} with 0 followers"
        })

    # 2. No Profile Image (10pts)
    if has_default_avatar:
        pts = 10
        score += pts
        flags.append({
            "name": "No Profile Image",
            "points": pts,
            "detail": "Default avatar detected"
        })

    # 3. No Bio (5pts)
    if not bio:
        pts = 5
        score += pts
        flags.append({
            "name": "No Bio",
            "points": pts,
            "detail": "Profile description is empty"
        })

    # 4. No Location/URL (5pts)
    if not location and not website:
        pts = 5
        score += pts
        flags.append({
            "name": "No Location/URL",
            "points": pts,
            "detail": "Both location and website are empty"
        })

    # 5. Generic Username (5pts)
    # Pattern: many trailing digits (e.g., user12345678)
    if username:
        digit_suffix = re.search(r'\d{4,}$', username)
        if digit_suffix:
            pts = 5
            score += pts
            flags.append({
                "name": "Generic Username",
                "points": pts,
                "detail": f"Username ends with {digit_suffix.group()} — typical bot pattern"
            })

    # ---- Engagement-level flags ----

    if tweets:
        total_views = 0
        total_replies = 0
        all_commenters = []
        reply_ratios = []

        for tw in tweets:
            v = tw.get("views", 0) or 0
            r = tw.get("replies", 0) or 0
            total_views += v
            total_replies += r
            all_commenters.extend(tw.get("commenters", []))
            if v > 0:
                reply_ratios.append(r / v)

        # 6. Ghost Comments (20pts)
        # Reply count significantly exceeds visible comments (commenters list)
        # On profile page we can't always see reply authors, so we use a heuristic:
        # High reply counts relative to engagement (likes/reposts)
        if tweets and total_replies > 0:
            total_likes = sum(tw.get("likes", 0) or 0 for tw in tweets)
            total_reposts = sum(tw.get("reposts", 0) or 0 for tw in tweets)
            total_engagement = total_likes + total_reposts
            if total_engagement > 0 and total_replies > total_engagement * 0.8:
                pts = 20
                score += pts
                flags.append({
                    "name": "Ghost Comments",
                    "points": pts,
                    "detail": f"Replies ({total_replies}) >> likes+reposts ({total_engagement})"
                })

        # 7. View Inflation (15pts)
        # Views >> followers (10x+ ratio)
        avg_views = total_views / len(tweets) if tweets else 0
        if followers > 0 and avg_views > followers * 10:
            pts = 15
            score += pts
            flags.append({
                "name": "View Inflation",
                "points": pts,
                "detail": f"Avg views ({avg_views:,.0f}) > 10x followers ({followers:,})"
            })

        # 8. Engagement Pods (15pts)
        # Same accounts appear in multiple tweet commenters
        if all_commenters:
            commenter_counts = Counter(all_commenters)
            pod_accounts = [c for c, cnt in commenter_counts.items() if cnt >= 2]
            if len(pod_accounts) >= 2:
                pts = 15
                score += pts
                flags.append({
                    "name": "Engagement Pods",
                    "points": pts,
                    "detail": f"{len(pod_accounts)} accounts comment on multiple posts"
                })

        # 9. Coordinated Timing (10pts)
        # Not reliably detectable from profile page alone — skip or mild heuristic
        # (We'd need timestamps of comments which aren't available here)

        # 10. High Reply Ratio (10pts)
        # Average replies > 50 per tweet BUT only when replies significantly
        # outweigh organic engagement (likes/reposts), which signals bot armies
        # replying to each other. For popular accounts, high reply counts are
        # normal so we check the reply-to-like ratio.
        if tweets:
            avg_replies = total_replies / len(tweets)
            total_likes = sum(tw.get("likes", 0) or 0 for tw in tweets)
            # Only flag if replies > 50 AND replies are disproportionate
            # relative to likes (replies > likes means bot-like engagement)
            if avg_replies > 50 and (total_likes == 0 or total_replies > total_likes * 0.5):
                pts = 10
                score += pts
                flags.append({
                    "name": "High Reply Ratio",
                    "points": pts,
                    "detail": f"Avg {avg_replies:.1f} replies/tweet with low organic engagement"
                })

    # Cap at 100
    score = min(score, 100)

    # Classification
    classification, emoji = get_classification(score)

    return {
        "score": score,
        "flags": flags,
        "classification": classification,
        "emoji": emoji,
    }


def get_classification(score: int):
    if score <= 20:
        return "Likely Authentic", "\u2705"  # ✅
    elif score <= 40:
        return "Mild Bot Activity", "\U0001f7e1"  # 🟡
    elif score <= 60:
        return "Moderate Bot Inflation", "\U0001f7e0"  # 🟠
    elif score <= 80:
        return "High Bot Inflation", "\U0001f534"  # 🔴
    else:
        return "Highly Bot-Inflated", "\U0001f6a8"  # 🚨


# ---------------------------------------------------------------------------
# Output formatting
# ---------------------------------------------------------------------------

def format_output(result: dict):
    """Print machine-parseable output for shell script integration."""
    print(f"BOT_SCORE={result['score']}")
    print(f"BOT_CLASSIFICATION={result['classification']}")
    print(f"BOT_EMOJI={result['emoji']}")
    for flag in result.get("flags", []):
        detail = flag.get("detail", "")
        print(f"FLAG|{flag['name']}|{flag['points']}|{detail}")


def format_human(result: dict, profile: dict, tweets: list):
    """Print a human-readable report (for standalone mode)."""
    print()
    print("=" * 60)
    print(f"  {result['emoji']}  BOT ACTIVITY ASSESSMENT")
    print("=" * 60)
    print()
    print(f"  Bot Score:       {result['score']}/100")
    print(f"  Classification:  {result['emoji']} {result['classification']}")
    print()

    # Profile summary
    username = profile.get("username", "?")
    display = profile.get("displayName", "")
    followers = profile.get("followers", 0)
    following = profile.get("following", 0)
    bio = profile.get("bio", "") or "(empty)"
    print(f"  Profile:  @{username}" + (f" ({display})" if display else ""))
    print(f"  Followers: {followers:,}   Following: {following:,}")
    print(f"  Bio: {bio[:80]}{'...' if len(bio) > 80 else ''}")
    print()

    if result["flags"]:
        print("  Flags Detected:")
        for flag in result["flags"]:
            detail = flag.get("detail", "")
            print(f"    \u2022 {flag['name']}: {flag['points']}pts"
                  + (f" — {detail}" if detail else ""))
    else:
        print("  No bot-activity flags detected.")

    print()
    if tweets:
        print(f"  Tweets analyzed: {len(tweets)}")
        for i, tw in enumerate(tweets[:5], 1):
            v = tw.get("views", 0) or 0
            r = tw.get("replies", 0) or 0
            l = tw.get("likes", 0) or 0
            rp = tw.get("reposts", 0) or 0
            print(f"    #{i}: {v:,} views, {r} replies, {l} likes, {rp} reposts")

    print()
    print("=" * 60)
    print("  Educational purposes only. Not financial advice.")
    print("  Not a guarantee of authenticity. Always do your own due diligence.")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="CDP Bot Activity Scorer for X/Twitter Profiles")
    parser.add_argument("username", help="X/Twitter username to scan")
    parser.add_argument("--tweet", dest="tweet_url", default=None,
                        help="Tweet URL to analyze for ghost comments")
    parser.add_argument("--human", action="store_true",
                        help="Print detailed human-readable report (default: machine-parseable)")
    args = parser.parse_args()

    username = args.username.lstrip("@")
    human_mode = args.human
    tweet_url = args.tweet_url

    # --- Connect to CDP ---
    ws_url, tab_info = get_ws_url_for_tab(f"x.com/{username}")

    if ws_url is None:
        # Try opening a new tab
        ws_url, tab_info = open_new_tab(f"https://x.com/{username}")
        if ws_url is None:
            print("BOT_SCORE=0")
            print("BOT_CLASSIFICATION=Unknown (CDP unavailable)")
            print("BOT_EMOJI=\u2753")  # ❓
            if human_mode:
                print("\n  Could not connect to Chrome CDP on port {CDP_PORT}.")
                print("  Make sure Chrome is running with --remote-debugging-port={CDP_PORT}")
            sys.exit(0)

    # --- Wait for page load ---
    time.sleep(4)

    # --- Navigate to profile if not already there ---
    cdp = None
    try:
        cdp = CDPConnection(ws_url)

        # Check current URL; navigate if needed
        current_url = cdp.evaluate("window.location.href") or ""
        target_url = f"x.com/{username}"
        if target_url.lower() not in current_url.lower():
            cdp.evaluate(f'window.location.href = "https://x.com/{username}"')
            time.sleep(5)  # wait for navigation

        # --- Extract data ---
        profile = extract_profile_data(cdp) or {}
        tweets = extract_recent_tweets(cdp, limit=5) or []

        # Ensure username is set and clean
        extracted_user = profile.get("username", "")
        # Fix: if CDP returned a URL or http prefix, use our passed-in username
        if not extracted_user or extracted_user.startswith("http") or "/" in extracted_user:
            profile["username"] = username
        else:
            # Strip @ prefix if present
            profile["username"] = extracted_user.lstrip("@")

        # --- Calculate bot score ---
        result = calculate_bot_score(profile, tweets)

        # --- Ghost comments detection (optional tweet URL) ---
        if tweet_url:
            ghost_result = detect_ghost_comments(cdp, tweet_url)
            if ghost_result["ghost_comments"]:
                flag_name = "Ghost Comments"
                if ghost_result["hidden_ratio"] >= 0.95:
                    flag_name = "Ghost Comments (Critical)"
                elif ghost_result["hidden_ratio"] >= 0.70:
                    flag_name = "Ghost Comments (High)"
                elif ghost_result["hidden_ratio"] >= 0.50:
                    flag_name = "Ghost Comments (Moderate)"
                result["flags"].append({
                    "id": "ghost_comments",
                    "name": flag_name,
                    "points": ghost_result["points"],
                    "detail": f"{ghost_result['reply_count']} shown, {ghost_result['visible_replies']} visible ({int(ghost_result['hidden_ratio']*100)}% hidden)"
                })
                result["score"] = min(100, result["score"] + ghost_result["points"])

        # --- Output ---
        if human_mode:
            format_human(result, profile, tweets)
        else:
            format_output(result)

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        print("BOT_SCORE=0")
        print("BOT_CLASSIFICATION=Error")
        print("BOT_EMOJI=\u274c")  # ❌
        # Still output any partial flags we might have
    finally:
        if cdp:
            cdp.close()


if __name__ == "__main__":
    main()