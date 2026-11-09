import { crawlDelaySeconds, isAllowed, parseRobots, type Robots } from '@passtra/core';

export class HttpError extends Error {
  constructor(public status: number, public url: string, message?: string) {
    super(message ?? `HTTP ${status} for ${url}`);
  }
}

export class RobotsDisallowedError extends Error {
  constructor(public url: string) {
    super(`robots.txt disallows ${url}`);
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Check robots.txt first (required for website sources; not needed for documented APIs). */
  respectRobots?: boolean;
  method?: 'GET' | 'POST';
  body?: string;
  /** Conditional request validators from a previous response. */
  etag?: string | null;
  lastModified?: string | null;
}

export interface FetchResult<T> {
  status: number;
  notModified: boolean;
  data: T | null;
  etag: string | null;
  lastModified: string | null;
  expires: string | null;
}

/**
 * Polite HTTP client: identifying User-Agent, timeouts, robots.txt (RFC 9309) with caching,
 * per-host spacing (max(Crawl-delay, minIntervalMs)), conditional requests. Never bypasses
 * authentication, CAPTCHAs or WAF blocks — a 401/403/429 is reported, not retried around.
 */
export class HttpClient {
  private robots = new Map<string, { robots: Robots | null; fetchedAt: number }>();
  private lastHit = new Map<string, number>();

  constructor(
    private userAgent: string,
    private minIntervalMs = 1000,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async robotsFor(origin: string): Promise<Robots | null> {
    const cached = this.robots.get(origin);
    if (cached && Date.now() - cached.fetchedAt < 24 * 3_600_000) return cached.robots;
    let robots: Robots | null = null;
    try {
      const res = await this.fetchImpl(`${origin}/robots.txt`, { headers: { 'user-agent': this.userAgent }, signal: AbortSignal.timeout(10_000) });
      if (res.ok) robots = parseRobots(await res.text());
      else if (res.status === 401 || res.status === 403) robots = parseRobots('User-agent: *\nDisallow: /'); // treat as "do not crawl"
      // 404/5xx: no robots.txt → allowed (RFC 9309 §2.3.1.3 treats 5xx as disallow; we stay conservative below)
      else if (res.status >= 500) robots = parseRobots('User-agent: *\nDisallow: /');
    } catch {
      robots = parseRobots('User-agent: *\nDisallow: /'); // unreachable: do not crawl this time
    }
    this.robots.set(origin, { robots, fetchedAt: Date.now() });
    return robots;
  }

  private async spacing(url: URL, robots: Robots | null): Promise<void> {
    const delay = Math.max(this.minIntervalMs, (robots ? crawlDelaySeconds(robots, this.userAgent) ?? 0 : 0) * 1000);
    const last = this.lastHit.get(url.host) ?? 0;
    const wait = last + delay - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastHit.set(url.host, Date.now());
  }

  async request(url: string, opts: FetchOptions = {}): Promise<FetchResult<string>> {
    const u = new URL(url);
    let robots: Robots | null = null;
    if (opts.respectRobots) {
      robots = await this.robotsFor(u.origin);
      if (robots && !isAllowed(robots, this.userAgent, u.pathname + u.search)) throw new RobotsDisallowedError(url);
    }
    await this.spacing(u, robots);
    const headers: Record<string, string> = { 'user-agent': this.userAgent, accept: 'application/json, text/html;q=0.9, */*;q=0.5', ...opts.headers };
    if (opts.etag) headers['if-none-match'] = opts.etag;
    if (opts.lastModified) headers['if-modified-since'] = opts.lastModified;
    const res = await this.fetchImpl(url, { method: opts.method ?? 'GET', headers, body: opts.body, signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000) });
    const meta = { etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified'), expires: res.headers.get('expires') };
    if (res.status === 304) return { status: 304, notModified: true, data: null, ...meta };
    if (!res.ok) throw new HttpError(res.status, url, `HTTP ${res.status} for ${u.origin}${u.pathname}`);
    return { status: res.status, notModified: false, data: await res.text(), ...meta };
  }

  /** Binary download (e.g. an OpenStreetMap extract). Same politeness and conditional-request rules as request(). */
  async bytes(url: string, opts: FetchOptions = {}): Promise<FetchResult<Uint8Array>> {
    const u = new URL(url);
    await this.spacing(u, null);
    const headers: Record<string, string> = { 'user-agent': this.userAgent, accept: '*/*', ...opts.headers };
    if (opts.etag) headers['if-none-match'] = opts.etag;
    if (opts.lastModified) headers['if-modified-since'] = opts.lastModified;
    const res = await this.fetchImpl(url, { headers, signal: AbortSignal.timeout(opts.timeoutMs ?? 300_000) });
    const meta = { etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified'), expires: res.headers.get('expires') };
    if (res.status === 304) return { status: 304, notModified: true, data: null, ...meta };
    if (!res.ok) throw new HttpError(res.status, url, `HTTP ${res.status} for ${u.origin}${u.pathname}`);
    return { status: res.status, notModified: false, data: new Uint8Array(await res.arrayBuffer()), ...meta };
  }

  async json<T>(url: string, opts: FetchOptions = {}): Promise<FetchResult<T>> {
    const r = await this.request(url, opts);
    if (r.notModified || r.data === null) return { ...r, data: null };
    try {
      return { ...r, data: JSON.parse(r.data) as T };
    } catch {
      throw new Error(`Invalid JSON from ${new URL(url).origin}`);
    }
  }
}
