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
        method: 'DOM.getDocument',
        params: { depth: -1 }
      }));
    } else if (response.id === 2) {
      ws.send(JSON.stringify({
        id: 3,
        method: 'DOM.getOuterHTML',
        params: { nodeId: response.result.root.nodeId }
      }));
    } else if (response.id === 3) {
      const html = response.result.outerHTML;
      
      // Extract specific patterns
      // Look for "blocked" in text
      const blockedMatch = html.match(/blocked/i);
      const suspendedMatch = html.match(/suspended/i);
      const notFoundMatch = html.match(/not found|doesn't exist|unavailable/i);
      
      // Look for profile name patterns
      const nameMatch = html.match(/"name"\s*:\s*"([^"]+)"/);
      const screenNameMatch = html.match(/"screen_name"\s*:\s*"([^"]+)"/);
      
      // Look for visible text content
      const textContentMatch = html.match(/<div[^>]*data-testid="UserName"[^>]*>([^<]+)</);
      const bioMatch = html.match(/<div[^>]*data-testid="UserDescription"[^>]*>([^<]+)</);
      
      // Check for "Something went wrong" or error states
      const wentWrongMatch = html.match(/Something went wrong|try again|error occurred/i);
      
      // Look for "Mania" in the page
      const maniaMatch = html.match(/Mania/i);
      const degenMatch = html.match(/Degen_chad119/i);
      
      // Extract meta tags
      const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/);
      const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/);
      
      // Check for login prompt
      const loginPrompt = html.includes('Log in to') || html.includes('Sign up');
      
      console.log(JSON.stringify({
        blocked: blockedMatch ? blockedMatch[0] : null,
        suspended: suspendedMatch ? suspendedMatch[0] : null,
        notFound: notFoundMatch ? notFoundMatch[0] : null,
        wentWrong: wentWrongMatch ? wentWrongMatch[0] : null,
        hasMania: maniaMatch ? 'yes' : 'no',
        hasDegen: degenMatch ? 'yes' : 'no',
        loginPrompt,
        name: nameMatch ? nameMatch[1] : null,
        screenName: screenNameMatch ? screenNameMatch[1] : null,
        metaDesc: metaDescMatch ? metaDescMatch[1] : null,
        ogTitle: ogTitleMatch ? ogTitleMatch[1] : null,
        // Find any visible error text
        errorDivMatch: html.match(/<div[^>]*class="[^"]*error[^"]*"[^>]*>([^<]{0,100})</)
      }, null, 2));
      
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
