import { createHash, randomInt, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { SignJWT } from 'jose';
import { z } from 'zod';
import type { AppDeps } from '../app';
import type { AppConfig } from '../config';
import type { Db } from '../db';
import { ApiError, checkedName, parse, requireUser } from '../http';
import { DeliveryUnavailableError, sendEmail, sendSms } from '../lib/messaging';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const SESSION_DAYS = 60;
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_TARGET_DAY = 5;
const RESEND_AFTER_S = 60;

export async function hashPassword(pw: string): Promise<string> {
  const salt = Buffer.from(randomUUID().replace(/-/g, ''), 'hex');
  const key = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  if (!stored?.startsWith('scrypt$')) {
    await scrypt(pw, Buffer.alloc(16), 32); // same work for unknown users (timing)
    return false;
  }
  const [, salt, key] = stored.split('$');
  const derived = await scrypt(pw, Buffer.from(salt!, 'base64'), 32);
  const expected = Buffer.from(key!, 'base64');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

const codeHash = (config: AppConfig, purpose: string, target: string, code: string) =>
  createHash('sha256').update(`${config.AUTH_JWT_SECRET ?? config.REPORT_SALT}|${purpose}|${target.toLowerCase()}|${code}`).digest('hex');

export async function issueSession(db: Db, config: AppConfig, userId: string, req: FastifyRequest): Promise<string> {
  if (!config.AUTH_JWT_SECRET) throw new ApiError(503, 'auth_not_configured', 'Accounts are not configured on this server (AUTH_JWT_SECRET).');
  const s = await db.query<{ id: string; expires_at: Date }>(
    `INSERT INTO auth_sessions (user_id, user_agent, expires_at) VALUES ($1, $2, now() + make_interval(days => $3)) RETURNING id, expires_at`,
    [userId, String(req.headers['user-agent'] ?? '').slice(0, 300), SESSION_DAYS],
  );
  const builder = new SignJWT({ role: 'authenticated', sid: s.rows[0]!.id }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setAudience(config.AUTH_AUDIENCE).setIssuedAt().setExpirationTime(s.rows[0]!.expires_at);
  if (config.AUTH_ISSUER) builder.setIssuer(config.AUTH_ISSUER);
  return builder.sign(new TextEncoder().encode(config.AUTH_JWT_SECRET));
}

const Email = z.string().trim().toLowerCase().email().max(200);
const Password = z.string().min(8, 'At least 8 characters').max(200);
const Phone = z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Use international format, e.g. +35799123456');

async function sendCode(deps: AppDeps, userId: string, purpose: 'verify_email' | 'verify_phone' | 'reset_password', target: string): Promise<{ sent: true; devCode?: string }> {
  const { db, config } = deps;
  // One address/number can't be flooded with codes, whichever account asks (SMS/e-mail bombing).
  const perTarget = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM verification_codes WHERE lower(target) = lower($1) AND created_at > now() - interval '24 hours'`, [target]);
  if ((perTarget.rows[0]?.n ?? 0) >= MAX_CODES_PER_TARGET_DAY) throw new ApiError(429, 'too_many_codes', 'Too many codes were sent to this address today. Try again tomorrow.');
  const last = await db.query<{ created_at: Date }>(
    `SELECT created_at FROM verification_codes WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`, [userId, purpose]);
  if (last.rows[0] && Date.now() - last.rows[0].created_at.getTime() < RESEND_AFTER_S * 1000) {
    throw new ApiError(429, 'code_recently_sent', `Wait ${RESEND_AFTER_S} seconds before requesting a new code.`);
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const text = purpose === 'reset_password'
    ? `Your passtra password reset code is ${code}. It expires in ${CODE_TTL_MIN} minutes.`
    : `Your passtra confirmation code is ${code}. It expires in ${CODE_TTL_MIN} minutes.`;
  const devMode = config.DEV_SHOW_CODES && config.NODE_ENV !== 'production';
  try {
    if (purpose === 'verify_phone') await sendSms(config, target, text);
    else await sendEmail(config, target, purpose === 'reset_password' ? 'passtra password reset' : 'Confirm your email for passtra', text);
  } catch (e) {
    if (!(e instanceof DeliveryUnavailableError) || !devMode) {
      if (e instanceof DeliveryUnavailableError) {
        throw new ApiError(503, e.channel === 'email' ? 'email_delivery_unavailable' : 'sms_delivery_unavailable',
          e.channel === 'email' ? 'Email confirmation is temporarily unavailable: no email service is connected.' : 'Phone confirmation is temporarily unavailable: no SMS service is connected.');
      }
      throw new ApiError(502, 'delivery_failed', 'Could not send the code. Try again later.');
    }
  }
  await db.query(`UPDATE verification_codes SET consumed_at = now() WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`, [userId, purpose]);
  await db.query(
    `INSERT INTO verification_codes (user_id, purpose, target, code_hash, expires_at) VALUES ($1,$2,$3,$4, now() + make_interval(mins => $5))`,
    [userId, purpose, target, codeHash(config, purpose, target, code), CODE_TTL_MIN],
  );
  return devMode ? { sent: true, devCode: code } : { sent: true };
}

async function checkCode(deps: AppDeps, userId: string, purpose: string, code: string): Promise<string> {
  const { db, config } = deps;
  const row = (await db.query<{ id: string; target: string; code_hash: string; attempts: number; expires_at: Date }>(
    `SELECT id, target, code_hash, attempts, expires_at FROM verification_codes
      WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`, [userId, purpose])).rows[0];
  if (!row || row.expires_at < new Date()) throw new ApiError(400, 'code_expired', 'The code has expired. Request a new one.');
  if (row.attempts >= MAX_ATTEMPTS) throw new ApiError(429, 'too_many_attempts', 'Too many attempts. Request a new code.');
  if (codeHash(config, purpose, row.target, code) !== row.code_hash) {
    await db.query('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    throw new ApiError(400, 'invalid_code', 'Wrong code.');
  }
  await db.query('UPDATE verification_codes SET consumed_at = now() WHERE id = $1', [row.id]);
  return row.target;
}

export async function profileOf(db: Db, userId: string) {
  const r = await db.query(
    `SELECT u.id, u.role, u.name, u.email, u.email_verified_at, u.phone, u.phone_verified_at, u.password_hash IS NOT NULL AS has_password,
            u.locale, u.interests, u.age_range, u.budget, c.slug AS home_city, u.avatar_url, u.avatar_preset, u.personalization_enabled, u.notification_prefs, u.is_premium, u.created_at,
            (SELECT target FROM verification_codes v WHERE v.user_id = u.id AND v.purpose = 'verify_email' AND v.consumed_at IS NULL AND v.expires_at > now() ORDER BY created_at DESC LIMIT 1) AS pending_email,
            (SELECT target FROM verification_codes v WHERE v.user_id = u.id AND v.purpose = 'verify_phone' AND v.consumed_at IS NULL AND v.expires_at > now() ORDER BY created_at DESC LIMIT 1) AS pending_phone
       FROM users u LEFT JOIN cities c ON c.id = u.home_city_id WHERE u.id = $1`,
    [userId],
  );
  const u = r.rows[0];
  if (!u) throw new ApiError(404, 'not_found', 'Account not found');
  return {
    id: u.id, role: u.role, name: u.name, email: u.email, emailVerified: !!u.email_verified_at, pendingEmail: u.pending_email,
    phone: u.phone, phoneVerified: !!u.phone_verified_at, pendingPhone: u.pending_phone, hasPassword: u.has_password,
    locale: u.locale, interests: u.interests, ageRange: u.age_range, budget: u.budget, homeCity: u.home_city,
    personalizationEnabled: u.personalization_enabled, notificationPrefs: u.notification_prefs, isPremium: u.is_premium, createdAt: u.created_at,
    avatarUrl: u.avatar_url, avatarPreset: u.avatar_preset,
  };
}

export async function authRoutes(app: FastifyInstance, deps: AppDeps) {
  const { db, config } = deps;
  // Brute-force protection on credential endpoints (relaxed only for the automated test suite).
  const strict = { config: { rateLimit: { max: config.NODE_ENV === 'test' ? 1000 : 10, timeWindow: '15 minutes' } } };

  app.post('/v1/auth/register', strict, async (req) => {
    const b = parse(z.object({ email: Email, password: Password, name: z.string().max(200).optional(), locale: z.enum(['en', 'el', 'ru']).optional() }), req.body);
    const exists = await db.query('SELECT 1 FROM users WHERE lower(email) = $1', [b.email]);
    if (exists.rowCount) throw new ApiError(409, 'email_taken', 'An account with this email already exists. Sign in instead.');
    const id = randomUUID();
    const name = checkedName(b.name);
    await db.query(`INSERT INTO users (id, email, password_hash, name, locale) VALUES ($1,$2,$3,$4,$5)`, [id, b.email, await hashPassword(b.password), name, b.locale ?? 'en']);
    const token = await issueSession(db, config, id, req);
    // Send the confirmation code right away; the account works even if email delivery is not configured yet.
    let emailVerification: { sent: boolean; devCode?: string; reason?: string };
    try {
      emailVerification = await sendCode(deps, id, 'verify_email', b.email);
    } catch (e) {
      emailVerification = { sent: false, reason: (e as ApiError).code ?? 'delivery_failed' };
    }
    return { token, user: await profileOf(db, id), emailVerification };
  });

  app.post('/v1/auth/login', strict, async (req) => {
    const b = parse(z.object({ email: Email, password: z.string().max(200) }), req.body);
    const u = (await db.query<{ id: string; password_hash: string | null }>('SELECT id, password_hash FROM users WHERE lower(email) = $1', [b.email])).rows[0];
    const ok = await verifyPassword(b.password, u?.password_hash ?? null);
    if (!u || !ok) throw new ApiError(401, 'invalid_credentials', 'Wrong email or password.');
    return { token: await issueSession(db, config, u.id, req), user: await profileOf(db, u.id) };
  });

  app.post('/v1/auth/logout', async (req, reply) => {
    if (req.sessionId) await db.query('UPDATE auth_sessions SET revoked_at = now() WHERE id = $1', [req.sessionId]);
    return reply.status(204).send();
  });

  app.post('/v1/auth/password-reset/start', strict, async (req) => {
    const b = parse(z.object({ email: Email }), req.body);
    const u = (await db.query<{ id: string }>('SELECT id FROM users WHERE lower(email) = $1 AND email_verified_at IS NOT NULL', [b.email])).rows[0];
    // Same response whether or not the account exists (no account enumeration), except when delivery is unavailable.
    if (!config.RESEND_API_KEY && !(config.DEV_SHOW_CODES && config.NODE_ENV !== 'production')) {
      throw new ApiError(503, 'email_delivery_unavailable', 'Password reset is temporarily unavailable: no email service is connected.');
    }
    if (u) {
      const r = await sendCode(deps, u.id, 'reset_password', b.email).catch(() => ({ sent: true as const }));
      return { sent: true, ...('devCode' in r ? { devCode: r.devCode } : {}) };
    }
    return { sent: true };
  });

  app.post('/v1/auth/password-reset/confirm', strict, async (req) => {
    const b = parse(z.object({ email: Email, code: z.string().regex(/^\d{6}$/), password: Password }), req.body);
    const u = (await db.query<{ id: string }>('SELECT id FROM users WHERE lower(email) = $1', [b.email])).rows[0];
    if (!u) throw new ApiError(400, 'invalid_code', 'Wrong code.');
    await checkCode(deps, u.id, 'reset_password', b.code);
    await db.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [u.id, await hashPassword(b.password)]);
    await db.query('UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [u.id]);
    return { token: await issueSession(db, config, u.id, req), user: await profileOf(db, u.id) };
  });

  // ── Contact details: changes take effect only after the code is confirmed ──
  app.post('/v1/me/contact/start', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req) => {
    const user = requireUser(req);
    const b = parse(z.discriminatedUnion('channel', [z.object({ channel: z.literal('email'), email: Email }), z.object({ channel: z.literal('phone'), phone: Phone })]), req.body);
    if (b.channel === 'email') {
      const taken = await db.query('SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2', [b.email, user.id]);
      if (taken.rowCount) throw new ApiError(409, 'email_taken', 'This email is used by another account.');
      return sendCode(deps, user.id, 'verify_email', b.email);
    }
    const taken = await db.query('SELECT 1 FROM users WHERE phone = $1 AND id <> $2', [b.phone, user.id]);
    if (taken.rowCount) throw new ApiError(409, 'phone_taken', 'This phone number is used by another account.');
    return sendCode(deps, user.id, 'verify_phone', b.phone);
  });

  app.post('/v1/me/contact/confirm', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req) => {
    const user = requireUser(req);
    const b = parse(z.object({ channel: z.enum(['email', 'phone']), code: z.string().regex(/^\d{6}$/) }), req.body);
    const target = await checkCode(deps, user.id, b.channel === 'email' ? 'verify_email' : 'verify_phone', b.code);
    if (b.channel === 'email') await db.query('UPDATE users SET email = $2, email_verified_at = now(), updated_at = now() WHERE id = $1', [user.id, target]);
    else await db.query('UPDATE users SET phone = $2, phone_verified_at = now(), updated_at = now() WHERE id = $1', [user.id, target]);
    return profileOf(db, user.id);
  });

  app.delete('/v1/me/contact/phone', async (req) => {
    const user = requireUser(req);
    await db.query('UPDATE users SET phone = NULL, phone_verified_at = NULL, updated_at = now() WHERE id = $1', [user.id]);
    return profileOf(db, user.id);
  });

  app.post('/v1/me/password', strict, async (req) => {
    const user = requireUser(req);
    const b = parse(z.object({ current: z.string().max(200), password: Password }), req.body);
    const u = (await db.query<{ password_hash: string | null }>('SELECT password_hash FROM users WHERE id = $1', [user.id])).rows[0];
    if (u?.password_hash && !(await verifyPassword(b.current, u.password_hash))) throw new ApiError(400, 'wrong_password', 'Current password is wrong.');
    await db.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [user.id, await hashPassword(b.password)]);
    await db.query('UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL', [user.id, req.sessionId ?? '00000000-0000-0000-0000-000000000000']);
    return { ok: true };
  });
}
