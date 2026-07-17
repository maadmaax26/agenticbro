/**
 * API: /api/wallet-proxy
 * 
 * Proxies dApp URLs, strips security headers, and injects wallet proxy script.
 * This allows dApps to load in iframes while our mock wallet intercepts transactions.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

// Allowed origins for proxying
// Note: Complex dApps (Jupiter, Raydium) won't work due to CSP/CORS
// But simpler sites and many phishing sites WILL work
const ALLOWED_DOMAINS = [
  'jupiter.ag',
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
    // We need to inject the dApp URL into the script for the router fix
    const dappUrl = url;
    
    const walletProxyScript = `
<script>
// Agentic Bro Wallet Proxy Injection
(function() {
  // Check if already injected
  if (window.__AGENTIC_BRO_PROXY__) return;
  window.__AGENTIC_BRO_PROXY__ = true;

  // ── ROUTER FIX: Patch history + URL + changeState so Next.js can hydrate ──
  var _nRS = History.prototype.replaceState.bind(history);
  var _nPS = History.prototype.pushState.bind(history);
  var _proxyBase = 'https://agenticbro.app';
  var _dappUrl = '${dappUrl}';

  function _mapUrl(u) {
    if (!u || typeof u !== 'string') return u;
    var m = u.match(/^https?:\/\/(?:www\.)?raydium\.io(\/.*)?$/);
    return m ? _proxyBase + '/api/wallet-proxy?url=' +
      encodeURIComponent('https://raydium.io' + (m[1] || '/')) : u;
  }

  history.replaceState = function(s,t,u){ try{ _nRS(s,t,_mapUrl(u)); }catch(e){} };
  history.pushState = function(s,t,u){ try{ _nPS(s,t,_mapUrl(u)); }catch(e){} };

  var _ph = window.location.href;
  var _OU = window.URL;
  window.URL = function(u,b){
    if(u===_ph) u=_dappUrl;
    if(b===_ph) b=_dappUrl;
    return new _OU(u,b);
  };
  window.URL.prototype = _OU.prototype;
  ['createObjectURL','revokeObjectURL','canParse'].forEach(function(m){
    if(_OU[m]) window.URL[m]=_OU[m].bind(_OU);
  });

  document.addEventListener('DOMContentLoaded', function() {
    var t = setInterval(function() {
      var nr = window['__next_require__'];
      if (!nr) return;
      clearInterval(t);
      try {
        var nm = nr('77339');
        var proto = Object.getPrototypeOf(nm.router);
        proto.changeState = function(method, state, url, as) {
          try { (method==='replaceState'?_nRS:_nPS)(state,'',_mapUrl(url||as)); }catch(e){}
        };
        nm.hydrate().catch(function(){});
      } catch(e) {}
    }, 100);
  });
  // ── END ROUTER FIX ──

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

    // Remove any existing CSP meta tags that might block our scripts
    html = html.replace(/<meta[^>]*http-equiv=['"]Content-Security-Policy['"][^>]*>/gi, '');
    html = html.replace(/<meta[^>]*content=['"][^'"]*Content-Security-Policy[^'"]*['"][^>]*>/gi, '');
    
    // Remove X-Frame-Options meta tag if present
    html = html.replace(/<meta[^>]*http-equiv=['"]X-Frame-Options['"][^>]*>/gi, '');
    
    const origin = targetUrl.origin;
    
    // Add base tag so relative URLs resolve correctly
    const baseTag = `<base href="${origin}/" />`;
    
    // Insert base tag and wallet script at the beginning of head
    // Base tag MUST be first for URLs to resolve correctly
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${baseTag}${walletProxyScript}`);
    } else if (html.includes('<HEAD>')) {
      html = html.replace('<HEAD>', `<HEAD>${baseTag}${walletProxyScript}`);
    } else {
      // No head tag, prepend after DOCTYPE
      html = html.replace(/<!DOCTYPE[^>]*>/i, `$&${baseTag}${walletProxyScript}`);
    }

    // Return modified HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Allow iframe embedding from our domain and allow the dApp to load its resources
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-ancestors 'self' https://agenticbro.app http://localhost:3000;");
    
    return res.send(html);

  } catch (error) {
    console.error('[Wallet Proxy] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy dApp',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}