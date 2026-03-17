import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'
import './index.css'
import App from './App.tsx'
import './utils/i18n'

const wallets = [
  new PhantomWalletAdapter(),
]

// Use Helius RPC if configured, otherwise fall back to publicnode (more reliable than Solana public RPC)
const _heliusKey: string = (import.meta as any).env.VITE_HELIUS_API_KEY ?? ''
const _heliusUrl: string = (import.meta as any).env.VITE_HELIUS_RPC_URL ?? ''
const RPC_URL: string =
  _heliusUrl ||
  (_heliusKey ? `https://mainnet.helius-rpc.com/?api-key=${_heliusKey}` : '') ||
  'https://solana-rpc.publicnode.com'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </StrictMode>,
)