import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { SolanaMobileWalletAdapter, createDefaultAuthorizationResultCache, createDefaultAddressSelector, createDefaultWalletNotFoundHandler } from '@solana-mobile/wallet-adapter-mobile'
import '@solana/wallet-adapter-react-ui/styles.css'
import './index.css'
import App from './App.tsx'
import './utils/i18n'
import { AuthProvider } from './lib/AuthContext'

// Detect if we're on mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

// Standard desktop wallets
const desktopWallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
]

// Mobile wallet adapter (for mobile browsers)
let mobileWalletAdapter: any = null
if (isMobile) {
  try {
    mobileWalletAdapter = new SolanaMobileWalletAdapter({
      addressSelector: createDefaultAddressSelector(),
      authorizationResultCache: createDefaultAuthorizationResultCache(),
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
      appIdentity: {
        uri: 'https://agenticbro.app',
        name: 'Agentic Bro',
        icon: 'https://agenticbro.app/favicon.ico',
      },
      chain: 'solana:mainnet',
    })
    console.log('[Wallet] Mobile wallet adapter initialized')
  } catch (err) {
    console.warn('[Wallet] Failed to initialize mobile wallet adapter:', err)
  }
}

// Combine wallets based on platform
const wallets = mobileWalletAdapter ? [...desktopWallets, mobileWalletAdapter] : desktopWallets

console.log('[Wallet] Initialized wallets:', { isMobile, walletCount: wallets.length })

// Use Helius RPC if configured, otherwise fall back to publicnode (more reliable than Solana public RPC)
// Mobile-optimized: multiple fallbacks for reliability
const _heliusKey: string = (import.meta as any).env.VITE_HELIUS_API_KEY ?? ''
const _heliusUrl: string = (import.meta as any).env.VITE_HELIUS_RPC_URL ?? ''

const RPC_ENDPOINTS = [
  _heliusUrl || (_heliusKey ? `https://mainnet.helius-rpc.com/?api-key=${_heliusKey}` : null),
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
].filter(Boolean) as string[]

// Use first available endpoint
const RPC_URL: string = RPC_ENDPOINTS[0]

console.log('[RPC] Using endpoint:', RPC_URL)
console.log('[RPC] Fallbacks available:', RPC_ENDPOINTS.length - 1)

// Connection timeout to prevent hanging
const CONNECTION_CONFIG = {
  commitment: 'confirmed' as const,
  confirmTransactionInitialTimeout: 30000, // 30s timeout
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConnectionProvider endpoint={RPC_URL} config={CONNECTION_CONFIG}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </StrictMode>,
)