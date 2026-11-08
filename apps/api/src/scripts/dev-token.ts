/**
 * DEV ONLY: mint an HS256 JWT for local testing (same shape Supabase Auth issues).
 * `pnpm dev:token <user-uuid> [--admin]` — requires AUTH_JWT_SECRET.
 */
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { loadConfig } from '../config';

const config = loadConfig();
if (config.NODE_ENV === 'production') throw new Error('dev-token is not available in production');
if (!config.AUTH_JWT_SECRET) throw new Error('Set AUTH_JWT_SECRET');
const sub = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : randomUUID();
const token = await new SignJWT({ role: 'authenticated' })
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(sub)
  .setAudience(config.AUTH_AUDIENCE)
  .setIssuedAt()
  .setExpirationTime('12h')
  .sign(new TextEncoder().encode(config.AUTH_JWT_SECRET));
console.log(JSON.stringify({ sub, token, hint: process.argv.includes('--admin') ? `add ${sub} to ADMIN_USER_IDS` : undefined }, null, 2));
