import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { ApiError, parse, requireUser } from '../http';

/** Built-in avatar ids (the app draws them; no images stored). */
export const AVATAR_PRESETS = ['smile', 'palm', 'sea', 'sun', 'music', 'food', 'hiking', 'camera', 'bike', 'cat', 'dog', 'star'] as const;
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Avatars: pick a preset, or upload a photo (the app crops it square). The server decodes it, re-encodes a
 * 512×512 JPEG and drops all metadata (EXIF can contain GPS position). With an Anthropic key, photos are also
 * checked for nudity, violence or hate symbols before they're shown next to reviews.
 */
export async function avatarRoutes(app: FastifyInstance, deps: AppDeps) {
  const { db, config } = deps;
  const vision = config.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, maxRetries: 0 }) : null;

  async function imageAllowed(jpeg: Buffer): Promise<boolean> {
    if (!vision) return true;
    try {
      const r = await vision.beta.messages.create({
        model: config.ANTHROPIC_MODEL, max_tokens: 50, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: { type: 'object', additionalProperties: false, required: ['allowed'], properties: { allowed: { type: 'boolean' } } } } },
        system: 'You check profile pictures for a public app. allowed=false only for nudity/sexual content, graphic violence, hate symbols, or another person\'s ID document. Everything else (faces, pets, landscapes, logos) is allowed.',
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } }, { type: 'text', text: 'Is this profile picture allowed?' }] }],
      }, { timeout: 8000, maxRetries: 0 });
      const b = r.content.find((x) => x.type === 'text');
      return b?.type === 'text' ? (JSON.parse(b.text) as { allowed: boolean }).allowed !== false : true;
    } catch (e) {
      app.log.warn({ err: (e as Error).message }, 'avatar check failed; allowing');
      return true;
    }
  }

  app.put('/v1/me/avatar', async (req) => {
    const user = requireUser(req);
    const b = parse(z.object({ preset: z.enum(AVATAR_PRESETS).nullable() }), req.body);
    await db.query('DELETE FROM user_avatars WHERE user_id = $1', [user.id]);
    await db.query('UPDATE users SET avatar_preset = $2, avatar_url = NULL, avatar_updated_at = now() WHERE id = $1', [user.id, b.preset]);
    return { avatarPreset: b.preset, avatarUrl: null };
  });

  app.post('/v1/me/avatar/photo', { bodyLimit: 9 * 1024 * 1024, config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req) => {
    const user = requireUser(req);
    const b = parse(z.object({ image: z.string().min(100).max(9_000_000) }), req.body);
    const buf = Buffer.from(b.image.replace(/^data:image\/[a-z+]+;base64,/, ''), 'base64');
    if (buf.length > MAX_BYTES) throw new ApiError(413, 'too_large', 'The photo is too large (max 6 MB).');
    let jpeg: Buffer;
    try {
      const meta = await sharp(buf).metadata();
      if (!['jpeg', 'png', 'webp', 'heif'].includes(meta.format ?? '')) throw new Error('format');
      if ((meta.width ?? 0) < 64 || (meta.height ?? 0) < 64) throw new ApiError(400, 'too_small', 'The photo is too small.');
      // rotate() applies EXIF orientation; output has no metadata.
      jpeg = await sharp(buf).rotate().resize(512, 512, { fit: 'cover', position: 'attention' }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(400, 'invalid_image', 'Use a JPEG, PNG or WebP photo.');
    }
    if (!(await imageAllowed(jpeg))) throw new ApiError(400, 'image_not_allowed', 'This photo cannot be used as an avatar.');
    const v = Date.now();
    await db.query(`INSERT INTO user_avatars (user_id, mime, data, updated_at) VALUES ($1, 'image/jpeg', $2, now())
      ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, mime = EXCLUDED.mime, updated_at = now()`, [user.id, jpeg]);
    const url = `/v1/avatars/${user.id}?v=${v}`;
    await db.query('UPDATE users SET avatar_url = $2, avatar_preset = NULL, avatar_updated_at = now() WHERE id = $1', [user.id, url]);
    return { avatarUrl: url, avatarPreset: null, bytes: jpeg.length };
  });

  app.delete('/v1/me/avatar/photo', async (req, reply) => {
    const user = requireUser(req);
    await db.query('DELETE FROM user_avatars WHERE user_id = $1', [user.id]);
    await db.query('UPDATE users SET avatar_url = NULL, avatar_updated_at = now() WHERE id = $1', [user.id]);
    return reply.status(204).send();
  });

  app.get('/v1/avatars/:userId', async (req, reply) => {
    const { userId } = parse(z.object({ userId: z.string().uuid() }), req.params);
    const r = await db.query<{ data: Buffer; mime: string; updated_at: Date }>('SELECT data, mime, updated_at FROM user_avatars WHERE user_id = $1', [userId]);
    const row = r.rows[0];
    if (!row) throw new ApiError(404, 'not_found', 'No avatar');
    const etag = `"${createHash('sha1').update(row.data).digest('hex').slice(0, 16)}"`;
    if (req.headers['if-none-match'] === etag) return reply.status(304).send();
    return reply.type(row.mime).header('cache-control', 'public, max-age=86400').header('etag', etag).send(row.data);
  });
}
