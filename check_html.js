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
      
      // Check for key patterns
      const hasContent = html.includes('Degen_chad119') || html.includes('Mania') || html.includes('bio') || html.includes('followers');
      const isSuspended = /suspended|blocked|not found|doesn't exist|Account suspended|unavailable/i.test(html);
      const isLoading = html.length < 50000;
      const hasReactRoot = html.includes('react-root') || html.includes('__NEXT_DATA__');
      
      // Extract title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch ? titleMatch[1] : '';
      
      // Look for any error messages
      const errorMatch = html.match(/class="error[^"]*"[^>]*>([^<]+)</);
      const errorMsg = errorMatch ? errorMatch[1] : null;
      
      // Check for login wall
      const loginWall = html.includes('Log in') && html.includes('Sign up') && !hasContent;
      
      console.log(JSON.stringify({
        htmlLength: html.length,
        title,
        hasContent,
        isSuspended,
        isLoading,
        hasReactRoot,
        loginWall,
        errorMsg,
        firstChars: html.substring(0, 500)
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
