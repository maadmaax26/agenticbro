/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_AI_PROVIDER: 'ollama' | 'openai'
  readonly VITE_OLLAMA_API_URL: string
  readonly VITE_OLLAMA_MODEL: string
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_HELIUS_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}