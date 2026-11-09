import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import type { EventDTO, Locale, PlaceDTO } from '@passtra/core';
import type pg from 'pg';
import type { AppConfig } from '../config';
import type { Logger } from '../engine/types';

/**
 * Short descriptions for events and places that have no official text.
 *  - Facts come only from our records (all sources' descriptions included).
 *  - With an Anthropic key, Claude writes 2–4 sentences from those facts; the output is rejected if it contains
 *    any number (time, date, price, age) not present in the facts — so programme, times or prices can't be invented.
 *  - Otherwise (or on rejection/timeout) a plain sentence is assembled from the same facts.
 * Cached per entity, language and facts fingerprint.
 */
export interface Summary { text: string; engine: 'ai' | 'facts' }

type Facts = Record<string, string | number | boolean | string[] | null>;

const SYSTEM = `You write short descriptions for a local events and places app in Cyprus.
Use ONLY the facts given. Never add performers, programme, menu items, prices, times, dates, ages, history or
claims that are not in the facts. If facts are thin, write less. No marketing superlatives. No emojis.
Write 2–4 sentences in the requested language. Do not repeat the title verbatim at the start.`;

const SCHEMA = { type: 'object', additionalProperties: false, required: ['summary'], properties: { summary: { type: 'string' } } };

const L = {
  event: { en: '{cat} at {venue}{city}.', el: '{cat} στο {venue}{city}.', ru: '{cat}: {venue}{city}.' },
  org: { en: ' Organised by {o}.', el: ' Διοργάνωση: {o}.', ru: ' Организатор: {o}.' },
  when: { en: ' {w}.', el: ' {w}.', ru: ' {w}.' },
  price: { en: ' Tickets: {p}.', el: ' Εισιτήρια: {p}.', ru: ' Билеты: {p}.' },
  place: { en: '{cat}{city}.', el: '{cat}{city}.', ru: '{cat}{city}.' },
  serves: { en: ' Cuisine: {c}.', el: ' Κουζίνα: {c}.', ru: ' Кухня: {c}.' },
  hours: { en: ' {h}.', el: ' {h}.', ru: ' {h}.' },
} satisfies Record<string, Record<Locale, string>>;

export function eventFacts(e: EventDTO, extraDescriptions: string[]): Facts {
  return {
    title: e.title, category: e.category.label, venue: e.venue.name, address: e.venue.address, city: e.city?.name ?? null,
    when: e.time.label, doors: e.time.doorsAt ?? null, price: e.price.label, organizer: e.organizer, ageMin: e.ageMin,
    status: e.status, sourceDescriptions: [e.description, ...extraDescriptions].filter((x): x is string => !!x).map((x) => x.slice(0, 700)),
  };
}

export function placeFacts(p: PlaceDTO, tags: string[]): Facts {
  return {
    name: p.name, category: p.category.label, address: p.address, city: p.city?.name ?? null, openingHours: p.hours.raw,
    tags, wheelchair: null, sourceDescriptions: [p.about?.text ?? null, p.description].filter((x): x is string => !!x).map((x) => x.slice(0, 700)),
  };
}

export function factsSentence(kind: 'event' | 'place', f: Facts, locale: Locale): string {
  const city = f.city ? `, ${f.city}` : '';
  if (kind === 'event') {
    let s = L.event[locale].replace('{cat}', String(f.category)).replace('{venue}', String(f.venue ?? f.address ?? f.city ?? '—')).replace('{city}', f.venue || f.address ? city : '');
    if (f.when) s += L.when[locale].replace('{w}', String(f.when));
    if (f.price) s += L.price[locale].replace('{p}', String(f.price));
    if (f.organizer) s += L.org[locale].replace('{o}', String(f.organizer));
    return s.trim();
  }
  let s = L.place[locale].replace('{cat}', String(f.category)).replace('{city}', f.address ? ` — ${f.address}` : city);
  if (Array.isArray(f.tags) && f.tags.length) s += L.serves[locale].replace('{c}', f.tags.slice(0, 4).join(', '));
  return s.trim();
}

/** Every number in the text must appear in the facts (times, prices, dates, ages, years). */
export function numbersSupported(text: string, facts: Facts): boolean {
  const source = JSON.stringify(facts);
  return (text.match(/\d+(?:[.,:]\d+)?/g) ?? []).every((n) => source.includes(n) || source.includes(n.replace(',', '.')) || source.includes(n.replace(':', '.')));
}

export class Summarizer {
  private client: Anthropic | null;
  constructor(private db: pg.Pool, private config: AppConfig, private log: Logger, client?: Anthropic | null) {
    this.client = client !== undefined ? client : config.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, maxRetries: 0 }) : null;
  }

  async get(kind: 'event' | 'place', id: string, facts: Facts, locale: Locale): Promise<Summary> {
    const hash = createHash('sha256').update(JSON.stringify(facts)).digest('hex').slice(0, 32);
    const cached = await this.db.query<{ text: string; engine: 'ai' | 'facts'; facts_hash: string }>(
      'SELECT text, engine, facts_hash FROM entity_summaries WHERE entity_type = $1 AND entity_id = $2 AND locale = $3', [kind, id, locale]);
    const row = cached.rows[0];
    if (row && row.facts_hash === hash && (row.engine === 'ai' || !this.client)) return { text: row.text, engine: row.engine };
    let out: Summary = { text: factsSentence(kind, facts, locale), engine: 'facts' };
    if (this.client) {
      try {
        const r = await this.client.beta.messages.create({
          model: this.config.ANTHROPIC_MODEL, max_tokens: 400, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
          output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } }, system: SYSTEM,
          messages: [{ role: 'user', content: `Language: ${locale}\nFacts (JSON):\n${JSON.stringify(facts)}` }],
        }, { timeout: 6000, maxRetries: 0 });
        const block = r.content.find((b) => b.type === 'text');
        const text = block && block.type === 'text' ? (JSON.parse(block.text) as { summary?: string }).summary?.trim() : undefined;
        if (r.stop_reason === 'end_turn' && text && text.length >= 40 && text.length <= 900 && numbersSupported(text, facts)) out = { text, engine: 'ai' };
        else this.log.warn({ kind, id, stop: r.stop_reason }, 'summary rejected; using facts sentence');
      } catch (e) {
        this.log.warn({ err: (e as Error).message }, 'summary generation failed; using facts sentence');
      }
    }
    await this.db.query(`INSERT INTO entity_summaries (entity_type, entity_id, locale, facts_hash, text, engine, model) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (entity_type, entity_id, locale) DO UPDATE SET facts_hash = EXCLUDED.facts_hash, text = EXCLUDED.text, engine = EXCLUDED.engine, model = EXCLUDED.model, created_at = now()`,
      [kind, id, locale, hash, out.text, out.engine, out.engine === 'ai' ? this.config.ANTHROPIC_MODEL : null]);
    return out;
  }
}
