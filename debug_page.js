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
  
  console.error(`Using page: ${xPage.url}`);
  
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
      // Extract key info from HTML
      const html = response.result.outerHTML;
      
      // Look for specific patterns
      const handleMatch = html.match(/Degen_chad119/i);
      const suspendedMatch = html.match(/suspended|blocked|not found|doesn't exist|Account suspended/i);
      const errorMatch = html.match(/Something went wrong|error|try again/i);
      
      // Try to find profile data
      const titleMatch = html.match(/<title>([^<]+)<\\/title>/);
      
      // Look for user data in JSON
      const jsonMatch = html.match(/"screen_name":"([^"]+)"/);
      const nameMatch = html.match(/"name":"([^"]+)"/);
      const followersMatch = html.match(/"followers_count":([0-9]+)/);
      const followingMatch = html.match(/"friends_count":([0-9]+)/);
      const verifiedMatch = html.match(/"verified":(true|false)/);
      const createdMatch = html.match(/"created_at":"([^"]+)"/);
      const bioMatch = html.match(/"description":"([^"]+)"/);
      
      console.log(JSON.stringify({
        title: titleMatch?.[1] || '',
        foundHandle: handleMatch ? 'yes' : 'no',
        suspended: suspendedMatch ? suspendedMatch[0] : null,
        error: errorMatch ? errorMatch[0] : null,
        screen_name: jsonMatch?.[1] || null,
        name: nameMatch?.[1] || null,
        followers: followersMatch?.[1] || null,
        following: followingMatch?.[1] || null,
        verified: verifiedMatch?.[1] || null,
        created_at: createdMatch?.[1] || null,
        bio: bioMatch?.[1]?.substring(0, 200) || null
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
