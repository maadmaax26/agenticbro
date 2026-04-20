import { WebSocket } from 'ws';
import http from 'http';

async function getPages() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:18800/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

try {
  const pages = await getPages();
  const xPage = pages.find(p => p.url.includes('Degen_chad119'));
  
  if (!xPage) {
    console.error('No page found');
    process.exit(1);
  }
  
  const ws = new WebSocket(xPage.webSocketDebuggerUrl);
  
  ws.on('message', (data) => {
    const response = JSON.parse(data.toString());
    
    if (response.id === 1) {
      // Reload the page fresh
      console.error('Reloading page...');
      ws.send(JSON.stringify({
        id: 2,
        method: 'Page.reload',
        params: { ignoreCache: true }
      }));
    } else if (response.id === 2) {
      console.error('Waiting 15 seconds for reload...');
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 3,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              (() => {
                // Get visible text content
                const body = document.body.innerText;
                const title = document.title;
                
                // Check for error states
                const suspended = /suspended|blocked|not found|doesn't exist|Account suspended|unavailable/i.test(body);
                const notFound = /This account doesn't exist|Account suspended|suspended|not available/i.test(body);
                
                // Try to extract profile data
                const handleEl = document.querySelector('[data-testid="UserName"] a');
                const handle = handleEl ? handleEl.href.split('/').pop() : '';
                
                const displayNameEl = document.querySelector('[data-testid="UserName"] span');
                const displayName = displayNameEl ? displayNameEl.textContent : '';
                
                const bioEl = document.querySelector('[data-testid="UserDescription"]');
                const bio = bioEl ? bioEl.textContent : '';
                
                // Follower counts
                const navLinks = document.querySelectorAll('nav a');
                let followers = '0', following = '0';
                navLinks.forEach(link => {
                  const href = link.getAttribute('href') || '';
                  const text = link.textContent || '';
                  if (href.includes('/followers')) {
                    const m = text.match(/([0-9,.]+[KkMmBb]?)/);
                    if (m) followers = m[1];
                  }
                  if (href.includes('/following')) {
                    const m = text.match(/([0-9,.]+[KkMmBb]?)/);
                    if (m) following = m[1];
                  }
                });
                
                // Join date
                const spans = document.querySelectorAll('span');
                let joinDate = '';
                spans.forEach(s => {
                  const t = s.textContent || '';
                  if (/^Joined/.test(t)) joinDate = t;
                });
                
                // Verified
                const verified = !!document.querySelector('[data-testid="verificationIcon"]');
                
                // Location
                const locationEl = document.querySelector('[data-testid="UserLocation"]');
                const location = locationEl ? locationEl.textContent : '';
                
                // Website
                const websiteEl = document.querySelector('[data-testid="UserProfileHeader_Items"] a[href^="http"]');
                const website = websiteEl ? websiteEl.href : '';
                
                // Recent tweets
                const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
                const tweets = [];
                tweetEls.forEach((t, i) => {
                  if (i < 5) {
                    const textEl = t.querySelector('[data-testid="tweetText"]');
                    if (textEl) tweets.push(textEl.textContent.substring(0, 200));
                  }
                });
                
                return JSON.stringify({
                  handle: '@' + handle,
                  displayName,
                  bio: bio.substring(0, 500),
                  followers,
                  following,
                  verified,
                  joinDate,
                  location,
                  website,
                  tweetCount: tweetEls.length,
                  recentTweets: tweets,
                  suspended,
                  notFound,
                  title,
                  pageUrl: window.location.href
                });
              })()
            `,
            returnByValue: true
          }
        }));
      }, 15000);
    } else if (response.id === 3) {
      console.log(response.result.result.value);
      ws.close();
      process.exit(0);
    }
  });
  
  ws.on('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    process.exit(1);
  });
  
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
