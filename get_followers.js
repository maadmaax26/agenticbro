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
      ws.send(JSON.stringify({
        id: 2,
        method: 'Runtime.evaluate',
        params: {
          expression: `
            (() => {
              // Get follower count from nav tabs
              const navTabs = document.querySelectorAll('[role="tablist"] [role="tab"]');
              let posts = '0', following = '0', followers = '0';
              
              navTabs.forEach(tab => {
                const text = tab.textContent || '';
                const match = text.match(/([0-9,.]+[KkMmBb]?)/);
                if (match) {
                  if (text.includes('Post') || text.includes('post')) posts = match[1];
                  else if (text.includes('Following') || text.includes('following')) following = match[1];
                  else if (text.includes('Follower') || text.includes('follower')) followers = match[1];
                }
              });
              
              // Also try the links
              document.querySelectorAll('nav[role="navigation"] a').forEach(link => {
                const href = link.getAttribute('href') || '';
                const text = link.textContent || '';
                const match = text.match(/([0-9,.]+[KkMmBb]?)/);
                if (match) {
                  if (href.includes('/followers')) followers = match[1];
                  if (href.includes('/following')) following = match[1];
                }
              });
              
              // Get more tweets
              const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
              const tweets = Array.from(tweetEls).slice(0, 10).map(t => {
                const text = t.querySelector('[data-testid="tweetText"]')?.textContent || '';
                const time = t.querySelector('time')?.getAttribute('datetime') || '';
                const likes = t.querySelector('[data-testid="like"] span')?.textContent || '0';
                const retweets = t.querySelector('[data-testid="retweet"] span')?.textContent || '0';
                const replies = t.querySelector('[data-testid="reply"] span')?.textContent || '0';
                return { text: text.substring(0, 280), time, likes, retweets, replies };
              });
              
              // Check for any links in bio
              const bioLink = document.querySelector('[data-testid="UserDescription"] + div a')?.href || '';
              
              // Get all visible text from profile header
              const headerText = document.querySelector('[data-testid="UserName"]')?.closest('div')?.innerText || '';
              
              return JSON.stringify({
                posts,
                followers,
                following,
                bioLink,
                headerText: headerText.substring(0, 500),
                tweets,
                hasTelegram: document.body.innerHTML.includes('t.me'),
                hasCashTags: (document.body.innerHTML.match(/\\$[A-Z]+/g) || []).slice(0, 20)
              });
            })()
          `,
          returnByValue: true
        }
      }));
    } else if (response.id === 2) {
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
