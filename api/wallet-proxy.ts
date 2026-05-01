/**
 * API: /api/wallet-proxy
 * 
 * Proxies dApp URLs, strips security headers, and injects wallet proxy script.
 * This allows dApps to load in iframes while our mock wallet intercepts transactions.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

// Allowed origins for proxying
const ALLOWED_DOMAINS = [
  'jupiter.ag',
  'raydium.io',
  'raydium.io',
  'orca.so',
  'marinade.finance',
  'marginfi.com',
  'kamino.finance',
  'drift.trade',
  'phoenix.trade',
  'meteora.ag',
  'pump.fun',
  'pumpswap.fun',
  'moonshot.to',
  'openbook.solanatrader.io',
  'bullx.io',
];

// Blocked patterns (known drainer sites)
const BLOCKED_PATTERNS = [
  'drainer',
  'malware',
  'phishing',
  'scam',
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Validate URL
  let targetUrl: URL;
  try {
    targetUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // Security: Check for blocked patterns
  const urlLower = url.toLowerCase();
  for (const pattern of BLOCKED_PATTERNS) {
    if (urlLower.includes(pattern)) {
      return res.status(403).json({ 
        error: 'Blocked domain',
        reason: 'Domain matches blocked pattern'
      });
    }
  }

  // Security: Only allow specific protocols
  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return res.status(400).json({ error: 'Only HTTP/HTTPS URLs allowed' });
  }

  try {
    // Fetch the dApp
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'Failed to fetch dApp',
        status: response.status 
      });
    }

    let html = await response.text();

    // Inject wallet proxy script BEFORE any other scripts
    const walletProxyScript = `
<script>
// Agentic Bro Wallet Proxy Injection
(function() {
  // Check if already injected
  if (window.__AGENTIC_BRO_PROXY__) return;
  window.__AGENTIC_BRO_PROXY__ = true;

  // Mock wallet that communicates with parent window
  const mockWallet = {
    isPhantom: true,
    isConnected: false,
    publicKey: null,

    connect: async function() {
      return new Promise((resolve, reject) => {
        // Request connection from parent
        window.parent.postMessage({ 
          type: 'WALLET_CONNECT_REQUEST',
          origin: window.location.origin 
        }, '*');

        // Wait for response
        const handler = (event) => {
          if (event.data.type === 'WALLET_CONNECT_RESPONSE') {
            window.removeEventListener('message', handler);
            if (event.data.approved) {
              this.isConnected = true;
              this.publicKey = event.data.publicKey;
              resolve({ publicKey: this.publicKey });
            } else {
              reject(new Error('User rejected connection'));
            }
          }
        };
        window.addEventListener('message', handler);

        // Timeout after 60s
        setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('Connection timeout'));
        }, 60000);
      });
    },

    disconnect: async function() {
      this.isConnected = false;
      this.publicKey = null;
      window.parent.postMessage({ type: 'WALLET_DISCONNECT' }, '*');
    },

    signTransaction: async function(tx) {
      return this._signAndSend('signTransaction', tx);
    },

    signAndSendTransaction: async function(tx) {
      return this._signAndSend('signAndSendTransaction', tx);
    },

    signAllTransactions: async function(txs) {
      return this._signAndSend('signAllTransactions', txs);
    },

    signMessage: async function(message) {
      return new Promise((resolve, reject) => {
        window.parent.postMessage({
          type: 'WALLET_SIGN_MESSAGE',
          message: Array.from(message),
        }, '*');

        const handler = (event) => {
          if (event.data.type === 'WALLET_SIGN_MESSAGE_RESPONSE') {
            window.removeEventListener('message', handler);
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              resolve(new Uint8Array(event.data.signature));
            }
          }
        };
        window.addEventListener('message', handler);
      });
    },

    _signAndSend: async function(method, data) {
      return new Promise((resolve, reject) => {
        // Serialize transaction
        const serialized = data.serialize ? 
          Array.from(data.serialize()) : 
          JSON.stringify(data);

        window.parent.postMessage({
          type: 'WALLET_SIGN_REQUEST',
          method: method,
          transaction: serialized,
        }, '*');

        const handler = (event) => {
          if (event.data.type === 'WALLET_SIGN_RESPONSE') {
            window.removeEventListener('message', handler);
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              resolve(event.data.result);
            }
          }
        };
        window.addEventListener('message', handler);
      });
    },
  };

  // Inject into window.solana
  Object.defineProperty(window, 'solana', {
    value: mockWallet,
    writable: false,
    configurable: false,
  });

  // Also inject as phantom.solana for compatibility
  if (!window.phantom) {
    window.phantom = { solana: mockWallet };
  }

  // Signal ready to parent
  window.parent.postMessage({ type: 'DAPP_READY' }, '*');
})();
</script>
`;

    // Insert script at the beginning of head
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${walletProxyScript}`);
    } else if (html.includes('<HEAD>')) {
      html = html.replace('<HEAD>', `<HEAD>${walletProxyScript}`);
    } else {
      // No head tag, prepend
      html = walletProxyScript + html;
    }

    // Strip security headers that block iframe embedding
    const headersToRemove = [
      'x-frame-options',
      'content-security-policy',
      'x-content-type-options',
      'x-xss-protection',
    ];

    // Return modified HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Allow iframe embedding from our domain
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://agenticbro.app http://localhost:3000;");
    
    return res.send(html);

  } catch (error) {
    console.error('[Wallet Proxy] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy dApp',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}