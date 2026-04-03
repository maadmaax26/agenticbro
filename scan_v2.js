import { WebSocket } from 'ws';

// Get fresh page list first via HTTP
const http = await import('http');

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
  // Find a page on x.com
  const xPage = pages.find(p => p.url.includes('x.com') && !p.url.includes('search'));
  
  if (!xPage) {
    console.error('No X page found');
    process.exit(1);
  }
  
  console.error(`Using page: ${xPage.url}`);
  
  const ws = new WebSocket(xPage.webSocketDebuggerUrl);
  
  ws.on('message', (data) => {
    const response = JSON.parse(data.toString());
    
    if (response.id === 1) {
      console.error('Navigating to @Degen_chad119...');
      ws.send(JSON.stringify({
        id: 2,
        method: 'Page.navigate',
        params: { url: 'https://x.com/Degen_chad119' }
      }));
    } else if (response.id === 2) {
      console.error('Waiting 12 seconds...');
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 3,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              (() => {
                const extractCount = (el) => {
                  if (!el) return '0';
                  const text = el.textContent || '';
                  const match = text.match(/([0-9,.]+[KkMmBb]?)/);
                  return match ? match[1] : '0';
                };
                
                const displayName = document.querySelector('[data-testid="UserName"] span')?.textContent || '';
                const handle = window.location.pathname.split('/').pop();
                const bio = document.querySelector('[data-testid="UserDescription"]')?.textContent || '';
                
                // Follower/Following - try multiple selectors
                let followers = '0', following = '0';
                
                // Method 1: Navigation links
                document.querySelectorAll('nav a').forEach(link => {
                  const href = link.getAttribute('href') || '';
                  const text = link.textContent || '';
                  if (href.includes('/followers')) followers = extractCount(link.querySelector('span'));
                  if (href.includes('/following')) following = extractCount(link.querySelector('span'));
                });
                
                // Method 2: Try direct text parsing
                if (followers === '0') {
                  const spans = document.querySelectorAll('span');
                  spans.forEach(s => {
                    const t = s.textContent || '';
                    if (t.includes('Followers')) followers = extractCount(s);
                    if (t.includes('Following')) following = extractCount(s);
                  });
                }
                
                // Join date
                const joinSpan = Array.from(document.querySelectorAll('span')).find(s => s.textContent?.match(/Joined\\s/));
                const joinDate = joinSpan?.textContent || '';
                
                // Verified?
                const verified = document.querySelector('[data-testid="verificationIcon"]') ? true : false;
                
                // Location
                const location = document.querySelector('[data-testid="UserLocation"]')?.textContent || '';
                
                // Website
                const website = document.querySelector('[data-testid="UserProfileHeader_Items"] a[href^="http"]')?.href || '';
                
                // Tweets
                const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
                const tweets = Array.from(tweetEls).slice(0, 5).map(t => {
                  return t.querySelector('[data-testid="tweetText"]')?.textContent?.substring(0, 200) || '';
                }).filter(t => t);
                
                return JSON.stringify({
                  handle: '@' + handle,
                  displayName,
                  bio,
                  followers,
                  following,
                  verified,
                  joinDate,
                  location,
                  website,
                  tweetCount: tweetEls.length,
                  recentTweets: tweets,
                  pageUrl: window.location.href
                });
              })()
            `,
            returnByValue: true
          }
        }));
      }, 12000);
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
