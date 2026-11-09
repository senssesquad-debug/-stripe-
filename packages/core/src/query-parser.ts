import { z } from 'zod';
import { CATEGORIES, CATEGORY_SLUGS, GROUP_KEYWORDS, INTEREST_GROUPS, type InterestGroup } from './categories';
import { LOCALES, type Locale } from './locales';
import { CITIES } from './regions';
import { canonicalKey, normalizeText } from './text';

export const TIME_KINDS = ['now', 'today', 'tonight', 'tomorrow', 'weekend', 'this_week', 'next_7_days'] as const;

/** The only thing an AI model is allowed to produce for search: filters, never results. */
export const SearchFiltersSchema = z.object({
  categories: z.array(z.enum(CATEGORY_SLUGS)).max(12).default([]),
  groups: z.array(z.enum(INTEREST_GROUPS)).max(6).default([]),
  entityTypes: z.array(z.enum(['event', 'place'])).max(2).default([]),
  time: z.enum(TIME_KINDS).nullable().default(null),
  city: z.string().max(40).nullable().default(null),
  radiusKm: z.number().min(0.5).max(100).nullable().default(null),
  nearMe: z.boolean().default(false),
  freeOnly: z.boolean().default(false),
  openNow: z.boolean().default(false),
  sort: z.enum(['relevance', 'distance', 'rating', 'time']).default('relevance'),
  keywords: z.array(z.string().max(40)).max(8).default([]),
});
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

type Matcher = { words: string[]; target: { kind: 'category'; slug: string } | { kind: 'group'; group: InterestGroup } };

const norm = (s: string) => normalizeText(s);

let MATCHERS: Matcher[] | null = null;
function matchers(): Matcher[] {
  if (MATCHERS) return MATCHERS;
  const out: Matcher[] = [];
  for (const cat of CATEGORIES) {
    for (const loc of LOCALES) for (const kw of cat.keywords[loc] ?? []) out.push({ words: norm(kw).split(' '), target: { kind: 'category', slug: cat.slug } });
  }
  for (const g of INTEREST_GROUPS) {
    for (const loc of LOCALES) for (const kw of GROUP_KEYWORDS[g][loc] ?? []) out.push({ words: norm(kw).split(' '), target: { kind: 'group', group: g } });
  }
  // Longer phrases first, then longer first word (so "barbershop" beats "bar").
  out.sort((a, b) => b.words.length - a.words.length || b.words.join(' ').length - a.words.join(' ').length);
  MATCHERS = out;
  return out;
}

/**
 * Dishes: a pizzeria is a restaurant or a takeaway tagged with that cuisine, so "pizza" searches both
 * categories and narrows them by the cuisine word (OSM `cuisine=*`, which is in the search text).
 */
const DISHES: Array<{ stems: string[]; cuisine: string }> = [
  { stems: ['pizza', 'pizzeria', 'πιτσα', 'πιτσαρ', 'пицц'], cuisine: 'pizza' },
  { stems: ['burger', 'hamburger', 'μπεργκερ', 'χαμπουργκερ', 'бургер', 'гамбургер'], cuisine: 'burger' },
  { stems: ['sushi', 'σουσι', 'суши'], cuisine: 'sushi' },
  { stems: ['kebab', 'κεμπαπ', 'кебаб'], cuisine: 'kebab' },
];
const DISH_CATS = ['restaurant', 'fast-food'];
/** Keywords the parser added on purpose (a dish's cuisine), as opposed to words it simply did not understand. */
export const isDishKeyword = (k: string) => DISHES.some((d) => d.cuisine === k);

const TIME_PATTERNS: Array<[WindowRe: RegExp, kind: (typeof TIME_KINDS)[number]]> = [
  [/(right now|at the moment|open now|currently|прямо сейчас|сейчас|τωρα|αυτη τη στιγμη)/, 'now'],
  [/(tonight|this evening|сегодня вечером|вечером|этим вечером|ночью|αποψε|το βραδυ)/, 'tonight'],
  [/(this weekend|weekend|на выходных|в выходные|выходные|выходных|σαββατοκυριακο|σ κ)/, 'weekend'],
  [/(day after tomorrow|послезавтра|μεθαυριο)/, 'next_7_days'],
  [/(tomorrow|завтра|αυριο)/, 'tomorrow'],
  [/(today|сегодня|σημερα)/, 'today'],
  [/(this week|на этой неделе|эту неделю|αυτη την εβδομαδα|την εβδομαδα)/, 'this_week'],
  [/(next 7 days|next week|coming days|ближайшие дни|на неделе|επομενεσ μερεσ)/, 'next_7_days'],
];

const FREE_RE = /(^|\s)(free|for free|no cost|бесплатн\S*|даром|δωρεαν|ελευθερη εισοδοσ)(\s|$)/;
const OPEN_NOW_RE = /(open now|still open|open late|открыт\S* сейчас|сейчас открыт\S*|работа\S* сейчас|ανοιχτ\S* τωρα|ανοικτ\S* τωρα)/;
const NEAR_RE = /(near me|nearby|around me|close to me|closest|nearest|рядом|поблизости|недалеко|ближайш\S*|возле меня|около меня|κοντα μου|κοντα|πλησιεστερ\S*)/;
const BEST_RE = /(^|\s)(best|top|highest rated|лучш\S*|топ|самы\S* популярн\S*|καλυτερ\S*|κορυφαι\S*)(\s|$)/;
const EVENT_RE = /(^|\s)(events?|happening|what s on|whats on|going on|мероприят\S*|событи\S*|что происходит|афиш\S*|εκδηλωσ\S*|τι γινεται|τι συμβαινει)(\s|$)/;
const PLACE_RE = /(^|\s)(places?|spots?|venues?|мест\S*|заведени\S*|μερη|μαγαζια|χωρουσ)(\s|$)/;
const RADIUS_RE = /(\d+(?:[.,]\d+)?)\s*(km|kilometers?|kilometres?|км|километр\S*|χλμ|χιλιομετρ\S*)/;
const MIN_WALK_RE = /(\d+)\s*(min|minutes?|мин\S*|λεπτ\S*)\s*(walk|on foot|пешком|ποδι|με τα ποδια)/;

const FILLER = new Set(
  [
    'where', 'what', 'which', 'find', 'show', 'me', 'can', 'i', 'do', 'to', 'the', 'a', 'an', 'is', 'are', 'there', 'any', 'some', 'good', 'great', 'nice', 'interesting', 'things', 'thing', 'something', 'with', 'for', 'in', 'on', 'at', 'of', 'and', 'or', 'it', 'play', 'plays', 'playing', 'go', 'get', 'around', 'within', 'radius', 'my', 'near', 'open', 'now', 'will', 'be', 'from',
    'где', 'что', 'какие', 'какой', 'какая', 'найди', 'найти', 'покажи', 'можно', 'мне', 'есть', 'будут', 'будет', 'проходят', 'проходит', 'играет', 'интересного', 'интересное', 'интересные', 'в', 'на', 'с', 'со', 'и', 'или', 'по', 'для', 'радиусе', 'километров', 'происходит', 'поделать', 'сделать', 'заняться', 'чем', 'куда', 'сходить', 'пойти', 'открыты', 'сейчас', 'хочу',
    'που', 'τι', 'ποια', 'ποιες', 'βρες', 'δειξε', 'μπορω', 'να', 'κανω', 'σε', 'στο', 'στη', 'στην', 'με', 'και', 'για', 'υπαρχουν', 'παιζει', 'ενδιαφερον', 'κατι', 'μου', 'κοντα', 'αποψε', 'σημερα',
    // Generic nouns that describe "something to do" rather than name it — never required words.
    'activities', 'activity', 'stuff', 'ideas', 'idea', 'options', 'option', 'recommend', 'recommendations', 'suggestions', 'suggest', 'fun', 'cool', 'list', 'all', 'please', 'want', 'need', 'looking', 'local',
    'активности', 'активность', 'занятия', 'идеи', 'варианты', 'вариант', 'посоветуй', 'подскажи', 'весь', 'все', 'всё', 'пожалуйста', 'нужен', 'нужна', 'нужно', 'ищу',
    'δραστηριοτητες', 'δραστηριοτητα', 'ιδεες', 'επιλογες', 'προτεινε', 'ολα', 'θελω', 'ψαχνω',
  ].map(norm),
);

function matchCity(nq: string, ck: string): string | null {
  let best: { slug: string; len: number } | null = null;
  for (const city of CITIES) {
    const names = [city.name.en, city.name.el ?? '', city.name.ru ?? '', ...city.aliases].filter(Boolean);
    for (const name of names) {
      const n = norm(name);
      const c = canonicalKey(name);
      // Prefix match at a word start lets "лимассоле", "λεμεσο" etc. match.
      const stem = n.length > 5 ? n.slice(0, n.length - 1) : n;
      const re = new RegExp(`(^|\\s)${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
      if (re.test(nq) || (c.length >= 4 && new RegExp(`(^|\\s)${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(ck))) {
        if (!best || n.length > best.len) best = { slug: city.slug, len: n.length };
      }
    }
  }
  return best?.slug ?? null;
}

// ── Typo correction ────────────────────────────────────────────────────────

/** Optimal string alignment distance (Levenshtein + adjacent transpositions). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
}

let VOCAB: string[] | null = null;
function vocabulary(): string[] {
  if (VOCAB) return VOCAB;
  const words = new Set<string>();
  for (const m of matchers()) for (const w of m.words) if (w.length >= 4) words.add(w);
  for (const c of CITIES) for (const n of [c.name.en, c.name.el ?? '', c.name.ru ?? '', ...c.aliases]) for (const w of norm(n).split(' ')) if (w.length >= 4) words.add(w);
  VOCAB = [...words];
  return VOCAB;
}

/** Closest vocabulary word for a misspelt token (keywords are stems, so inflected endings are tolerated). */
function correctToken(t: string): string | null {
  if (t.length < 4 || /\d/.test(t) || FILLER.has(t)) return null;
  let best: { v: string; d: number } | null = null;
  for (const v of vocabulary()) {
    if (Math.abs(t.length - v.length) > 4) continue;
    const max = v.length <= 5 ? 1 : 2;
    let d = editDistance(t, v);
    for (let len = v.length - 1; len <= v.length + 1; len++) if (len > 2 && len < t.length) d = Math.min(d, editDistance(t.slice(0, len), v));
    if (d > max || d === 0) continue;
    // Only corrections that the parser then understands (a category, group or city) are useful.
    const p = parseQuery(v);
    if (!p.categories.length && !p.groups.length && !p.city) continue;
    if (!best || d < best.d || (d === best.d && v.length > best.v.length)) best = { v, d };
  }
  return best?.v ?? null;
}

/**
 * "Did you mean": the query with misspelt words replaced by the closest category, synonym or city word
 * (e.g. "resturants" → "restaurant", "рестараны" → "ресторан"). Only words the parser could not place are
 * corrected. Returns null when nothing needed fixing.
 */
export function correctQuery(query: string): string | null {
  const leftovers = new Set(parseQuery(query).keywords);
  if (!leftovers.size) return null;
  let changed = false;
  const out = norm(query).split(' ').filter(Boolean).map((t) => {
    if (!leftovers.has(t)) return t;
    const c = correctToken(t);
    if (c) { changed = true; return c; }
    return t;
  });
  return changed ? out.join(' ') : null;
}

/**
 * Deterministic multilingual (en/el/ru) query understanding. Used when no AI key is configured,
 * when the AI call fails, and to merge with/validate AI output.
 */
export function parseQuery(query: string): SearchFilters {
  const nq = norm(query);
  const ck = canonicalKey(query);
  const filters: SearchFilters = SearchFiltersSchema.parse({});

  for (const [re, kind] of TIME_PATTERNS) {
    if (re.test(nq)) {
      filters.time = kind;
      break;
    }
  }
  filters.freeOnly = FREE_RE.test(nq);
  filters.openNow = OPEN_NOW_RE.test(nq);
  if (filters.openNow && !filters.time) filters.time = 'now';
  filters.nearMe = NEAR_RE.test(nq);
  if (BEST_RE.test(nq)) filters.sort = 'rating';
  const r = nq.match(RADIUS_RE);
  if (r) {
    filters.radiusKm = Math.min(100, Math.max(0.5, Number(r[1]!.replace(',', '.'))));
    filters.nearMe = true;
  }
  const w = nq.match(MIN_WALK_RE);
  if (w) {
    filters.radiusKm = Math.max(0.5, Math.round((Number(w[1]) / 60) * 4.5 * 10) / 10);
    filters.nearMe = true;
  }
  if (filters.nearMe && filters.sort === 'relevance') filters.sort = 'distance';
  filters.city = matchCity(nq, ck);

  // Category & group keywords, longest phrase first, each token consumed once.
  const toks = nq.split(' ').filter(Boolean);
  const consumed = new Array(toks.length).fill(false);
  const cats = new Set<string>();
  const groups = new Set<InterestGroup>();
  const dishWords: string[] = [];
  toks.forEach((tok, i) => {
    const d = DISHES.find((x) => x.stems.some((st) => tok === st || (st.length >= 4 && tok.startsWith(st))));
    if (!d) return;
    consumed[i] = true;
    for (const c of DISH_CATS) cats.add(c);
    if (!dishWords.includes(d.cuisine)) dishWords.push(d.cuisine);
  });
  for (const m of matchers()) {
    for (let i = 0; i + m.words.length <= toks.length; i++) {
      let ok = true;
      for (let j = 0; j < m.words.length; j++) {
        const tok = toks[i + j]!;
        const kw = m.words[j]!;
        if (consumed[i + j] || !(tok === kw || (kw.length >= 3 && tok.startsWith(kw)) || (kw.length < 3 && tok === kw))) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (let j = 0; j < m.words.length; j++) consumed[i + j] = true;
      if (m.target.kind === 'category') cats.add(m.target.slug);
      else groups.add(m.target.group);
    }
  }
  filters.categories = [...cats];
  filters.groups = [...groups];

  if (EVENT_RE.test(nq)) filters.entityTypes = ['event'];
  else if (PLACE_RE.test(nq)) filters.entityTypes = ['place'];

  // Remaining meaningful words become full-text keywords (e.g. a band or venue name).
  const cityWords = filters.city ? new Set(norm([CITIES.find((c) => c.slug === filters.city)!.name.en, ...CITIES.find((c) => c.slug === filters.city)!.aliases].join(' ')).split(' ')) : new Set<string>();
  const leftovers = toks.filter((t, i) => !consumed[i] && !FILLER.has(t) && t.length > 2 && !/^\d+$/.test(t) && !cityWords.has(t)
    && !TIME_PATTERNS.some(([re]) => re.test(t)) && !FREE_RE.test(t) && !NEAR_RE.test(t) && !EVENT_RE.test(t) && !PLACE_RE.test(t) && !BEST_RE.test(t) && !RADIUS_RE.test(t)
    && !(filters.city && matchCity(t, canonicalKey(t)) === filters.city));
  filters.keywords = [...dishWords, ...leftovers.map((k) => k.slice(0, 40))].slice(0, 8);
  return filters;
}

/** Merge AI-proposed filters with deterministic ones; deterministic hard signals win. */
export function mergeFilters(ai: SearchFilters, rules: SearchFilters): SearchFilters {
  return SearchFiltersSchema.parse({
    categories: [...new Set([...rules.categories, ...ai.categories])].slice(0, 12),
    groups: [...new Set([...rules.groups, ...ai.groups])].slice(0, 6),
    entityTypes: rules.entityTypes.length ? rules.entityTypes : ai.entityTypes,
    time: rules.time ?? ai.time,
    city: rules.city ?? ai.city,
    radiusKm: rules.radiusKm ?? ai.radiusKm,
    nearMe: rules.nearMe || ai.nearMe,
    freeOnly: rules.freeOnly || ai.freeOnly,
    openNow: rules.openNow || ai.openNow,
    sort: rules.sort !== 'relevance' ? rules.sort : ai.sort,
    keywords: ai.keywords.length ? ai.keywords : rules.keywords,
  });
}

export function describeLocaleHint(locale: Locale): string {
  return { en: 'English', el: 'Greek', ru: 'Russian' }[locale];
}
