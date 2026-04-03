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
      // Scroll down and wait
      console.error('Scrolling to trigger lazy load...');
      ws.send(JSON.stringify({
        id: 2,
        method: 'Runtime.evaluate',
        params: {
          expression: 'window.scrollTo(0, document.body.scrollHeight);'
        }
      }));
    } else if (response.id === 2) {
      console.error('Waiting 25 seconds...');
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 3,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              (() => {
                const body = document.body;
                const html = document.documentElement;
                
                // Get ALL text
                const allText = body?.innerText || '';
                const allHtml = html?.outerHTML || '';
                
                // Find any visible content
                const textNodes = [];
                const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null, false);
                let node;
                let count = 0;
                while (node = walker.nextNode()) {
                  if (node.textContent.trim() && count < 50) {
                    textNodes.push(node.textContent.trim().substring(0, 100));
                    count++;
                  }
                }
                
                // Check for specific error patterns
                const hasSuspended = /Account\s+suspended|This account is suspended/i.test(allHtml);
                const hasBlocked = /blocked|unavailable/i.test(allHtml);
                const hasNotFound = /This account doesn't exist|not found/i.test(allHtml);
                const hasSomethingWrong = /Something went wrong/i.test(allHtml);
                
                // Try to find user data in scripts
                const scripts = document.querySelectorAll('script');
                let userData = null;
                for (const script of scripts) {
                  const text = script.textContent || '';
                  if (text.includes('Degen_chad119') || text.includes('screen_name')) {
                    const match = text.match(/"screen_name":"([^"]+)"/);
                    if (match) {
                      const nameMatch = text.match(/"name":"([^"]+)"/);
                      const followersMatch = text.match(/"followers_count":([0-9]+)/);
                      const followingMatch = text.match(/"friends_count":([0-9]+)/);
                      const verifiedMatch = text.match(/"verified":(true|false)/);
                      const createdMatch = text.match(/"created_at":"([^"]+)"/);
                      const descMatch = text.match(/"description":"([^"]+)"/);
                      userData = {
                        screen_name: match[1],
                        name: nameMatch?.[1],
                        followers: followersMatch?.[1],
                        following: followingMatch?.[1],
                        verified: verifiedMatch?.[1],
                        created_at: createdMatch?.[1],
                        description: descMatch?.[1]?.substring(0, 200)
                      };
                      break;
                    }
                  }
                }
                
                return JSON.stringify({
                  textNodes,
                  textLength: allText.length,
                  hasSuspended,
                  hasBlocked,
                  hasNotFound,
                  hasSomethingWrong,
                  userData,
                  title: document.title,
                  url: window.location.href
                });
              })()
            `,
            returnByValue: true
          }
        }));
      }, 25000);
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
