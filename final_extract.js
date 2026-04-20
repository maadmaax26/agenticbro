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
      // Scroll down slightly
      ws.send(JSON.stringify({
        id: 2,
        method: 'Runtime.evaluate',
        params: {
          expression: 'window.scrollBy(0, 300);'
        }
      }));
    } else if (response.id === 2) {
      console.error('Scrolled, waiting...');
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 3,
          method: 'Runtime.evaluate',
          params: {
            expression: `
              (() => {
                // Get all visible text
                const allText = document.body.innerText;
                
                // Find follower count pattern
                const followerPatterns = allText.match(/[0-9,.]+[KkMmBb]?\s*(?:Followers?|followers?)/g);
                const followingPatterns = allText.match(/[0-9,.]+[KkMmBb]?\s*(?:Following|following)/g);
                const postPatterns = allText.match(/[0-9,.]+[KkMmBb]?\s*(?:Posts?|posts?)/g);
                
                // Alternative: look for specific patterns in the DOM
                const profileHeader = document.querySelector('[data-testid="UserName"]')?.closest('div');
                const headerText = profileHeader?.parentElement?.innerText || '';
                
                // Try to find numbers
                const lines = allText.split('\\n');
                let followers = 'Unknown', following = 'Unknown', posts = 'Unknown';
                
                lines.forEach(line => {
                  const numMatch = line.match(/^([0-9,.]+[KkMmBb]?)$/);
                  if (numMatch) {
                    // Check context
                    const idx = lines.indexOf(line);
                    if (idx > 0) {
                      const prevLine = lines[idx - 1] || '';
                      if (/follower/i.test(prevLine)) followers = numMatch[1];
                      if (/following/i.test(prevLine)) following = numMatch[1];
                    }
                  }
                });
                
                // Get from title
                const title = document.title;
                
                // Extract follower from header area more carefully
                const headerDiv = document.querySelector('[data-testid="UserName"]');
                const siblingText = headerDiv?.parentElement?.textContent || '';
                
                // Look for numbers in specific format
                const statsMatch = siblingText.match(/([0-9,]+)\\s*Followers?/i);
                if (statsMatch) followers = statsMatch[1];
                
                const statsMatch2 = siblingText.match(/([0-9,]+)\\s*Following/i);
                if (statsMatch2) following = statsMatch2[1];
                
                // Try nav links one more time
                const nav = document.querySelector('nav[role="navigation"]');
                if (nav) {
                  const navText = nav.textContent || '';
                  const fMatch = navText.match(/([0-9,.]+[KkMmBb]?)\\s*Followers?/i);
                  const fgMatch = navText.match(/([0-9,.]+[KkMmBb]?)\\s*Following/i);
                  if (fMatch) followers = fMatch[1];
                  if (fgMatch) following = fgMatch[1];
                }
                
                return JSON.stringify({
                  title,
                  followers,
                  following,
                  posts,
                  headerText: headerText.substring(0, 500),
                  followerPatterns,
                  followingPatterns,
                  sampleLines: lines.slice(0, 30).join('\\n')
                });
              })()
            `,
            returnByValue: true
          }
        }));
      }, 3000);
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
