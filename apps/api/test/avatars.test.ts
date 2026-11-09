import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { freshDb } from './helpers';

let pool: pg.Pool;
let app: FastifyInstance;
let token: string;
let userId: string;
beforeAll(async () => {
  const db = await freshDb('avatars');
  pool = db.pool;
  app = (await buildApp(db.config, pool)).app;
  const r = (await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: 'pic@example.com', password: 'correct horse 42', name: 'Pic Owner' } })).json();
  token = r.token;
  userId = r.user.id;
});
afterAll(async () => { await app.close(); await pool.end(); });
const auth = () => ({ authorization: `Bearer ${token}` });

describe('avatars', () => {
  it('a preset is stored and returned in the profile', async () => {
    expect((await app.inject({ method: 'PUT', url: '/v1/me/avatar', payload: { preset: 'palm' }, headers: auth() })).json()).toEqual({ avatarPreset: 'palm', avatarUrl: null });
    expect((await app.inject({ url: '/v1/me', headers: auth() })).json()).toMatchObject({ avatarPreset: 'palm', avatarUrl: null });
    expect((await app.inject({ method: 'PUT', url: '/v1/me/avatar', payload: { preset: 'unicorn' }, headers: auth() })).statusCode).toBe(400);
  });
  it('an uploaded photo becomes a 512×512 JPEG without metadata (no GPS from EXIF)', async () => {
    const original = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#1769E8' } })
      .jpeg().withExif({ IFD0: { Make: 'TestCam', Artist: 'Someone' } }).toBuffer();
    expect((await sharp(original).metadata()).exif).toBeTruthy();
    const r = (await app.inject({ method: 'POST', url: '/v1/me/avatar/photo', payload: { image: `data:image/jpeg;base64,${original.toString('base64')}` }, headers: auth() })).json();
    expect(r.avatarUrl).toMatch(new RegExp(`^/v1/avatars/${userId}\\?v=\\d+$`));
    const img = await app.inject({ url: r.avatarUrl });
    expect(img.headers['content-type']).toBe('image/jpeg');
    const meta = await sharp(img.rawPayload).metadata();
    expect([meta.width, meta.height]).toEqual([512, 512]);
    expect(meta.exif).toBeUndefined();
    expect((await app.inject({ url: '/v1/me', headers: auth() })).json()).toMatchObject({ avatarUrl: r.avatarUrl, avatarPreset: null });
  });
  it('rejects non-images and tiny images; requires sign-in', async () => {
    expect((await app.inject({ method: 'POST', url: '/v1/me/avatar/photo', payload: { image: Buffer.from('not an image at all, just some text that is long enough '.repeat(5)).toString('base64') }, headers: auth() })).json().error.code).toBe('invalid_image');
    const tiny = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).png().toBuffer();
    expect((await app.inject({ method: 'POST', url: '/v1/me/avatar/photo', payload: { image: tiny.toString('base64').padEnd(120, 'A') }, headers: auth() })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/v1/me/avatar/photo', payload: { image: 'x'.repeat(200) } })).statusCode).toBe(401);
  });
  it('deleting the photo removes it', async () => {
    expect((await app.inject({ method: 'DELETE', url: '/v1/me/avatar/photo', headers: auth() })).statusCode).toBe(204);
    expect((await app.inject({ url: `/v1/avatars/${userId}` })).statusCode).toBe(404);
    expect((await app.inject({ url: '/v1/me', headers: auth() })).json().avatarUrl).toBeNull();
  });
});
