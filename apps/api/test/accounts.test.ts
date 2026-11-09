import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { buildApp } from '../src/app';
import type { AppConfig } from '../src/config';
import { transport } from '../src/services/push';
import { deliverDueReminders } from '../src/services/reminders';
import { freshDb } from './helpers';

const NOW = new Date('2026-11-08T12:00:00Z');
let pool: pg.Pool;
let config: AppConfig;
let app: FastifyInstance; // DEV_SHOW_CODES on (simulates a working email/SMS provider in tests)
let prodLike: FastifyInstance; // no delivery providers configured
const log = { info() {}, warn() {}, error() {}, debug() {} };
const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const sentWeb: string[] = [];

beforeAll(async () => {
  ({ pool, config } = await freshDb('accounts'));
  app = (await buildApp({ ...config, DEV_SHOW_CODES: true }, pool, { now: () => NOW })).app;
  prodLike = (await buildApp(config, pool, { now: () => NOW })).app;
  transport.web = async (_sub, payload) => {
    sentWeb.push(payload);
    return { statusCode: 201, body: '', headers: {} };
  };
});
afterAll(async () => {
  await app.close();
  await prodLike.close();
  await pool.end();
});

async function register(email: string, server = app) {
  const r = await server.inject({ method: 'POST', url: '/v1/auth/register', payload: { email, password: 'correct horse battery', name: 'Maria' } });
  expect(r.statusCode).toBe(200);
  return r.json<{ token: string; user: { id: string; emailVerified: boolean }; emailVerification: { sent: boolean; devCode?: string; reason?: string } }>();
}



describe('code delivery limits', () => {
  it('at most 5 codes per address per day, across accounts', async () => {
    const target = `bomb${Date.now()}@example.com`;
    const r = (await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: 'fresh' + Date.now() + '@example.com', password: 'correct horse 42' } })).json();
    for (let i = 0; i < 5; i++) {
      await pool.query(`INSERT INTO verification_codes (user_id, purpose, target, code_hash, expires_at) VALUES ($1, 'verify_email', $2, 'x', now() + interval '10 minutes')`, [r.user.id, target]);
    }
    const res = await app.inject({ method: 'POST', url: '/v1/me/contact/start', payload: { channel: 'email', email: target }, headers: { authorization: `Bearer ${r.token}` } });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('too_many_codes');
  });
});

describe('display name rules (server-side)', () => {
  it('rejects short, offensive and staff-impersonating names; collapses spaces', async () => {
    const reg = (name: string) => app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: `n${Math.random().toString(36).slice(2)}@example.com`, password: 'correct horse 42', name } });
    const short = await reg('Al');
    expect(short.statusCode).toBe(400);
    expect(short.json().error).toMatchObject({ code: 'invalid_name', details: { reason: 'too_short' } });
    expect((await reg('Admin')).json().error.details.reason).toBe('reserved');
    expect((await reg('Модератор')).json().error.details.reason).toBe('reserved');
    const ok = (await reg('  Anna    Maria ')).json();
    expect(ok.user.name).toBe('Anna Maria');
    const patch = await app.inject({ method: 'PATCH', url: '/v1/me', payload: { name: 'сука' }, headers: { authorization: `Bearer ${ok.token}` } });
    expect(patch.json().error.details.reason).toBe('offensive');
  });
});

describe('registration, sign-in, sign-out', () => {
  it('without an email service the account works, but the email stays unconfirmed and the reason is explicit', async () => {
    const r = await register('nobody@example.com', prodLike);
    expect(r.user.emailVerified).toBe(false);
    expect(r.emailVerification).toEqual({ sent: false, reason: 'email_delivery_unavailable' });
    const me = (await prodLike.inject({ url: '/v1/me', headers: auth(r.token) })).json();
    expect(me.email).toBe('nobody@example.com');
    expect(me.emailVerified).toBe(false);
  });

  it('rejects duplicate emails and weak passwords', async () => {
    expect((await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: 'NOBODY@example.com', password: 'whatever123' } })).json().error.code).toBe('email_taken');
    expect((await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: 'x@example.com', password: 'short' } })).statusCode).toBe(400);
  });

  it('login, wrong password, logout revokes the session', async () => {
    expect((await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'nobody@example.com', password: 'nope-nope-nope' } })).statusCode).toBe(401);
    const login = (await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'Nobody@Example.com', password: 'correct horse battery' } })).json();
    expect(login.user.name).toBe('Maria');
    expect((await app.inject({ url: '/v1/me', headers: auth(login.token) })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: auth(login.token) })).statusCode).toBe(204);
    const after = await app.inject({ url: '/v1/me', headers: auth(login.token) });
    expect(after.statusCode).toBe(401);
    expect(after.json().error.code).toBe('session_ended');
  });

  it('profile name persists', async () => {
    const r = await register('name@example.com');
    const p = (await app.inject({ method: 'PATCH', url: '/v1/me', headers: auth(r.token), payload: { name: 'Μαρία Π.' } })).json();
    expect(p.name).toBe('Μαρία Π.');
    expect((await app.inject({ url: '/v1/me', headers: auth(r.token) })).json().name).toBe('Μαρία Π.');
  });
});

describe('email & phone are linked only after a confirmed code', () => {
  it('email: wrong code fails, right code confirms', async () => {
    const r = await register('verify@example.com');
    const code = r.emailVerification.devCode!;
    expect(code).toMatch(/^\d{6}$/);
    expect((await app.inject({ method: 'POST', url: '/v1/me/contact/confirm', headers: auth(r.token), payload: { channel: 'email', code: code === '000000' ? '111111' : '000000' } })).json().error.code).toBe('invalid_code');
    const ok = (await app.inject({ method: 'POST', url: '/v1/me/contact/confirm', headers: auth(r.token), payload: { channel: 'email', code } })).json();
    expect(ok.emailVerified).toBe(true);
  });

  it('phone: shown as pending until confirmed; unavailable SMS service is reported, nothing linked', async () => {
    const r = await register('phone@example.com');
    const noSms = await prodLike.inject({ method: 'POST', url: '/v1/me/contact/start', headers: auth(r.token), payload: { channel: 'phone', phone: '+35799123456' } });
    expect(noSms.statusCode).toBe(503);
    expect(noSms.json().error.code).toBe('sms_delivery_unavailable');
    expect((await app.inject({ url: '/v1/me', headers: auth(r.token) })).json().phone).toBeNull();

    const start = (await app.inject({ method: 'POST', url: '/v1/me/contact/start', headers: auth(r.token), payload: { channel: 'phone', phone: '+35799123456' } })).json();
    const pending = (await app.inject({ url: '/v1/me', headers: auth(r.token) })).json();
    expect(pending.phone).toBeNull();
    expect(pending.pendingPhone).toBe('+35799123456');
    const done = (await app.inject({ method: 'POST', url: '/v1/me/contact/confirm', headers: auth(r.token), payload: { channel: 'phone', code: start.devCode } })).json();
    expect(done).toMatchObject({ phone: '+35799123456', phoneVerified: true });
  });

  it('rate-limits code requests and rejects malformed numbers', async () => {
    const r = await register('limits@example.com');
    expect((await app.inject({ method: 'POST', url: '/v1/me/contact/start', headers: auth(r.token), payload: { channel: 'email', email: 'limits@example.com' } })).json().error.code).toBe('code_recently_sent');
    expect((await app.inject({ method: 'POST', url: '/v1/me/contact/start', headers: auth(r.token), payload: { channel: 'phone', phone: '99123456' } })).statusCode).toBe(400);
  });

  it('password reset with a confirmed email', async () => {
    const start = (await app.inject({ method: 'POST', url: '/v1/auth/password-reset/start', payload: { email: 'verify@example.com' } })).json();
    const done = await app.inject({ method: 'POST', url: '/v1/auth/password-reset/confirm', payload: { email: 'verify@example.com', code: start.devCode, password: 'a brand new password' } });
    expect(done.statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'verify@example.com', password: 'a brand new password' } })).statusCode).toBe(200);
  });
});

describe('personal events in Cyprus time', () => {
  let token: string;
  beforeAll(async () => {
    token = (await register('events@example.com')).token;
  });

  it('requires sign-in', async () => {
    expect((await app.inject({ url: '/v1/me/events' })).statusCode).toBe(401);
  });

  it('creates an event from local Cyprus time (EET, UTC+2 in November)', async () => {
    const r = (await app.inject({ method: 'POST', url: '/v1/me/events', headers: auth(token), payload: {
      title: 'Starlight 2 at Pattihio', date: '2026-11-20', startTime: '20:30', endTime: '22:00', timezone: 'Europe/Nicosia',
      location: { name: 'Pattihio Municipal Theatre', lat: 34.6765, lng: 33.0435 }, reminderMinutes: 60,
    } })).json();
    expect(r.event.startsAt).toBe('2026-11-20T20:30:00.000+02:00');
    expect(r.event.reminder).toMatchObject({ minutes: 60, at: '2026-11-20T17:30:00.000Z', status: 'scheduled' });
    expect(r.event.location).toMatchObject({ name: 'Pattihio Municipal Theatre' });
  });

  it('summer time is UTC+3; an end before the start means the next day', async () => {
    const r = (await app.inject({ method: 'POST', url: '/v1/me/events', headers: auth(token), payload: { title: 'Beach party', date: '2027-07-10', startTime: '22:00', endTime: '02:00' } })).json();
    expect(r.event.startsAt).toBe('2027-07-10T22:00:00.000+03:00');
    expect(r.event.endsAt).toBe('2027-07-11T02:00:00.000+03:00');
  });

  it('a non-existent time (spring-forward gap) is shifted and flagged', async () => {
    const r = (await app.inject({ method: 'POST', url: '/v1/me/events', headers: auth(token), payload: { title: 'Early hike', date: '2027-03-28', startTime: '03:30', endTime: '06:00' } })).json();
    expect(r.timeAdjusted).toBe(true);
    expect(r.event.startTime).toBe('04:30');
  });

  it('validates, edits (re-arming the reminder), lists and deletes', async () => {
    expect((await app.inject({ method: 'POST', url: '/v1/me/events', headers: auth(token), payload: { title: 'x', date: '2026-11-20', startTime: '10:00', endDate: '2026-11-20', endTime: '09:00' } })).json().error.code).toBe('end_before_start');
    expect((await app.inject({ method: 'POST', url: '/v1/me/events', headers: auth(token), payload: { title: 'x', date: '2026-11-20', startTime: '10:00', endTime: '11:00', reminderMinutes: 7 } })).statusCode).toBe(400);
    const list = (await app.inject({ url: '/v1/me/events', headers: auth(token) })).json();
    const ev = list.items.find((e: { title: string }) => e.title.startsWith('Starlight'));
    await pool.query(`UPDATE personal_events SET reminder_sent_at = now(), reminder_status = 'sent' WHERE id = $1`, [ev.id]);
    const edited = (await app.inject({ method: 'PUT', url: `/v1/me/events/${ev.id}`, headers: auth(token), payload: { title: ev.title, date: '2026-11-20', startTime: '21:00', endTime: '22:30', reminderMinutes: 30 } })).json();
    expect(edited.event.reminder).toMatchObject({ at: '2026-11-20T18:30:00.000Z', status: 'scheduled' });
    const other = await (await import('./helpers')).token('44444444-4444-4444-8444-444444444444');
    expect((await app.inject({ method: 'DELETE', url: `/v1/me/events/${ev.id}`, headers: auth(other) })).statusCode).toBe(404); // not yours
    expect((await app.inject({ method: 'DELETE', url: `/v1/me/events/${ev.id}`, headers: auth(token) })).statusCode).toBe(204);
  });

  it('links a place or event from the app', async () => {
    const place = (await pool.query(`INSERT INTO places (name, primary_category, categories, location, country_code) VALUES ('Kourion','historic-site','{historic-site}', ST_SetSRID(ST_MakePoint(32.888,34.664),4326)::geography,'CY') RETURNING id`)).rows[0];
    const r = (await app.inject({ method: 'POST', url: '/v1/me/events', headers: auth(token), payload: { title: 'Visit Kourion', date: '2026-11-21', startTime: '10:00', endTime: '12:00', entityType: 'place', entityId: place.id, location: { name: 'Kourion', lat: 34.664, lng: 32.888 } } })).json();
    expect(r.event.entity).toEqual({ type: 'place', id: place.id });
  });
});

describe('reminder delivery (real pipeline, push transport stubbed)', () => {
  it('delivers via Web Push, records the outcome, never twice; reports users without channels', async () => {
    const withPush = await register('push@example.com');
    const noPush = await register('nopush@example.com');
    await app.inject({ method: 'POST', url: '/v1/me/web-push', headers: auth(withPush.token), payload: { endpoint: 'https://push.example/sub/1', keys: { p256dh: 'BOr-fake-key', auth: 'fake-auth' } } });
    for (const t of [withPush.token, noPush.token]) {
      await app.inject({ method: 'POST', url: '/v1/me/events', headers: auth(t), payload: { title: 'Dinner at Ta Piatakia', date: '2026-11-08', startTime: '19:00', endTime: '21:00', reminderMinutes: 30, location: { name: 'Ta Piatakia' } } });
    }
    sentWeb.length = 0;
    // 18:31 Cyprus = 16:31Z: the 18:30 reminder is due.
    const stats = await deliverDueReminders(pool, config, log, new Date('2026-11-08T16:31:00Z'));
    expect(stats).toMatchObject({ sent: 1, noChannel: 1 });
    expect(JSON.parse(sentWeb[0]!)).toMatchObject({ title: 'Dinner at Ta Piatakia', body: 'Starts 19:00 · Ta Piatakia' });
    const again = await deliverDueReminders(pool, config, log, new Date('2026-11-08T16:35:00Z'));
    expect(again.sent).toBe(0);
    const mine = (await app.inject({ url: '/v1/me/events', headers: auth(noPush.token) })).json();
    expect(mine.items[0].reminder.status).toBe('no_channel');
  });

  it('a reminder found after the event ended (e.g. server asleep) is not sent late', async () => {
    const r = await register('late@example.com');
    await app.inject({ method: 'POST', url: '/v1/me/web-push', headers: auth(r.token), payload: { endpoint: 'https://push.example/sub/late', keys: { p256dh: 'k', auth: 'a' } } });
    await app.inject({ method: 'POST', url: '/v1/me/events', headers: auth(r.token), payload: { title: 'Morning yoga', date: '2026-11-08', startTime: '08:00', endTime: '09:00', reminderMinutes: 15 } });
    const s = await deliverDueReminders(pool, config, log, new Date('2026-11-08T12:00:00Z'));
    expect(s.stale).toBe(1);
  });

  it('notification status and a real test send through the configured transports', async () => {
    const r = await register('test-send@example.com');
    expect((await app.inject({ url: '/v1/me/notifications', headers: auth(r.token) })).json().channels).toEqual({ webPush: 0, nativePush: 0 });
    await app.inject({ method: 'POST', url: '/v1/me/web-push', headers: auth(r.token), payload: { endpoint: 'https://push.example/sub/test', keys: { p256dh: 'k', auth: 'a' } } });
    const t = (await app.inject({ method: 'POST', url: '/v1/me/notifications/test', headers: auth(r.token) })).json();
    expect(t.result.webPush).toEqual({ sent: 1, failed: 0 });
    expect((await app.inject('/v1/push/vapid-public-key')).json().publicKey.length).toBeGreaterThan(40);
  });

  it('expired subscriptions (410 Gone) are disabled', async () => {
    const r = await register('gone@example.com');
    await app.inject({ method: 'POST', url: '/v1/me/web-push', headers: auth(r.token), payload: { endpoint: 'https://push.example/sub/gone', keys: { p256dh: 'k', auth: 'a' } } });
    const prev = transport.web;
    transport.web = async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }); };
    const t = (await app.inject({ method: 'POST', url: '/v1/me/notifications/test', headers: auth(r.token) })).json();
    transport.web = prev;
    expect(t.result.webPush).toEqual({ sent: 0, failed: 1 });
    expect((await pool.query(`SELECT disabled_at FROM web_push_subscriptions WHERE endpoint = 'https://push.example/sub/gone'`)).rows[0].disabled_at).not.toBeNull();
  });
});
