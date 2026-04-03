import { WebSocket } from 'ws';

const ws = new WebSocket('ws://localhost:18800/devtools/page/EFDAD177971B3ADDE0CFF2C7FC9C8E8C');

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());
  
  if (response.id === 1) {
    console.error('Navigating...');
    ws.send(JSON.stringify({
      id: 2,
      method: 'Page.navigate',
      params: { url: 'https://x.com/Degen_chad119' }
    }));
  } else if (response.id === 2) {
    console.error('Waiting 8 seconds for page load...');
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
              const handle = document.querySelector('[data-testid="UserName"] a')?.href?.split('/').pop() || 'Degen_chad119';
              const bio = document.querySelector('[data-testid="UserDescription"]')?.textContent || '';
              const bioLink = document.querySelector('[data-testid="UserDescription"] + div a')?.href || '';
              
              // Follower/Following counts
              const nav = document.querySelector('nav[role="navigation"]');
              const links = nav?.querySelectorAll('a') || [];
              let followers = '0', following = '0';
              
              links.forEach(link => {
                const href = link.getAttribute('href') || '';
                const text = link.textContent || '';
                if (href.includes('/followers')) {
                  const span = link.querySelector('span');
                  followers = extractCount(span);
                }
                if (href.includes('/following')) {
                  const span = link.querySelector('span');
                  following = extractCount(span);
                }
              });
              
              // Join date
              const joinSpan = Array.from(document.querySelectorAll('span')).find(s => s.textContent?.includes('Joined'));
              const joinDate = joinSpan?.textContent || '';
              
              // Verified?
              const verified = document.querySelector('[data-testid="verificationIcon"]') ? true : false;
              
              // Location
              const location = document.querySelector('[data-testid="UserLocation"]')?.textContent || '';
              
              // Website
              const website = document.querySelector('[data-testid="UserProfileHeader_Items"] a[href^="http"]')?.href || '';
              
              // Tweet count from profile link
              const tweetCountEl = document.querySelector('a[href="/Degen_chad119"] span');
              const tweetCount = extractCount(tweetCountEl);
              
              // Recent tweets
              const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
              const tweets = Array.from(tweetEls).slice(0, 10).map(t => {
                const text = t.querySelector('[data-testid="tweetText"]')?.textContent || '';
                return text.substring(0, 280);
              });
              
              return JSON.stringify({
                handle: '@' + handle,
                displayName,
                bio,
                bioLink,
                followers,
                following,
                verified,
                joinDate,
                location,
                website,
                tweetCount,
                tweetCountRaw: tweetEls.length,
                recentTweets: tweets,
                pageUrl: window.location.href
              });
            })()
          `,
          returnByValue: true
        }
      }));
    }, 8000);
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

setTimeout(() => {
  console.error('Timeout');
  process.exit(1);
}, 25000);
