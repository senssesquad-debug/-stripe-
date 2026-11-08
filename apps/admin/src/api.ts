/** Thin client for /v1/admin. The admin JWT (Supabase session or a dev token) is kept in sessionStorage only. */
const KEY = 'passtra.admin.token';

export const auth = {
  get: () => sessionStorage.getItem(KEY),
  set: (t: string) => sessionStorage.setItem(KEY, t),
  clear: () => sessionStorage.removeItem(KEY),
};

export class AdminError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function call<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${auth.get() ?? ''}`, ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new AdminError(res.status, json?.error?.message ?? `HTTP ${res.status}`);
  return json as T;
}

export const fmtDate = (v: string | null | undefined) => (v ? new Date(v).toLocaleString('en-GB', { timeZone: 'Europe/Nicosia', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const ago = (v: string | null | undefined) => {
  if (!v) return '—';
  const s = (Date.now() - Date.parse(v)) / 1000;
  return s < 90 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`;
};
