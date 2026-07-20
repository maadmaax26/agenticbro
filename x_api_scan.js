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
      // Navigate fresh and try to get user data
      ws.send(JSON.stringify({
        id: 2,
        method: 'Page.navigate',
        params: { url: 'https://x.com/Degen_chad119' }
      }));
    } else if (response.id === 2) {
      console.error('Waiting 20 seconds for full page load...');
      setTimeout(() => {
        // Try to extract user data from X's internal state
        ws.send(JSON.stringify({
          id: 3,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              (() => {
                // Try multiple methods to get user data
                
                // Method 1: Check for error states
                const bodyText = document.body?.innerText || '';
                const hasError = /Something went wrong|suspended|blocked|unavailable|not found|doesn't exist/i.test(bodyText);
                const errorMessage = hasError ? bodyText.substring(0, 500) : '';
                
                // Method 2: Try window.__INITIAL_STATE__
                let userData = null;
                if (window.__INITIAL_STATE__?.entities?.users?.entities) {
                  const users = window.__INITIAL_STATE__.entities.users.entities;
                  const userIds = Object.keys(users);
                  for (const id of userIds) {
                    const u = users[id];
                    if (u.screen_name && u.screen_name.toLowerCase().includes('degen')) {
                      userData = u;
                      break;
                    }
                  }
                }
                
                // Method 3: Check meta tags
                const metaTags = {};
                document.querySelectorAll('meta').forEach(m => {
                  const name = m.getAttribute('name') || m.getAttribute('property');
                  const content = m.getAttribute('content');
                  if (name && content) metaTags[name] = content;
                });
                
                // Method 4: Check title
                const title = document.title;
                
                // Method 5: Try to find any profile data in page
                const jsonLdScripts = [];
                document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
                  try {
                    jsonLdScripts.push(JSON.parse(s.textContent));
                  } catch (e) {}
                });
                
                // Method 6: Check for login wall
                const loginWall = bodyText.includes('Log in') && bodyText.includes('Sign up') && bodyText.length < 1000;
                
                return JSON.stringify({
                  hasError,
                  errorMessage: errorMessage.substring(0, 300),
                  title,
                  metaTags,
                  userData: userData ? {
                    screen_name: userData.screen_name,
                    name: userData.name,
                    followers_count: userData.followers_count,
                    friends_count: userData.friends_count,
                    verified: userData.verified,
                    created_at: userData.created_at,
                    description: userData.description,
                    location: userData.location,
                    url: userData.url,
                    statuses_count: userData.statuses_count
                  } : null,
                  jsonLd: jsonLdScripts.length > 0 ? jsonLdScripts : null,
                  loginWall,
                  pageUrl: window.location.href,
                  bodyLength: bodyText.length
                });
              })()
            `,
            returnByValue: true
          }
        }));
      }, 20000);
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
