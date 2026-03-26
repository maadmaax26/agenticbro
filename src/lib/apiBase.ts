// ─── Shared API base URL ──────────────────────────────────────────────────────
// Empty string = relative URLs so that:
//   • Vite dev server  → proxy forwards /api/* → http://localhost:3001 (backend)
//   • Vercel production → /api/* is served by Vercel serverless functions
// Override by setting VITE_API_URL in .env.local (e.g. to a remote backend).
export const API_BASE =
  (import.meta as { env: Record<string, string> }).env.VITE_API_URL ??
  ''
