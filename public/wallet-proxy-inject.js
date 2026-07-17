/**
 * Wallet Proxy Injection Script
 * 
 * This script is injected into dApp iframes to intercept wallet calls
 * and route them through the Agentic Bro analysis layer.
 * 
 * Usage: Include in the dApp's <head> before any other scripts.
 */

(function() {
  // Prevent double injection
  if (window.__AGENTIC_BRO_PROXY__) return;
  window.__AGENTIC_BRO_PROXY__ = true;

  // Configuration
  const ALLOWED_ORIGINS = ['https://agenticbro.app', 'http://localhost:3000'];
  const PARENT_ORIGIN = window !== window.top ? window.location.ancestorOrigins?.[0] : null;

  // State
  let isConnected = false;
  let publicKey = null;

  // ─── Helper Functions ────────────────────────────────────────────────────────

  function serializeTransaction(tx) {
    try {
      // Solana transactions have a serialize method
      const serialized = tx.serialize ? tx.serialize() : tx;
      return Array.from(serialized);
    } catch (e) {
      console.error('[Agentic Bro] Failed to serialize transaction:', e);
      return null;
    }
  }

  function sendMessage(type, payload) {
    if (window.parent !== window) {
      window.parent.postMessage({ type, payload, source: 'agentic-bro-proxy' }, '*');
    }
  }

  function waitForResponse(type, timeout = 60000) {
    return new Promise((resolve, reject) => {
      const handler = (event) => {
        if (event.data?.type === `${type}_RESPONSE`) {
          window.removeEventListener('message', handler);
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.result);
          }
        }
      };

      window.addEventListener('message', handler);

      // Timeout
      setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Timeout waiting for response'));
      }, timeout);
    });
  }

  // ─── Mock Wallet Implementation ────────────────────────────────────────────────

  const mockWallet = {
    // Standard wallet properties
    isPhantom: true,
    isConnected: false,
    publicKey: null,

    // Connection
    async connect() {
      console.log('[Agentic Bro] Wallet connect requested');

      sendMessage('WALLET_CONNECT_REQUEST', {
        origin: window.location.origin,
      });

      const response = await waitForResponse('WALLET_CONNECT_REQUEST');

      if (response.approved) {
        isConnected = true;
        mockWallet.isConnected = true;
        publicKey = response.publicKey;
        mockWallet.publicKey = {
          toBase58: () => publicKey,
          toString: () => publicKey,
        };

        // Emit connect event
        window.dispatchEvent(new CustomEvent('connect', { detail: { publicKey: mockWallet.publicKey } }));

        return { publicKey: mockWallet.publicKey };
      } else {
        throw new Error('User rejected connection');
      }
    },

    // Disconnection
    async disconnect() {
      console.log('[Agentic Bro] Wallet disconnect requested');

      isConnected = false;
      mockWallet.isConnected = false;
      publicKey = null;
      mockWallet.publicKey = null;

      sendMessage('WALLET_DISCONNECT', {});

      window.dispatchEvent(new CustomEvent('disconnect'));
    },

    // Transaction Signing
    async signTransaction(tx) {
      console.log('[Agentic Bro] Transaction signing requested');

      const serialized = serializeTransaction(tx);
      if (!serialized) {
        throw new Error('Failed to serialize transaction');
      }

      sendMessage('WALLET_SIGN_REQUEST', {
        method: 'signTransaction',
        transaction: serialized,
      });

      const response = await waitForResponse('WALLET_SIGN_REQUEST');

      if (response.rejected) {
        throw new Error('User rejected transaction');
      }

      // Return the original transaction (in production, we'd sign it)
      return tx;
    },

    // Sign and Send
    async signAndSendTransaction(tx, options = {}) {
      console.log('[Agentic Bro] Sign and send requested');

      const serialized = serializeTransaction(tx);
      if (!serialized) {
        throw new Error('Failed to serialize transaction');
      }

      sendMessage('WALLET_SIGN_REQUEST', {
        method: 'signAndSendTransaction',
        transaction: serialized,
        options,
      });

      const response = await waitForResponse('WALLET_SIGN_REQUEST');

      if (response.rejected) {
        throw new Error('User rejected transaction');
      }

      return { signature: response.signature || 'MOCK_SIGNATURE_' + Date.now() };
    },

    // Sign Multiple Transactions
    async signAllTransactions(txs) {
      console.log('[Agentic Bro] Batch signing requested');

      const serialized = txs.map(tx => serializeTransaction(tx)).filter(Boolean);

      sendMessage('WALLET_SIGN_ALL_REQUEST', {
        transactions: serialized,
      });

      const response = await waitForResponse('WALLET_SIGN_ALL_REQUEST');

      if (response.rejected) {
        throw new Error('User rejected transactions');
      }

      return txs;
    },

    // Sign Message
    async signMessage(message) {
      console.log('[Agentic Bro] Message signing requested');

      const messageArray = Array.from(message);

      sendMessage('WALLET_SIGN_MESSAGE', {
        message: messageArray,
      });

      const response = await waitForResponse('WALLET_SIGN_MESSAGE');

      if (response.rejected) {
        throw new Error('User rejected message signing');
      }

      return new Uint8Array(response.signature || messageArray);
    },

    // Event listeners
    on(event, callback) {
      window.addEventListener(event, callback);
      return this;
    },

    off(event, callback) {
      window.removeEventListener(event, callback);
      return this;
    },

    emit(event, data) {
      window.dispatchEvent(new CustomEvent(event, { detail: data }));
      return this;
    },
  };

  // ─── Inject Wallet ────────────────────────────────────────────────────────────

  // Inject as window.solana (Phantom-style)
  Object.defineProperty(window, 'solana', {
    value: mockWallet,
    writable: false,
    configurable: false,
    enumerable: true,
  });

  // Also inject as window.phantom.solana for compatibility
  if (!window.phantom) {
    window.phantom = { solana: mockWallet };
  } else if (!window.phantom.solana) {
    window.phantom.solana = mockWallet;
  }

  // Inject for wallet-adapter compatibility
  window.solanaWeb3 = window.solanaWeb3 || {};
  window.solanaWeb3.wallets = window.solanaWeb3.wallets || [];

  console.log('[Agentic Bro] Wallet proxy injected successfully');

  // ─── Message Handler ──────────────────────────────────────────────────────────

  window.addEventListener('message', (event) => {
    // Only accept messages from parent
    if (event.source !== window.parent) return;

    const { type, payload } = event.data || {};

    switch (type) {
      case 'WALLET_STATE_UPDATE':
        if (payload.connected) {
          mockWallet.isConnected = true;
          mockWallet.publicKey = {
            toBase58: () => payload.address,
            toString: () => payload.address,
          };
        } else {
          mockWallet.isConnected = false;
          mockWallet.publicKey = null;
        }
        break;
    }
  });

  // ─── Ready Signal ──────────────────────────────────────────────────────────────

  // Signal to parent that we're ready
  sendMessage('DAPP_READY', { origin: window.location.origin });

})();