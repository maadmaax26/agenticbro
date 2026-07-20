/**
 * Twitter/X Profile Fetcher (Chrome CDP WebSocket)
 *
 * Fetches live profile data from X.com using Chrome CDP WebSocket
 * Uses existing browser tabs - no new page creation
 * Based on CHROME_CDP_PROFILE_SCANNER.md
 */

import { WebSocket } from 'ws';

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
}

export class PuppeteerProfileFetcher {
  private cdpUrl: string;
  private pageId: string | null = null;

  constructor(cdpUrl: string = 'http://localhost:18800') {
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
   * Get or create page ID for the given URL
   */
  private async getPageId(url: string): Promise<string | null> {
    try {
      // Get list of all pages
      const response = await fetch(`${this.cdpUrl}/json`);
      const pages = await response.json();

      // Check if page with this URL already exists
      const existingPage = pages.find((p: any) =>
        p.url.includes(url) && p.type === 'page'
      );
      if (existingPage) {
        console.log(`Found existing page: ${existingPage.id}`);
        return existingPage.id;
      }

      // If not found, return first page ID (user will need to navigate)
      const firstPage = pages.find((p: any) => p.type === 'page');
      if (firstPage) {
        console.log(`Using first page: ${firstPage.id} (user should navigate to ${url})`);
        return firstPage.id;
      }

      return null;
    } catch (error) {
      console.error('Error getting page ID:', error);
      return null;
    }
  }

  /**
   * Execute JavaScript in a Chrome tab via CDP WebSocket
   */
  private async executeScript(pageId: string, script: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:18800/devtools/page/${pageId}`);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression: script,
            returnByValue: true,
            awaitPromise: true,
          },
        }));
      });

      ws.on('message', (data) => {
        try {
          const result = JSON.parse(data.toString());
          if (result.id === 1) {
            if (result.result) {
              if (result.result.exceptionDetails) {
                reject(new Error(result.result.exceptionDetails.description));
              } else {
                resolve(result.result.value);
              }
            } else {
              reject(new Error('No result from script execution'));
            }
            ws.close();
          }
        } catch (error) {
          reject(error);
          ws.close();
        }
      });

      ws.on('error', reject);
      ws.on('close', () => {
        // Ignore close events
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        ws.close();
        reject(new Error('Script execution timeout'));
      }, 10000);
    });
  }

  /**
   * Get profile data from X.com using Chrome CDP
   */
  async fetchProfile(username: string): Promise<ProfileData | null> {
    try {
      const cleanUsername = username.replace(/^@/, '');
      const xUrl = `x.com/${cleanUsername}`;

      console.log(`Fetching profile via CDP: ${xUrl}`);

      // Get page ID
      const pageId = await this.getPageId(xUrl);
      if (!pageId) {
        throw new Error('No Chrome page available. Please open Chrome with CDP on port 18800.');
      }

      // Execute extraction script
      const extractionScript = `
        (function() {
          function parseNum(value) {
            if (!value) return 0;
            const str = String(value).toUpperCase().replace(/,/g, '').trim();
            if (str.endsWith('K')) return parseFloat(str) * 1000;
            if (str.endsWith('M')) return parseFloat(str) * 1000000;
            if (str.endsWith('B')) return parseFloat(str) * 1000000000;
            return parseInt(str) || 0;
          }

          const data = {
            username: '${cleanUsername}',
            displayName: null,
            verified: false,
            verifiedType: null,
            followers: 0,
            following: 0,
            tweets: 0,
            bio: null,
            location: null,
            website: null,
            profileImage: null,
          };

          try {
            // Username
            const usernameEl = document.querySelector('[data-testid="UserScreenName"] span');
            if (usernameEl) {
              data.username = usernameEl.textContent?.replace('@', '') || cleanUsername;
            }

            // Display name
            const nameEl = document.querySelector('[data-testid="UserName"] span');
            if (nameEl) {
              data.displayName = nameEl.textContent?.trim() || null;
            }

            // Verified status - multiple selectors for reliability
            const verifiedSelectors = [
              '[data-testid="UserVerifiedBadge"]',
              '[data-testid="verificationBadge"]',
              '[aria-label="Verified account"]',
              '[aria-label="Verified"]',
            ];
            for (const selector of verifiedSelectors) {
              const el = document.querySelector(selector);
              if (el) {
                data.verified = true;
                data.verifiedType = 'blue';
                break;
              }
            }

            // Bio
            const bioEl = document.querySelector('[data-testid="UserDescription"]');
            if (bioEl) {
              data.bio = bioEl.textContent?.trim() || null;
            }

            // Body text for stats extraction
            const bodyText = document.body?.innerText?.substring(0, 8000) || '';

            // Followers
            const followersMatch = bodyText.match(/([\\d,.KkMmBb]+)\\s*Followers/i);
            if (followersMatch) {
              data.followers = parseNum(followersMatch[1]);
            } else {
              const followersEl = document.querySelector('a[href$="/followers"]');
              if (followersEl) {
                data.followers = parseNum(followersEl.textContent || '');
              }
            }

            // Following
            const followingMatch = bodyText.match(/([\\d,.KkMmBb]+)\\s*Following/i);
            if (followingMatch) {
              data.following = parseNum(followingMatch[1]);
            } else {
              const followingEl = document.querySelector('a[href$="/following"]');
              if (followingEl) {
                data.following = parseNum(followingEl.textContent || '');
              }
            }

            // Posts/Tweets
            const postsMatch = bodyText.match(/([\\d,.KkMmBb]+)\\s*posts/i);
            if (postsMatch) {
              data.tweets = parseNum(postsMatch[1]);
            } else {
              // Try alternative selector
              const tweetsEl = document.querySelector('[data-testid="UserDescription"] + div span');
              if (tweetsEl) {
                data.tweets = parseNum(tweetsEl.textContent || '');
              }
            }

            // Profile image
            const imgEl = document.querySelector('[data-testid="UserAvatar"] img');
            if (imgEl) {
              data.profileImage = imgEl.getAttribute('src') || null;
            }

            // Location
            const locationEl = document.querySelector('[data-testid="UserLocation"] span');
            if (locationEl) {
              data.location = locationEl.textContent?.trim() || null;
            }

            // Website
            const urlEl = document.querySelector('[data-testid="UserUrl"] span');
            if (urlEl) {
              data.website = urlEl.textContent?.trim() || null;
            }

            // Join date from body text
            const joinedMatch = bodyText.match(/Joined\\s+([A-Za-z]+\\s+\\d{4})/i);
            if (joinedMatch) {
              data.createdAt = joinedMatch[1];
            }

          } catch (error) {
            console.error('Error extracting profile data:', error);
          }

          return data;
        })();
      `;

      const result = await this.executeScript(pageId, extractionScript);

      if (!result) {
        throw new Error('Failed to extract profile data');
      }

      console.log('Profile data extracted:', result);

      return {
        username: result.username || cleanUsername,
        displayName: result.displayName || cleanUsername,
        verified: result.verified || false,
        verifiedType: result.verifiedType,
        followers: result.followers || 0,
        following: result.following || 0,
        tweets: result.tweets || 0,
        bio: result.bio,
        location: result.location,
        website: result.website,
        profileImage: result.profileImage,
        createdAt: result.createdAt,
      };

    } catch (error) {
      console.error(`CDP fetch failed: ${error}`);
      return null;
    }
  }

  /**
   * Parse number strings like "12.5K", "1.2M"
   * @deprecated - moved to extraction script
   */
  private parseNumber(value: string): number {
    if (!value) return 0;

    const str = value.toUpperCase().replace(/,/g, '').trim();

    if (str.endsWith('K')) {
      return parseFloat(str) * 1000;
    } else if (str.endsWith('M')) {
      return parseFloat(str) * 1000000;
    } else if (str.endsWith('B')) {
      return parseFloat(str) * 1000000000;
    }

    return parseInt(str) || 0;
  }
}

export default PuppeteerProfileFetcher;