import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { decide, ruleCheck } from '../src/services/moderation';
import { freshDb } from './helpers';

let pool: pg.Pool;
let app: FastifyInstance;
let placeId: string;
let pastEvent: string;
let futureEvent: string;
const tokens: Record<string, string> = {};

async function user(name: string, verified: 'email' | 'phone' | null) {
  const r = (await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: `${name}@example.com`, password: 'correct horse 42', name } })).json();
  if (verified === 'email') await pool.query('UPDATE users SET email_verified_at = now() WHERE id = $1', [r.user.id]);
  if (verified === 'phone') await pool.query(`UPDATE users SET phone = '+35799000001', phone_verified_at = now() WHERE id = $1`, [r.user.id]);
  tokens[name] = r.token;
  return r.user.id as string;
}
const auth = (n: string) => ({ authorization: `Bearer ${tokens[n]}` });
const post = (n: string, url: string, payload: object) => app.inject({ method: 'POST', url, payload, headers: auth(n) });

beforeAll(async () => {
  const db = await freshDb('reviews');
  pool = db.pool;
  app = (await buildApp(db.config, pool)).app;
  placeId = (await pool.query(`INSERT INTO places (name, primary_category, categories, location, country_code) VALUES ('Meze House', 'restaurant', '{restaurant}', ST_SetSRID(ST_MakePoint(33.04, 34.68), 4326)::geography, 'CY') RETURNING id`)).rows[0].id;
  const ev = (when: string) => pool.query(`INSERT INTO events (title, primary_category, categories, country_code, timezone, starts_at, time_precision, local_start_date) VALUES ('Jazz', 'concert', '{concert}', 'CY', 'Europe/Nicosia', now() + $1::interval, 'exact', (now() + $1::interval)::date) RETURNING id`, [when]);
  pastEvent = (await ev('-2 hours')).rows[0].id;
  futureEvent = (await ev('3 days')).rows[0].id;
  await user('anna', 'email');
  await user('boris', 'phone');
  await user('carl', null);
  await user('dina', 'email');
});
afterAll(async () => { await app.close(); await pool.end(); });

describe('reviews: who can post', () => {
  it('signed-out users can read but not post', async () => {
    expect((await app.inject(`/v1/places/${placeId}/reviews`)).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/v1/places/${placeId}/reviews`, payload: { rating: 5 } })).statusCode).toBe(401);
  });
  it('an account needs a confirmed email OR phone — one is enough', async () => {
    const r = await post('carl', `/v1/places/${placeId}/reviews`, { rating: 4, body: 'Nice' });
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe('verification_required');
    expect((await post('anna', `/v1/places/${placeId}/reviews`, { rating: 5, body: 'Lovely halloumi and friendly staff.' })).json()).toMatchObject({ status: 'published', created: true });
    expect((await post('boris', `/v1/places/${placeId}/reviews`, { rating: 3, body: 'Good food but slow service.' })).json()).toMatchObject({ status: 'published' });
  });
  it('events can be rated only once they have started', async () => {
    expect((await post('anna', `/v1/events/${futureEvent}/reviews`, { rating: 5 })).json().error.code).toBe('event_not_started');
    expect((await post('anna', `/v1/events/${pastEvent}/reviews`, { rating: 4, body: 'Great trio.' })).statusCode).toBe(200);
    const ev = (await app.inject(`/v1/events/${pastEvent}`)).json();
    expect(ev.event.rating).toEqual({ average: 4, count: 1, source: 'passtra' });
  });
});

describe('reviews: one per user, own edits only', () => {
  it('posting again updates the same review; rating summary follows', async () => {
    const again = (await post('anna', `/v1/places/${placeId}/reviews`, { rating: 4, body: 'Still lovely, a bit pricier now.' })).json();
    expect(again.created).toBe(false);
    const list = (await app.inject({ url: `/v1/places/${placeId}/reviews`, headers: auth('anna') })).json();
    expect(list.summary).toMatchObject({ count: 2, average: 3.5, distribution: { 3: 1, 4: 1 } });
    expect(list.items[0]).toMatchObject({ mine: true, rating: 4, author: { name: 'anna' } });
    expect(list.items[0].editedAt).not.toBeNull();
  });
  it('nobody can delete someone else\'s review', async () => {
    const list = (await app.inject({ url: `/v1/places/${placeId}/reviews`, headers: auth('boris') })).json();
    const annas = list.items.find((i: { author: { name: string } }) => i.author.name === 'anna');
    expect((await app.inject({ method: 'DELETE', url: `/v1/reviews/${annas.id}`, headers: auth('boris') })).statusCode).toBe(404);
    const mine = list.items.find((i: { mine: boolean }) => i.mine);
    expect((await app.inject({ method: 'DELETE', url: `/v1/reviews/${mine.id}`, headers: auth('boris') })).statusCode).toBe(204);
    expect((await app.inject(`/v1/places/${placeId}/reviews`)).json().summary.count).toBe(1);
  });
  it('helpful votes: once per user, not on your own review', async () => {
    const r = (await app.inject(`/v1/places/${placeId}/reviews`)).json().items[0];
    expect((await post('anna', `/v1/reviews/${r.id}/helpful`, {})).statusCode).toBe(400);
    await post('dina', `/v1/reviews/${r.id}/helpful`, {});
    await post('dina', `/v1/reviews/${r.id}/helpful`, {});
    expect((await app.inject(`/v1/places/${placeId}/reviews`)).json().items[0].helpfulCount).toBe(1);
  });
});

describe('moderation', () => {
  it('a rude word describing the experience is fine; insults, threats, links, ads and personal data are not', () => {
    expect(decide(ruleCheck('The souvlaki was damn good, best in town').labels, null)).toBe('publish');
    expect(decide(ruleCheck('Κάθε φορά τα σκατά παρκάρισμα, αλλά το φαγητό τέλειο').labels, null)).toBe('publish');
    expect(decide(ruleCheck('The waiter is a fucking idiot').labels, null)).toBe('pending');
    expect(decide(ruleCheck('Официант — тупой урод, блять').labels, null)).toBe('pending');
    expect(decide(ruleCheck('I will kill the owner').labels, null)).toBe('pending');
    expect(decide(ruleCheck('Θα σε σκοτώσω').labels, null)).toBe('pending');
    expect(decide(ruleCheck('Earn money from home, write on telegram t.me/fastcash').labels, null)).toBe('reject');
    expect(decide(ruleCheck('Better food at www.othertaverna.com').labels, null)).toBe('pending');
    const pd = ruleCheck('Call Maria on +357 99 123456 or maria@example.com to book');
    expect(pd.masked).toBe('Call Maria on [hidden] or [hidden] to book');
    expect(decide(pd.labels, null)).toBe('publish');
  });
  it('AI context can clear a flagged review but never a link', () => {
    expect(decide(['insult', 'profanity'], { decision: 'publish', severity: 0 })).toBe('publish');
    expect(decide(['link'], { decision: 'publish', severity: 0 })).toBe('pending');
    expect(decide([], { decision: 'reject', severity: 3 })).toBe('reject');
  });
  it('end to end: an insulting review is held for a moderator and not counted; a copied text from another account too', async () => {
    const r = (await post('dina', `/v1/places/${placeId}/reviews`, { rating: 1, body: 'The owner is a fucking idiot' })).json();
    expect(r.status).toBe('pending');
    expect((await app.inject(`/v1/places/${placeId}/reviews`)).json().summary.count).toBe(1); // pending isn't counted or shown
    const mineView = (await app.inject({ url: `/v1/places/${placeId}/reviews`, headers: auth('dina') })).json().items.find((i: { mine: boolean }) => i.mine);
    expect(mineView.status).toBe('pending'); // the author sees it is waiting
    await post('anna', `/v1/events/${pastEvent}/reviews`, { rating: 5, body: 'Absolutely amazing night, would come again for sure!' });
    expect((await post('boris', `/v1/events/${pastEvent}/reviews`, { rating: 5, body: 'Absolutely amazing night, would come again for sure!' })).json().status).toBe('pending');
  });
  it('three reports hide a review until a moderator decides', async () => {
    const id = (await app.inject(`/v1/places/${placeId}/reviews`)).json().items[0].id;
    for (const ip of ['10.0.0.1', '10.0.0.2', '10.0.0.3']) await app.inject({ method: 'POST', url: `/v1/reviews/${id}/report`, payload: { reason: 'fake' }, remoteAddress: ip });
    expect((await app.inject(`/v1/places/${placeId}/reviews`)).json().summary.count).toBe(0);
  });
});
