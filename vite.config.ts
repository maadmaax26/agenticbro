import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['buffer'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'react-vendor': ['react', 'react-dom'],
          // Solana wallet libraries (large)
          'solana-wallet': [
            '@solana/wallet-adapter-react',
            '@solana/wallet-adapter-react-ui',
            '@solana/wallet-adapter-wallets',
            '@solana/wallet-adapter-base',
          ],
          // Solana web3
          'solana-web3': ['@solana/web3.js'],
          // Supabase
          'supabase': ['@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      // Proxy all /api/* requests to the Express server during development
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Keep /api prefix (Express mounts routes under /api/*)
        // SSE + realtime agent requests can take 2-3 min on cold model loads.
        // http-proxy defaults to ~30-60s which silently kills the connection.
        timeout: 300_000, // 5 min — TCP socket idle timeout
        proxyTimeout: 300_000, // 5 min — wait for upstream (Express) to respond
      },
    },
  },
})
