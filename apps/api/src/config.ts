import { z } from 'zod';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));
const list = z.string().default('').transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean));
const optional = z.string().trim().optional().transform((v) => (v ? v : undefined));

const Schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().default('postgres://postgres@localhost:5432/passtra'),
  DATABASE_POOL_MAX: z.coerce.number().int().default(10),
  CORS_ORIGINS: list,
  TRUST_PROXY: bool.default(false),

  // Auth: verify JWTs from Supabase Auth (or any OIDC provider).
  AUTH_JWKS_URL: optional,
  AUTH_JWT_SECRET: optional, // HS256 (Supabase legacy JWT secret); also used in dev/tests
  AUTH_ISSUER: optional,
  AUTH_AUDIENCE: z.string().default('authenticated'),
  ADMIN_USER_IDS: list, // bootstrap admins (auth subject ids)

  // External services (all optional — features degrade gracefully and say so)
  GOOGLE_MAPS_API_KEY: optional,
  ANTHROPIC_API_KEY: optional,
  ANTHROPIC_MODEL: z.string().default('claude-opus-5-5'),
  AI_SEARCH_TIMEOUT_MS: z.coerce.number().int().default(2500),
  TICKETMASTER_API_KEY: optional,
  EVENTBRITE_TOKEN: optional,
  EXPO_ACCESS_TOKEN: optional,
  OVERPASS_URL: z.string().default('https://overpass-api.de/api/interpreter'),
  NOMINATIM_URL: z.string().default('https://nominatim.openstreetmap.org'),
  GEOCODING_ENABLED: bool.default(true),
  BOT_USER_AGENT: z.string().default('passtra-bot/0.1 (+https://passtra.app/bot; data@passtra.app)'),

  REPORT_SALT: z.string().default('dev-only-salt-change-me'),
  DEMO_MODE: bool.default(false),
  FEATURE_PROMOTIONS: bool.default(false),
  ADMIN_STATIC_DIR: optional,
  WORKER_POLL_MS: z.coerce.number().int().default(15000),
});

export type AppConfig = z.infer<typeof Schema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const cfg = Schema.parse(env);
  if (cfg.NODE_ENV === 'production') {
    if (cfg.DEMO_MODE) throw new Error('DEMO_MODE must never be enabled in production.');
    if (!cfg.AUTH_JWKS_URL && !cfg.AUTH_JWT_SECRET) throw new Error('Configure AUTH_JWKS_URL or AUTH_JWT_SECRET in production.');
    if (cfg.REPORT_SALT === 'dev-only-salt-change-me') throw new Error('Set REPORT_SALT in production.');
  }
  return cfg;
}

/** Which optional integrations are configured — exposed (without values) for the admin panel. */
export function integrationStatus(cfg: AppConfig): Record<string, boolean> {
  return {
    googlePlaces: !!cfg.GOOGLE_MAPS_API_KEY,
    aiSearch: !!cfg.ANTHROPIC_API_KEY,
    ticketmaster: !!cfg.TICKETMASTER_API_KEY,
    eventbrite: !!cfg.EVENTBRITE_TOKEN,
    pushNotifications: true, // Expo push works without a token; the token only raises security
    auth: !!(cfg.AUTH_JWKS_URL || cfg.AUTH_JWT_SECRET),
    geocoding: cfg.GEOCODING_ENABLED,
  };
}
