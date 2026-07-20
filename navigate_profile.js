import { WebSocket } from 'ws';

const pageId = 'EFDAD177971B3ADDE0CFF2C7FC9C8E8C';
const ws = new WebSocket(`ws://localhost:18800/devtools/page/${pageId}`);

let step = 0;

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());
  
  if (response.id === 1) {
    // Page enabled, navigate to profile
    console.error('Navigating to profile...');
    ws.send(JSON.stringify({
      id: 2,
      method: 'Page.navigate',
      params: { url: 'https://x.com/Degen_chad119' }
    }));
  } else if (response.id === 2) {
    // Wait for load
    console.error('Waiting for page load...');
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 3,
        method: 'Runtime.evaluate',
        params: {
          expression: `
            (() => {
              const data = {
                username: document.querySelector('[data-testid="UserName"]')?.textContent || '',
                displayName: document.querySelector('h1')?.textContent || '',
                bio: document.querySelector('[data-testid="UserDescription"]')?.textContent || '',
                followers: document.querySelector('[href="/Degen_chad119/followers"] span')?.textContent || '',
                following: document.querySelector('[href="/Degen_chad119/following"] span')?.textContent || '',
                verified: document.querySelector('[data-testid="verificationIcon"]') ? true : false,
                joinDate: document.querySelector('[data-testid="UserProfileHeader_Items"] span')?.textContent || '',
                location: document.querySelector('[data-testid="UserLocation"]')?.textContent || '',
                website: document.querySelector('[data-testid="UserProfileHeader_Items"] a')?.href || '',
                tweetCount: document.querySelector('[href="/Degen_chad119"] span')?.textContent || ''
              };
              return JSON.stringify(data);
            })()
          `,
          returnByValue: true
        }
      }));
    }, 8000);
  } else if (response.id === 3) {
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
}, 20000);
