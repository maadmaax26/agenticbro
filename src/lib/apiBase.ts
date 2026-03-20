// ─── Shared API base URL ──────────────────────────────────────────────────────
// Points directly at the local backend server so calls work from both the
// Vite dev server (localhost:5173) and the deployed Vercel site.
// Override by setting VITE_API_URL in your .env.local before building.
export const API_BASE =
  (import.meta as { env: Record<string, string> }).env.VITE_API_URL ??
  'http://localhost:3001'
