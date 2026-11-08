import { resolveLocale, type Locale } from '@passtra/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { z } from 'zod';
import type { AppConfig } from './config';
import type { Db } from './db';

export class ApiError extends Error {
  constructor(public statusCode: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new ApiError(400, 'invalid_request', 'Invalid request', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  return r.data;
}

export function localeOf(req: FastifyRequest, explicit?: string): Locale {
  return resolveLocale(explicit ?? (req.headers['accept-language'] as string | undefined)?.split(',')[0]);
}

// ── Auth ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  role: 'user' | 'organizer' | 'moderator' | 'admin';
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createAuth(config: AppConfig, db: Db) {
  const jwks = config.AUTH_JWKS_URL ? createRemoteJWKSet(new URL(config.AUTH_JWKS_URL)) : null;
  const secret = config.AUTH_JWT_SECRET ? new TextEncoder().encode(config.AUTH_JWT_SECRET) : null;
  const admins = new Set(config.ADMIN_USER_IDS);

  async function verify(token: string): Promise<JWTPayload> {
    const opts = { audience: config.AUTH_AUDIENCE, issuer: config.AUTH_ISSUER };
    if (jwks) return (await jwtVerify(token, jwks, opts)).payload;
    if (secret) return (await jwtVerify(token, secret, { ...opts, algorithms: ['HS256'] })).payload;
    throw new ApiError(503, 'auth_not_configured', 'Authentication is not configured on this server');
  }

  /** onRequest hook: attaches req.user when a valid bearer token is present; invalid tokens → 401. */
  async function authenticate(req: FastifyRequest): Promise<void> {
    req.user = null;
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return;
    let payload: JWTPayload;
    try {
      payload = await verify(h.slice(7));
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(401, 'invalid_token', 'Invalid or expired token');
    }
    if (!payload.sub || !UUID.test(payload.sub)) throw new ApiError(401, 'invalid_token', 'Token subject is not a user id');
    // Lazily create the user row (no personal data stored beyond the auth subject id).
    const r = await db.query<{ role: AuthUser['role'] }>(
      `INSERT INTO users (id, role) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET last_seen_at = now(), role = CASE WHEN $2 = 'admin' THEN 'admin' ELSE users.role END
       RETURNING role`,
      [payload.sub, admins.has(payload.sub) ? 'admin' : 'user'],
    );
    req.user = { id: payload.sub, role: r.rows[0]!.role };
  }

  return { authenticate };
}

export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.user) throw new ApiError(401, 'auth_required', 'Sign in required');
  return req.user;
}

export function requireRole(req: FastifyRequest, ...roles: AuthUser['role'][]): AuthUser {
  const u = requireUser(req);
  if (!roles.includes(u.role)) throw new ApiError(403, 'forbidden', 'Insufficient permissions');
  return u;
}

export function sendError(reply: FastifyReply, e: ApiError) {
  return reply.status(e.statusCode).send({ error: { code: e.code, message: e.message, details: e.details } });
}

// Shared query schemas
export const LocationQuery = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  city: z.string().max(40).optional(),
  radius: z.coerce.number().min(0.5).max(100).optional(),
  locale: z.string().max(10).optional(),
});

export const csv = <T extends string>(values: readonly T[]) =>
  z.string().max(400).optional().transform((s) => (s ? (s.split(',').map((x) => x.trim()).filter((x) => (values as readonly string[]).includes(x)) as T[]) : undefined));
