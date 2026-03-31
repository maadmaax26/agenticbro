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
}

export class ChromeProfileFetcher {
  private cdpUrl: string;

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
   * Get list of available pages/tabs
   */
  async getPages(): Promise<Array<{ id: string; url: string; title: string }>> {
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
        // Open new tab
        const response = await fetch(`${this.cdpUrl}/json/new?${encodeURIComponent(xUrl)}`);
        target = await response.json();
      }

      // Wait for page to load
      await this.sleep(5000);

      // Get updated page list
      const updatedPages = await this.getPages();
      target = updatedPages.find(p => p.id === target.id);

      // Use osascript to extract data from Chrome
      const profileData = await this.extractProfileData(cleanUsername);

      return profileData;

    } catch (error) {
      console.log(`Chrome CDP fetch failed: ${error}`);
      return null;
    }
  }

  /**
   * Extract profile data using AppleScript
   */
  private async extractProfileData(username: string): Promise<ProfileData | null> {
    try {
      // Find the X profile tab and extract data using JavaScript
      const script = `
        tell application "Google Chrome"
          set theTab to missing value
          
          repeat with w in windows
            repeat with t in tabs of w
              if URL of t contains "x.com/${username}" then
                set theTab to t
                exit repeat
              end if
            end repeat
            if theTab is not missing value then exit repeat
          end repeat
          
          if theTab is missing value then
            return "TAB_NOT_FOUND"
          end if
          
          -- Execute JavaScript to extract profile data
          set jsResult to execute theTab javascript "
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

              // Username
              const usernameEl = document.querySelector('[data-testid=\"UserScreenName\"] span');
              if (usernameEl) data.username = usernameEl.textContent.replace('@', '');

              // Display name
              const nameEl = document.querySelector('[data-testid=\"UserName\"]');
              if (nameEl) data.displayName = nameEl.textContent.trim();

              // Verified
              const verifiedEl = document.querySelector('[data-testid=\"icon-verified\"]');
              data.verified = !!verifiedEl;
              data.verifiedType = verifiedEl ? 'blue' : null;

              // Bio
              const bioEl = document.querySelector('[data-testid=\"UserDescription\"] div[dir=\"ltr\"]');
              if (bioEl) data.bio = bioEl.textContent.trim();

              // Follow stats
              const statsDiv = document.querySelector('[data-testid=\"UserName\"] + div + div');
              if (statsDiv) {
                const links = statsDiv.querySelectorAll('a');
                links.forEach(link => {
                  const text = link.textContent || '';
                  if (text.includes('Followers') || text.includes('followers')) {
                    const span = link.querySelector('span');
                    if (span) data.followers = parseNum(span.textContent || '');
                  }
                  if (text.includes('Following') || text.includes('following')) {
                    const span = link.querySelector('span');
                    if (span) data.following = parseNum(span.textContent || '');
                  }
                });
              }

              // Profile image
              const imgEl = document.querySelector('[data-testid=\"UserAvatar\"] img');
              if (imgEl) data.profileImage = imgEl.src;

              // Location
              const locationEl = document.querySelector('[data-testid=\"UserLocation\"] span');
              if (locationEl) data.location = locationEl.textContent.trim();

              // Website
              const urlEl = document.querySelector('[data-testid=\"UserUrl\"] span');
              if (urlEl) data.website = urlEl.textContent.trim();

              return JSON.stringify(data);
            })();
          "
          
          return jsResult
        end tell
      `;

      const { execFileSync } = require('child_process');
      const result = execFileSync('osascript', ['-e', script], { encoding: 'utf-8' });

      if (result.includes('TAB_NOT_FOUND')) {
        return null;
      }

      const data = JSON.parse(result);
      
      return {
        username: data.username || username,
        displayName: data.displayName || username,
        verified: data.verified,
        verifiedType: data.verifiedType,
        followers: this.parseNumber(data.followers),
        following: this.parseNumber(data.following),
        tweets: this.parseNumber(data.tweets),
        bio: data.bio,
        location: data.location,
        website: data.website,
        profileImage: data.profileImage,
        createdAt: new Date().toISOString(),
      };

    } catch (error) {
      console.log(`AppleScript extraction failed: ${error}`);
      return null;
    }
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