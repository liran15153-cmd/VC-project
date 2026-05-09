// Centralized API client. Base URL is configurable via:
//   1. localStorage key "gvc.apiBase"
//   2. VITE_API_BASE env var
//   3. default "/api" (Vite dev proxy forwards to backend)

const DEFAULT_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api';
const API_BASE_KEY = 'gvc.apiBase';
const TOKEN_KEY = 'gvc.authToken';

export function getApiBase(): string {
  try {
    const stored = localStorage.getItem(API_BASE_KEY);
    if (stored && stored.trim()) return stored.replace(/\/$/, '');
  } catch {}
  return DEFAULT_BASE.replace(/\/$/, '');
}

export function setApiBase(value: string): void {
  const trimmed = value.trim().replace(/\/$/, '');
  if (trimmed) localStorage.setItem(API_BASE_KEY, trimmed);
  else localStorage.removeItem(API_BASE_KEY);
}

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  raw?: unknown;
  constructor(message: string, status: number, opts?: { code?: string; details?: unknown; raw?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = opts?.code;
    this.details = opts?.details;
    this.raw = opts?.raw;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Backend unreachable. Start backend on localhost:3000.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  auth?: boolean; // default: true
  raw?: boolean;  // if true, return Response (used for downloads)
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = getApiBase();
  const fullPath = path.startsWith('/') ? path : `/${path}`;
  let url = `${base}${fullPath}`;
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }
  return url;
}

function humanizeError(status: number, payload: any): string {
  const code = payload?.code || payload?.error?.code;
  const rawMsg: string = payload?.error?.message || payload?.message || payload?.error || '';
  const lower = String(rawMsg).toLowerCase();

  if (status === 401) return 'You are signed out. Please log in again.';
  if (status === 403) return rawMsg || 'You do not have permission for this action.';
  if (status === 402) return 'Not enough tokens to complete this action.';
  if (status === 429) return 'Too many requests. Please slow down and try again.';
  if (status === 503) return rawMsg || 'Service temporarily unavailable.';
  if (lower.includes('openrouter_api_key')) {
    return 'OpenRouter key is not configured in backend .env (OPENROUTER_API_KEY).';
  }
  if (lower.includes('not configured') || lower.includes('api key')) {
    return 'OpenRouter key is not configured in backend .env (OPENROUTER_API_KEY).';
  }
  if (lower.includes('quota') || lower.includes('rate limit')) {
    return 'AI provider quota exceeded or rate limited. Check billing/quota and try again.';
  }
  if (lower.includes('timeout')) {
    return 'OpenRouter took too long to respond. Try again, or use a faster model for this test.';
  }
  if (status >= 500) return rawMsg || 'Server error. Try again in a moment.';
  return rawMsg || `Request failed (${status})${code ? ` [${code}]` : ''}`;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, auth = true, raw = false } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new NetworkError();
  }

  if (raw) {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError(humanizeError(res.status, { message: text }), res.status, { raw: text });
    }
    return res as unknown as T;
  }

  let payload: any = null;
  const text = await res.text();
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  }

  if (!res.ok) {
    throw new ApiError(humanizeError(res.status, payload), res.status, {
      code: payload?.code || payload?.error?.code,
      details: payload?.details || payload?.error?.details,
      raw: payload,
    });
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'DELETE' }),
};

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
}
