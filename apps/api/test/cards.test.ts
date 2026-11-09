import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizeJsonLdEvent } from '../src/engine/connectors/structured-web';
import { weeklySchedule } from '../src/lib/hours';
import { Summarizer, factsSentence, numbersSupported } from '../src/services/summaries';
import { freshDb } from './helpers';

let pool: pg.Pool;
let config: Awaited<ReturnType<typeof freshDb>>['config'];
beforeAll(async () => { const d = await freshDb('cards'); pool = d.pool; config = d.config; });
afterAll(async () => pool.end());
const log = { info() {}, warn() {}, error() {}, debug() {} };

describe('event doors vs start', () => {
  it('reads schema.org doorTime separately from the start', () => {
    const e = normalizeJsonLdEvent({ '@type': 'MusicEvent', name: 'Jazz Night', startDate: '2026-11-20T21:00:00+02:00', doorTime: '20:00', location: { name: 'Rialto' } }, 'https://x.example/e', 'Europe/Nicosia', 'test');
    expect(e!.startsAt.toISOString()).toBe('2026-11-20T19:00:00.000Z');
    expect(e!.doorsAt!.toISOString()).toBe('2026-11-20T18:00:00.000Z');
  });
  it('ignores a doors time after the start', () => {
    const e = normalizeJsonLdEvent({ '@type': 'Event', name: 'X', startDate: '2026-11-20T21:00:00+02:00', doorTime: '2026-11-20T22:00:00+02:00' }, 'https://x.example/e', 'Europe/Nicosia', 'test');
    expect(e!.doorsAt).toBeNull();
  });
});

describe('weekly opening hours', () => {
  it('7 days with breaks, closed days, public holidays and unknown days — never guessed', () => {
    const w = weeklySchedule('Mo-Fr 09:00-13:00,16:00-20:00; Sa 09:00-14:00; PH off', new Date('2026-12-21T10:00:00+02:00'), 'Europe/Nicosia', 34.68, 33.04, 'en')!;
    expect(w).toHaveLength(7);
    expect(w[0]).toMatchObject({ weekday: 'Mon', intervals: [['09:00', '13:00'], ['16:00', '20:00']], publicHoliday: false });
    expect(w[4]).toMatchObject({ date: '2026-12-25', publicHoliday: true, intervals: [] }); // Christmas: closed
    expect(w[3]!.intervals).toBeNull(); // 24 Dec: holiday status differs between calendars → unknown
    expect(w[6]!.intervals).toEqual([]); // Sunday closed
    expect(weeklySchedule('Mo-Su 18:00-02:00', new Date('2026-11-09T10:00:00+02:00'), 'Europe/Nicosia', 34.68, 33.04, 'en')![0]!.intervals).toEqual([['18:00', '02:00']]);
    expect(weeklySchedule('whenever', new Date(), 'Europe/Nicosia', 34.68, 33.04, 'en')).toBeNull();
  });
});

describe('descriptions from verified facts', () => {
  const facts = { title: 'Jazz Night', category: 'Concert', venue: 'Rialto Theatre', city: 'Limassol', when: 'Fri 20 Nov · 21:00–23:00', price: 'From €15', organizer: 'Rialto', sourceDescriptions: [] };
  it('rejects text with numbers not in the facts (invented times, prices, years)', () => {
    expect(numbersSupported('A concert at Rialto from 21:00, tickets from €15.', facts)).toBe(true);
    expect(numbersSupported('Doors at 20:30, tickets €25.', facts)).toBe(false);
    expect(numbersSupported('Founded in 1932, the venue…', facts)).toBe(false);
  });
  it('plain facts sentence in three languages', () => {
    expect(factsSentence('event', facts, 'en')).toBe('Concert at Rialto Theatre, Limassol. Fri 20 Nov · 21:00–23:00. Tickets: From €15. Organised by Rialto.');
    expect(factsSentence('event', facts, 'ru')).toContain('Организатор: Rialto');
  });
  it('uses the AI text only when it passes the check; otherwise the facts sentence', async () => {
    const fake = (text: string) => ({ beta: { messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ summary: text }) }] }) } } });
    const id = '00000000-0000-4000-8000-000000000001';
    const good = new Summarizer(pool, config, log, fake('An evening of jazz at the Rialto Theatre in Limassol, organised by the venue itself. Tickets start from €15.') as never);
    expect(await good.get('event', id, facts, 'en')).toMatchObject({ engine: 'ai' });
    const id2 = '00000000-0000-4000-8000-000000000002';
    const lying = new Summarizer(pool, config, log, fake('Featuring the Miles Quartet from 20:00 with tickets at €40, a tradition since 1985.') as never);
    expect(await lying.get('event', id2, facts, 'en')).toEqual({ engine: 'facts', text: factsSentence('event', facts, 'en') });
  });
});
