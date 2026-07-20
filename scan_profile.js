import { WebSocket } from 'ws';

const ws = new WebSocket('ws://localhost:18800/devtools/page/EFDAD177971B3ADDE0CFF2C7FC9C8E8C');

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());
  if (response.id === 1) {
    // Navigate to the profile
    ws.send(JSON.stringify({
      id: 2,
      method: 'Page.navigate',
      params: { url: 'https://x.com/Degen_chad119' }
    }));
  } else if (response.id === 2) {
    // Wait for page load then snapshot
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 3,
        method: 'DOM.getDocument',
        params: { depth: -1 }
      }));
    }, 6000);
  } else if (response.id === 3) {
    // Get outer HTML
    ws.send(JSON.stringify({
      id: 4,
      method: 'DOM.getOuterHTML',
      params: { nodeId: response.result.root.nodeId }
    }));
  } else if (response.id === 4) {
    console.log(response.result.outerHTML.substring(0, 80000));
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

// Timeout after 15 seconds
setTimeout(() => {
  console.error('Timeout');
  process.exit(1);
}, 15000);