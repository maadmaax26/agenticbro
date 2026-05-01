/**
 * Twitter/X Profile Fetcher (Chrome CDP)
 * 
 * Fetches live profile data from X.com using Chrome DevTools Protocol
 * No Twitter API key required
 */

interface ProfileData {
  username: string;
  displayName: string;
  verified: boolean;
  verifiedType?: string;
  followers: number;
  following: number;
  tweets: number;
  bio?: string;
  location?: string;
  website?: string;
  profileImage?: string;
  createdAt?: string;
  recentTweets?: string[];
}

export class ChromeProfileFetcher {
  private cdpUrl: string;

  constructor(cdpUrl: string = 'http://localhost:18801') {
    this.cdpUrl = cdpUrl;
  }

  /**
   * Check if Chrome CDP is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.cdpUrl}/json/version`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available pages/tabs
   */
  async getPages(): Promise<Array<{ id: string; url: string; title: string; webSocketDebuggerUrl?: string }>> {
    const response = await fetch(`${this.cdpUrl}/json/list`);
    const pages = await response.json();
    return pages.filter((p: any) => p.type === 'page');
  }

  /**
   * Get profile data from X.com using Chrome CDP
   */
  async fetchProfile(username: string): Promise<ProfileData | null> {
    try {
      const cleanUsername = username.replace(/^@/, '');
      const xUrl = `https://x.com/${cleanUsername}`;

      // Get existing pages
      const pages = await this.getPages();

      // Find if profile is already open
      let target = pages.find(p => p.url.includes(`x.com/${cleanUsername}`));

      if (!target) {
        // Open new tab - MUST use PUT method for /json/new endpoint
        const response = await fetch(`${this.cdpUrl}/json/new?${encodeURIComponent(xUrl)}`, {
          method: 'PUT'
        });
        target = await response.json();
      }

      // Wait for page to load (increased to 8 seconds for slower X.com loads)
      await this.sleep(8000);

      // Get updated page list
      const updatedPages = await this.getPages();
      target = updatedPages.find(p => p.id === target?.id);

      if (!target || !target.webSocketDebuggerUrl) {
        console.log(`Could not find Chrome tab for ${cleanUsername}`);
        return null;
      }

      // Use WebSocket CDP to extract data
      const profileData = await this.extractProfileDataViaCDP(cleanUsername, target.webSocketDebuggerUrl);

      return profileData;

    } catch (error) {
      console.log(`Chrome CDP fetch failed: ${error}`);
      return null;
    }
  }

  /**
   * Extract profile data using WebSocket CDP
   */
  private async extractProfileDataViaCDP(username: string, wsUrl: string): Promise<ProfileData | null> {
    const WebSocket = require('ws');
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        // Execute JavaScript to extract profile data
        // Uses multiple selector strategies for X.com's changing UI
        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              (function() {
                function parseNum(value) {
                  if (!value) return 0;
                  var str = String(value).toUpperCase().replace(/,/g, '').trim();
                  if (str.slice(-1) === 'K') return parseFloat(str) * 1000;
                  if (str.slice(-1) === 'M') return parseFloat(str) * 1000000;
                  if (str.slice(-1) === 'B') return parseFloat(str) * 1000000000;
                  return parseInt(str) || 0;
                }

                const data = {
                  username: null,
                  displayName: null,
                  verified: false,
                  verifiedType: null,
                  followers: 0,
                  following: 0,
                  tweets: 0,
                  bio: null,
                  location: null,
                  website: null,
                  profileImage: null
                };

                // Username + Display name from UserName component
                var userEl = document.querySelector('[data-testid="UserName"]');
                if (userEl) {
                  var spans = userEl.querySelectorAll('span');
                  var texts = [];
                  spans.forEach(function(s) { if (s.textContent) texts.push(s.textContent); });
                  // Display name is first significant text
                  if (texts.length > 0) data.displayName = texts[0].trim();
                  // Find @username
                  for (var i = 0; i < texts.length; i++) {
                    if (texts[i].startsWith('@')) {
                      data.username = texts[i].replace('@', '').trim();
                    }
                  }
                }

                // Verified badge
                var verifiedEl = document.querySelector('[data-testid="icon-verified"]') ||
                                document.querySelector('[data-testid="verified-badge"]') ||
                                document.querySelector('svg[aria-label*="Verified"]');
                data.verified = !!verifiedEl;
                data.verifiedType = verifiedEl ? 'blue' : null;

                // Bio - use innerText for proper whitespace handling
                var bioEl = document.querySelector('[data-testid="UserDescription"]');
                if (bioEl) data.bio = bioEl.innerText.trim();

                // Follow stats - X uses links in the profile header
                var allLinks = document.querySelectorAll('a[href*="/verified_followers"], a[href*="/followers"], a[href*="/following"]');
                allLinks.forEach(function(link) {
                  var href = link.getAttribute('href') || '';
                  var text = link.textContent || '';
                  // Try to extract numbers from the link text
                  var match = text.match(/([\d,\.]+[KMk]?)\s*(Followers?|Following)/i);
                  if (match) {
                    if (match[2].toLowerCase().startsWith('follower')) {
                      if (data.followers === 0) data.followers = parseNum(match[1]);
                    } else if (match[2].toLowerCase() === 'following') {
                      if (data.following === 0) data.following = parseNum(match[1]);
                    }
                  }
                });

                // Alternative: look for span elements with follower/following text
                if (data.followers === 0 || data.following === 0) {
                  var allSpans = document.querySelectorAll('span');
                  allSpans.forEach(function(span) {
                    var text = span.textContent || '';
                    if (data.followers === 0) {
                      var match = text.match(/([\d,\.]+[KMk]?)\s*Followers?/i);
                      if (match) data.followers = parseNum(match[1]);
                    }
                    if (data.following === 0) {
                      var match2 = text.match(/([\d,\.]+[KMk]?)\s*Following/i);
                      if (match2) data.following = parseNum(match2[1]);
                    }
                  });
                }

                // Profile image
                var imgEl = document.querySelector('[data-testid="UserAvatar"] img') ||
                           document.querySelector('img[alt*="avatar"]') ||
                           document.querySelector('img[src*="profile_images"]');
                if (imgEl) data.profileImage = imgEl.src;

                // Location
                var locationEl = document.querySelector('[data-testid="UserLocation"]');
                if (locationEl) {
                  data.location = locationEl.textContent.trim();
                } else {
                  // Try UserProfileHeader_Items as fallback
                  var headerItems = document.querySelector('[data-testid="UserProfileHeader_Items"]');
                  if (headerItems) {
                    var itemSpans = headerItems.querySelectorAll('span');
                    itemSpans.forEach(function(s) {
                      var t = s.textContent.trim();
                      if (t.includes(',') || /\b(NY|CA|TX|FL|UK|USA|United States)\b/i.test(t)) {
                        if (!data.location) data.location = t;
                      }
                    });
                  }
                }

                // Website
                var urlEl = document.querySelector('[data-testid="UserUrl"]');
                if (urlEl) {
                  data.website = urlEl.textContent.trim();
                } else if (headerItems) {
                  var headerLinks = headerItems.querySelectorAll('a[href]');
                  headerLinks.forEach(function(a) {
                    var href = a.getAttribute('href') || '';
                    if (href.startsWith('http') && !href.includes('x.com') && !href.includes('twitter.com')) {
                      if (!data.website) data.website = href;
                    }
                  });
                }

                // Recent tweets (up to 10) — important for engagement bait detection
                data.recentTweets = [];
                var tweetEls = document.querySelectorAll('[data-testid="tweetText"]');
                tweetEls.forEach(function(el, i) {
                  if (i < 10) {
                    data.recentTweets.push(el.innerText.substring(0, 300));
                  }
                });

                return JSON.stringify(data);
              })();
            `
          }
        }));
      });
      
      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.id === 1) {
            ws.close();
            
            if (msg.error) {
              console.log(`CDP Runtime.evaluate error: ${msg.error.message}`);
              resolve(null);
              return;
            }
            
            const result = msg.result?.result?.value;
            if (!result) {
              console.log('No result from CDP Runtime.evaluate');
              resolve(null);
              return;
            }
            
            try {
              const parsed = JSON.parse(result);
              resolve({
                username: parsed.username || username,
                displayName: parsed.displayName || username,
                verified: parsed.verified || false,
                verifiedType: parsed.verifiedType,
                followers: parsed.followers || 0,
                following: parsed.following || 0,
                tweets: parsed.tweets || 0,
                bio: parsed.bio,
                location: parsed.location,
                website: parsed.website,
                profileImage: parsed.profileImage,
                createdAt: new Date().toISOString(),
                recentTweets: parsed.recentTweets || [],
              });
            } catch (e) {
              console.log(`Failed to parse CDP result: ${e}`);
              resolve(null);
            }
          }
        } catch (e) {
          console.log(`Failed to parse CDP message: ${e}`);
          reject(e);
        }
      });
      
      ws.on('error', (err: Error) => {
        console.log(`WebSocket error: ${err}`);
        reject(err);
      });
      
      // Timeout after 15 seconds
      setTimeout(() => {
        ws.close();
        reject(new Error('Timeout extracting profile data'));
      }, 15000);
    });
  }

  /**
   * Parse number strings like "12.5K", "1.2M"
   */
  private parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    const str = String(value).toUpperCase().replace(/,/g, '');
    
    if (str.endsWith('K')) {
      return parseFloat(str) * 1000;
    } else if (str.endsWith('M')) {
      return parseFloat(str) * 1000000;
    } else if (str.endsWith('B')) {
      return parseFloat(str) * 1000000000;
    }
    
    return parseInt(str) || 0;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ChromeProfileFetcher;