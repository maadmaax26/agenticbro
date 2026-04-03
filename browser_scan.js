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
  // Find any X.com page to use
  const xPage = pages.find(p => p.url.includes('x.com'));
  
  if (!xPage) {
    console.error('No X page found');
    process.exit(1);
  }
  
  console.error(`Using tab: ${xPage.url.substring(0, 50)}...`);
  
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
      console.error('Waiting 15 seconds for page load...');
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 3,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              (() => {
                // Check for error states first
                const bodyText = document.body?.innerText || '';
                const html = document.documentElement?.outerHTML || '';
                
                // Error detection
                const hasError = /Something went wrong|try again|error/i.test(bodyText);
                const isSuspended = /Account suspended|suspended|blocked/i.test(html);
                const notFound = /doesn't exist|not found|unavailable/i.test(html);
                
                // Extract profile data if available
                const handle = window.location.pathname.split('/').pop();
                
                // DisplayName
                const displayNameEl = document.querySelector('[data-testid="UserName"] span');
                const displayName = displayNameEl ? displayNameEl.textContent : '';
                
                // Bio
                const bioEl = document.querySelector('[data-testid="UserDescription"]');
                const bio = bioEl ? bioEl.textContent : '';
                
                // Followers/Following
                let followers = '0', following = '0';
                document.querySelectorAll('nav a').forEach(link => {
                  const href = link.getAttribute('href') || '';
                  const text = link.textContent || '';
                  const match = text.match(/([0-9,.]+[KkMmBb]?)/);
                  if (href.includes('/followers') && match) followers = match[1];
                  if (href.includes('/following') && match) following = match[1];
                });
                
                // Join date
                let joinDate = '';
                document.querySelectorAll('span').forEach(s => {
                  if (/^Joined/.test(s.textContent)) joinDate = s.textContent;
                });
                
                // Verified
                const verified = !!document.querySelector('[data-testid="verificationIcon"]');
                
                // Location
                const locationEl = document.querySelector('[data-testid="UserLocation"]');
                const location = locationEl ? locationEl.textContent : '';
                
                // Website
                const websiteEl = document.querySelector('[data-testid="UserProfileHeader_Items"] a[href^="http"]');
                const website = websiteEl ? websiteEl.href : '';
                
                // Tweets
                const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
                const tweets = Array.from(tweetEls).slice(0, 5).map(t => {
                  const text = t.querySelector('[data-testid="tweetText"]')?.textContent || '';
                  return text.substring(0, 200);
                });
                
                // Title
                const title = document.title;
                
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
                  hasError,
                  isSuspended,
                  notFound,
                  title,
                  bodyTextSample: bodyText.substring(0, 300),
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
