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
              // Get follower/following/post counts from the profile stats bar
              const statsBar = document.querySelector('[data-testid="UserName"]')?.closest('div')?.parentElement?.parentElement;
              
              // Try multiple selectors
              const allLinks = document.querySelectorAll('a[href*="/followers"], a[href*="/following"]');
              let followers = '0', following = '0';
              
              allLinks.forEach(link => {
                const href = link.getAttribute('href') || '';
                const spans = link.querySelectorAll('span');
                spans.forEach(span => {
                  const text = span.textContent || '';
                  const num = text.replace(/[^0-9.KkMmBb]/g, '');
                  if (num && (text.includes('Follower') || href.includes('/followers'))) {
                    if (num.match(/[0-9]/)) followers = num;
                  }
                  if (num && (text.includes('Following') || href.includes('/following'))) {
                    if (num.match(/[0-9]/)) following = num;
                  }
                });
              });
              
              // Alternative: parse from page text
              const body = document.body.innerText;
              const followerMatch = body.match(/([0-9,.]+[KkMmBb]?)\\s*Followers?/i);
              const followingMatch = body.match(/([0-9,.]+[KkMmBb]?)\\s*Following/i);
              
              if (followerMatch && followers === '0') followers = followerMatch[1];
              if (followingMatch && following === '0') following = followingMatch[1];
              
              // Get post count from profile
              const postTab = document.querySelector('[role="tablist"] [role="tab"]');
              const posts = postTab ? postTab.textContent : '0';
              
              // Extract numbers from bio area
              const profileArea = document.querySelector('[data-testid="UserName"]')?.closest('div');
              const profileText = profileArea?.innerText || '';
              
              // Check verification
              const verified = !!document.querySelector('[data-testid="verificationIcon"]');
              const blueCheck = !!document.querySelector('[data-testid="icon"] svg');
              
              // Check for gold checkmark (verified org)
              const goldCheck = document.body.innerHTML.includes('verificationIcon') && document.body.innerHTML.includes('gold');
              
              return JSON.stringify({
                followers: followers || (followerMatch ? followerMatch[1] : '0'),
                following: following || (followingMatch ? followingMatch[1] : '0'),
                posts,
                verified,
                blueCheck,
                goldCheck,
                profileTextSample: profileText.substring(0, 300)
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
