import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WalletProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'
import './index.css'
import App from './App.tsx'
import './utils/i18n'

const wallets = [
  new PhantomWalletAdapter(),
]

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <App />
      </WalletModalProvider>
    </WalletProvider>
  </StrictMode>,
)