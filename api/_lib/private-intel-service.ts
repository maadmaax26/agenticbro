import type { IncomingMessage, ServerResponse } from 'http';

type JsonResponse = ServerResponse & {
  status?: (code: number) => JsonResponse;
  json?: (data: unknown) => void;
  setHeader: (name: string, value: string) => JsonResponse;
  end: (chunk?: unknown) => void;
};

const PRIVATE_INTEL_SERVICE_URL = process.env.PRIVATE_INTEL_SERVICE_URL || '';
const PRIVATE_INTEL_SERVICE_TOKEN = process.env.PRIVATE_INTEL_SERVICE_TOKEN || '';

export function privateIntelConfigured(): boolean {
  return Boolean(PRIVATE_INTEL_SERVICE_URL && PRIVATE_INTEL_SERVICE_TOKEN);
}

export async function parseJsonBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

export function sendJson(res: JsonResponse, statusCode: number, data: unknown): void {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(data);
    return;
  }
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export async function callPrivateIntel<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    authorization?: string | string[];
    query?: string;
  } = {}
): Promise<T> {
  if (!privateIntelConfigured()) {
    throw new Error('PRIVATE_INTEL_SERVICE_URL and PRIVATE_INTEL_SERVICE_TOKEN are required');
  }

  const base = PRIVATE_INTEL_SERVICE_URL.replace(/\/+$/, '');
  const url = `${base}${path}${options.query || ''}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${PRIVATE_INTEL_SERVICE_TOKEN}`,
  };
  if (typeof options.authorization === 'string') {
    headers['X-AgenticBro-User-Authorization'] = options.authorization;
  }

  const response = await fetch(url, {
    method: options.method || 'POST',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { raw: text }; }

  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data
      ? String((data as { error?: unknown }).error)
      : `Private intelligence service returned ${response.status}`;
    const err = new Error(message) as Error & { statusCode?: number; data?: unknown };
    err.statusCode = response.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

export function privateIntelUnavailable(res: JsonResponse): void {
  sendJson(res, 503, {
    error: 'Private intelligence service is not configured',
    code: 'PRIVATE_INTEL_SERVICE_REQUIRED',
  });
}
