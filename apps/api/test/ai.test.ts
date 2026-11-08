import Anthropic from '@anthropic-ai/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import type { AppConfig } from '../src/config';
import { QueryInterpreter, jsonSchema } from '../src/services/ai';
import { freshDb } from './helpers';

const log = { info() {}, warn() {}, error() {}, debug() {} };
let pool: pg.Pool;
let config: AppConfig;

/** Minimal stand-in for the SDK client: records requests, returns a scripted response or throws. */
function stub(respond: () => unknown) {
  const calls: Array<Record<string, unknown>> = [];
  const client = { beta: { messages: { create: async (body: Record<string, unknown>) => { calls.push(body); return respond(); } } } };
  return { client: client as unknown as Anthropic, calls };
}
const reply = (json: unknown, stop = 'end_turn') => ({ stop_reason: stop, content: [{ type: 'text', text: JSON.stringify(json) }] });

beforeAll(async () => {
  ({ pool, config } = await freshDb('ai'));
});
afterAll(async () => pool.end());

describe('AI query interpretation', () => {
  it('schema is strict: closed objects, enums for categories and cities', () => {
    const s = jsonSchema() as { additionalProperties: boolean; required: string[]; properties: Record<string, { items?: { enum?: string[] } }> };
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toHaveLength(11);
    expect(s.properties.categories!.items!.enum).toContain('karting');
  });

  it('uses structured output + low effort + server-side fallbacks, then merges with rule signals', async () => {
    const { client, calls } = stub(() => reply({ categories: ['concert'], groups: [], entityTypes: ['event'], time: 'weekend', city: null, radiusKm: null, nearMe: false, freeOnly: false, openNow: false, sort: 'relevance', keywords: ['metal'] }));
    const qi = new QueryInterpreter({ ...config, ANTHROPIC_MODEL: 'claude-opus-5-5' }, pool, log, client);
    const r = await qi.interpret('heavy gigs in Limassol this weekend', 'en');
    expect(r.engine).toBe('ai');
    expect(r.filters.city).toBe('limassol'); // from rules: AI must not drop a city the user said
    expect(r.filters.categories).toContain('concert');
    const body = calls[0]!;
    expect(body.model).toBe('claude-opus-5-5');
    expect(body.output_config).toMatchObject({ effort: 'low', format: { type: 'json_schema' } });
    expect(body.fallbacks).toBe('default');
    expect(body.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(body).not.toHaveProperty('tool_choice');
  });

  it('caches interpretations (no user id stored) and does not call the model twice', async () => {
    const { client, calls } = stub(() => reply({ categories: ['bar'], groups: [], entityTypes: [], time: null, city: null, radiusKm: null, nearMe: false, freeOnly: false, openNow: false, sort: 'relevance', keywords: [] }));
    const qi = new QueryInterpreter(config, pool, log, client);
    await qi.interpret('cocktails please', 'en');
    const qi2 = new QueryInterpreter(config, pool, log, client);
    const r = await qi2.interpret('cocktails please', 'en');
    expect(calls).toHaveLength(1);
    expect(r.filters.categories).toContain('bar');
    const row = (await pool.query('SELECT * FROM search_interpretations')).rows[0];
    expect(Object.keys(row).sort()).toEqual(['created_at', 'engine', 'interpretation', 'query_key']);
  });

  it('falls back to the deterministic parser on errors, refusals and invalid output', async () => {
    for (const respond of [
      () => { throw new Anthropic.APIConnectionTimeoutError(); },
      () => reply({}, 'refusal'),
      () => reply({ categories: ['not-a-category'] }),
      () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }),
    ]) {
      const qi = new QueryInterpreter(config, pool, log, stub(respond).client);
      const r = await qi.interpret(`pharmacy near me ${Math.random()}`, 'en');
      expect(r.engine).toBe('rules');
      expect(r.filters.categories).toEqual(['pharmacy']);
    }
  });

  it('without a key, never calls a model', async () => {
    const qi = new QueryInterpreter({ ...config, ANTHROPIC_API_KEY: undefined }, pool, log);
    expect(qi.aiEnabled).toBe(false);
    expect((await qi.interpret('бесплатные мероприятия', 'ru')).engine).toBe('rules');
  });
});
