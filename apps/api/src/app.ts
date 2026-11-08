import { existsSync } from 'node:fs';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config';
import type { Db } from './db';
import type { EngineDeps } from './engine/pipeline';
import { Geocoder } from './lib/geocode';
import { HttpClient } from './lib/http';
import { ApiError, createAuth, sendError } from './http';
import { adminRoutes } from './routes/admin';
import { meRoutes } from './routes/me';
import { publicRoutes } from './routes/public';
import { QueryInterpreter } from './services/ai';

export interface AppDeps {
  config: AppConfig;
  db: Db;
  http: HttpClient;
  interpreter: QueryInterpreter;
  engine: EngineDeps;
  now?: () => Date;
}

export async function buildApp(config: AppConfig, db: Db, overrides: Partial<AppDeps> = {}): Promise<{ app: FastifyInstance; deps: AppDeps }> {
  const app = Fastify({
    logger: config.LOG_LEVEL === 'silent' ? false : { level: config.LOG_LEVEL, redact: ['req.headers.authorization'] },
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 256 * 1024,
    genReqId: () => crypto.randomUUID(),
  });
  const http = overrides.http ?? new HttpClient(config.BOT_USER_AGENT, 1100);
  const geocoder = new Geocoder(db, http, config.NOMINATIM_URL, config.GEOCODING_ENABLED);
  const deps: AppDeps = {
    config,
    db,
    http,
    interpreter: overrides.interpreter ?? new QueryInterpreter(config, db, app.log),
    engine: overrides.engine ?? { pool: db, config, http, geocoder, log: app.log },
    now: overrides.now,
  };

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : config.NODE_ENV !== 'production',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  await app.register(rateLimit, {
    global: true,
    max: 180,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.user?.id ?? req.ip,
    errorResponseBuilder: (_req, ctx) => ({ statusCode: 429, error: { code: 'rate_limited', message: `Too many requests, retry in ${Math.ceil(ctx.ttl / 1000)}s` } }),
  });

  const auth = createAuth(config, db);
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req) => {
    await auth.authenticate(req);
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) return sendError(reply, err);
    const e = err as { statusCode?: number; validation?: unknown; code?: string; message: string };
    if (e.statusCode === 429) return reply.status(429).send(err);
    if (e.validation || e.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE' || e.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') return sendError(reply, new ApiError(400, 'invalid_request', e.message));
    if (e.statusCode && e.statusCode < 500) return sendError(reply, new ApiError(e.statusCode, 'request_error', e.message));
    req.log.error({ err }, 'unhandled error');
    return sendError(reply, new ApiError(500, 'internal', 'Something went wrong'));
  });
  app.setNotFoundHandler((_req, reply) => sendError(reply, new ApiError(404, 'not_found', 'Route not found')));

  await app.register(async (r) => publicRoutes(r, deps));
  await app.register(async (r) => meRoutes(r, deps));
  await app.register(async (r) => adminRoutes(r, deps));

  if (config.ADMIN_STATIC_DIR && existsSync(config.ADMIN_STATIC_DIR)) {
    await app.register(fastifyStatic, { root: config.ADMIN_STATIC_DIR, prefix: '/admin/', decorateReply: false });
  }
  return { app, deps };
}
