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

  // Email (Resend) and SMS (Twilio) for confirming contact details. Without them, confirmation is unavailable
  // and the API says so — nothing is ever marked as confirmed without a delivered code.
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default('passtra <no-reply@passtra.app>'),
  TWILIO_ACCOUNT_SID: optional,
  TWILIO_AUTH_TOKEN: optional,
  TWILIO_FROM: optional,
  /** DEV ONLY: return verification codes in API responses for local testing. Refused in production. */
  DEV_SHOW_CODES: bool.default(false),
  // Web Push (VAPID). If unset, a key pair is generated once and stored in app_settings.
  WEB_PUSH_PUBLIC_KEY: optional,
  WEB_PUSH_PRIVATE_KEY: optional,
  WEB_PUSH_SUBJECT: z.string().default('mailto:support@passtra.app'),
  // Routing (OSRM-compatible). Default: FOSSGIS public OSRM — fair use only; self-host or use a paid API at scale.
  ROUTING_URL: z.string().default('https://routing.openstreetmap.de'),
  /** Public base URL of the web app, used in share links and notifications (e.g. https://passtra.onrender.com). */
  PUBLIC_WEB_URL: optional,
  /** Universal/App Links: Apple Team ID and Android signing cert SHA-256 fingerprints (comma-separated). */
  APPLE_TEAM_ID: optional,
  ANDROID_CERT_SHA256: optional,
  REPORT_SALT: z.string().default('dev-only-salt-change-me'),
  DEMO_MODE: bool.default(false),
  FEATURE_PROMOTIONS: bool.default(false),
  ADMIN_STATIC_DIR: optional,
  APP_STATIC_DIR: optional, // web build of the app (served at /, SPA fallback)
  RUN_WORKER: bool.default(false), // run the background loop inside the API process (single-instance hosting)
  WORKER_POLL_MS: z.coerce.number().int().default(15000),
});

export type AppConfig = z.infer<typeof Schema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const cfg = Schema.parse(env);
  if (cfg.NODE_ENV === 'production') {
    if (cfg.DEMO_MODE) throw new Error('DEMO_MODE must never be enabled in production.');
    if (!cfg.AUTH_JWKS_URL && !cfg.AUTH_JWT_SECRET) throw new Error('Configure AUTH_JWKS_URL or AUTH_JWT_SECRET in production.');
    if (cfg.REPORT_SALT === 'dev-only-salt-change-me') throw new Error('Set REPORT_SALT in production.');
    if (cfg.DEV_SHOW_CODES) throw new Error('DEV_SHOW_CODES must never be enabled in production.');
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
    emailDelivery: !!cfg.RESEND_API_KEY,
    smsDelivery: !!(cfg.TWILIO_ACCOUNT_SID && cfg.TWILIO_AUTH_TOKEN && cfg.TWILIO_FROM),
    webPush: true,
  };
}
