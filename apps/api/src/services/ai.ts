import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { CATEGORIES, CITIES, INTEREST_GROUPS, SearchFiltersSchema, TIME_KINDS, mergeFilters, normalizeText, parseQuery, type SearchFilters } from '@passtra/core';
import type pg from 'pg';
import type { AppConfig } from '../config';
import type { Logger } from '../engine/types';

/**
 * Natural-language query → structured filters.
 *
 * The model only ever returns FILTERS (validated by a strict JSON schema + zod). It never sees or
 * produces search results, dates, prices or places — results always come from the database.
 * On missing key, timeout (default 2.5 s), refusal or invalid output, the deterministic
 * multilingual parser is used instead. Interpretations are cached without any user identifier.
 */

const SYSTEM = `You convert a user's search query for a local-discovery app into search filters.
The app lists real places and events; you never answer the query yourself.
Rules:
- Use only category slugs, interest groups, time values and city slugs from the schema enums.
- "near me", "nearby", "рядом", "κοντά" → nearMe=true. A distance like "10 km" → radiusKm.
- "free"/"бесплатно"/"δωρεάν" → freeOnly=true. "open now" → openNow=true and time="now".
- entityTypes: ["event"] for concerts/parties/shows/"what's on"; ["place"] for venues/shops/services; [] if unclear.
- keywords: only proper names or specific terms not captured by categories (e.g. an artist or venue name), lowercase, max 4.
- If something is not stated, use the empty/default value. Do not guess a city or time that the user did not mention.
The query may be in English, Greek or Russian.`;

export function jsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['categories', 'groups', 'entityTypes', 'time', 'city', 'radiusKm', 'nearMe', 'freeOnly', 'openNow', 'sort', 'keywords'],
    properties: {
      categories: { type: 'array', items: { type: 'string', enum: CATEGORIES.map((c) => c.slug) } },
      groups: { type: 'array', items: { type: 'string', enum: [...INTEREST_GROUPS] } },
      entityTypes: { type: 'array', items: { type: 'string', enum: ['event', 'place'] } },
      time: { anyOf: [{ type: 'string', enum: [...TIME_KINDS] }, { type: 'null' }] },
      city: { anyOf: [{ type: 'string', enum: CITIES.map((c) => c.slug) }, { type: 'null' }] },
      radiusKm: { anyOf: [{ type: 'number' }, { type: 'null' }] },
      nearMe: { type: 'boolean' },
      freeOnly: { type: 'boolean' },
      openNow: { type: 'boolean' },
      sort: { type: 'string', enum: ['relevance', 'distance', 'rating', 'time'] },
      keywords: { type: 'array', items: { type: 'string' } },
    },
  };
}

export interface Interpretation {
  filters: SearchFilters;
  engine: 'ai' | 'rules';
}

export class QueryInterpreter {
  private client: Anthropic | null;
  private memo = new Map<string, Interpretation>();

  constructor(private config: AppConfig, private db: pg.Pool, private log: Logger, client?: Anthropic | null) {
    this.client = client !== undefined ? client : config.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, maxRetries: 0 }) : null;
  }

  get aiEnabled(): boolean {
    return this.client !== null;
  }

  async interpret(query: string, locale: string): Promise<Interpretation> {
    const rules = parseQuery(query);
    if (!this.client || normalizeText(query).length < 3) return { filters: rules, engine: 'rules' };

    const key = createHash('sha256').update(`${this.config.ANTHROPIC_MODEL}|${locale}|${normalizeText(query)}`).digest('hex');
    const memo = this.memo.get(key);
    if (memo) return memo;
    const cached = await this.db.query<{ interpretation: SearchFilters }>('SELECT interpretation FROM search_interpretations WHERE query_key = $1 AND created_at > now() - interval \'30 days\'', [key]);
    if (cached.rows[0]) {
      const parsed = SearchFiltersSchema.safeParse(cached.rows[0].interpretation);
      if (parsed.success) return this.remember(key, { filters: mergeFilters(parsed.data, rules), engine: 'ai' });
    }

    try {
      const response = await this.client.beta.messages.create(
        {
          model: this.config.ANTHROPIC_MODEL,
          max_tokens: 1024,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'low', format: { type: 'json_schema', schema: jsonSchema() } },
          system: SYSTEM,
          messages: [{ role: 'user', content: `UI language: ${locale}\nQuery: ${query.slice(0, 300)}` }],
        },
        { timeout: this.config.AI_SEARCH_TIMEOUT_MS, maxRetries: 0 },
      );
      if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
        this.log.warn({ stop: response.stop_reason }, 'ai search: unusable stop reason, using rules');
        return { filters: rules, engine: 'rules' };
      }
      const text = response.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') return { filters: rules, engine: 'rules' };
      const parsed = SearchFiltersSchema.safeParse(JSON.parse(text.text));
      if (!parsed.success) {
        this.log.warn({ issues: parsed.error.issues.slice(0, 3) }, 'ai search: schema mismatch, using rules');
        return { filters: rules, engine: 'rules' };
      }
      await this.db.query(
        `INSERT INTO search_interpretations (query_key, interpretation, engine) VALUES ($1,$2,'ai')
         ON CONFLICT (query_key) DO UPDATE SET interpretation = EXCLUDED.interpretation, created_at = now()`,
        [key, JSON.stringify(parsed.data)],
      );
      return this.remember(key, { filters: mergeFilters(parsed.data, rules), engine: 'ai' });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) this.log.warn({}, 'ai search: rate limited, using rules');
      else if (e instanceof Anthropic.APIError) this.log.warn({ status: e.status }, 'ai search: API error, using rules');
      else this.log.warn({ err: (e as Error).message }, 'ai search: failed, using rules');
      return { filters: rules, engine: 'rules' };
    }
  }

  private remember(key: string, i: Interpretation): Interpretation {
    if (this.memo.size > 2000) this.memo.clear();
    this.memo.set(key, i);
    return i;
  }
}
