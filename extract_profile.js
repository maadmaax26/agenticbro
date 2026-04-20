import { WebSocket } from 'ws';

const pageId = 'EFDAD177971B3ADDE0CFF2C7FC9C8E8C';
const ws = new WebSocket(`ws://localhost:18800/devtools/page/${pageId}`);

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());
  
  if (response.id === 1) {
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 2,
        method: 'Runtime.evaluate',
        params: {
          expression: `
            (() => {
              const extractNum = (s) => s?.replace(/[^0-9.KkMmBb]/g, '') || '0';
              
              // Get all text content from profile header
              const headerItems = Array.from(document.querySelectorAll('[data-testid="UserProfileHeader_Items"] span')).map(s => s.textContent);
              
              // Get followers count from stats
              const statsLinks = document.querySelectorAll('nav[role="navigation"] a');
              let followers = '0', following = '0';
              statsLinks.forEach(link => {
                const text = link.textContent || '';
                if (text.includes('Followers')) followers = extractNum(text);
                if (text.includes('Following')) following = extractNum(text);
              });
              
              // Get bio link
              const bioLink = document.querySelector('[data-testid="UserDescription"] + div a')?.href || '';
              
              // Get recent tweets
              const tweets = Array.from(document.querySelectorAll('[data-testid="tweet"]')).slice(0, 5).map(t => {
                const text = t.querySelector('[data-testid="tweetText"]')?.textContent || '';
                const time = t.querySelector('time')?.getAttribute('datetime') || '';
                const likes = t.querySelector('[data-testid="like"] span')?.textContent || '0';
                const retweets = t.querySelector('[data-testid="retweet"] span')?.textContent || '0';
                return { text: text.substring(0, 200), time, likes, retweets };
              });
              
              // Get stats from profile stats area
              const statsArea = document.querySelector('[data-testid="UserName"]')?.closest('div');
              const parentText = statsArea?.parentElement?.textContent || '';
              
              // Try alternative selectors
              const followerCount = document.querySelector('[data-testid="UserName"] + div')?.textContent || '';
              
              return JSON.stringify({
                username: '@Degen_chad119',
                displayName: document.querySelector('[data-testid="UserName"] span')?.textContent || 'Mania',
                bio: document.querySelector('[data-testid="UserDescription"]')?.textContent || '',
                bioLink: bioLink,
                headerItems: headerItems,
                followersRaw: followers,
                followingRaw: following,
                parentText: parentText.substring(0, 500),
                tweets: tweets,
                url: window.location.href
              });
            })()
          `,
          returnByValue: true
        }
      }));
    }, 500);
  } else if (response.id === 2) {
    if (response.result && response.result.result) {
      console.log(response.result.result.value);
    }
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

setTimeout(() => {
  console.error('Timeout');
  process.exit(1);
}, 10000);
