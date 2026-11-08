import { getCategory, groupOf, type DayPart, type InterestGroup } from './categories';
import type { Locale } from './locales';
import { dayPartOf, localDate } from './time';

export type EntityType = 'event' | 'place';

export interface Candidate {
  id: string;
  type: EntityType;
  categories: string[];
  distanceKm?: number | null;
  /** passtra users' rating (Google ratings are never stored — see docs/01-research.md). */
  rating?: number | null;
  ratingCount?: number | null;
  popularity?: number | null; // 0..1 normalised internal signal
  isFree?: boolean | null;
  priceMin?: number | null;
  priceLevel?: number | null; // 1..4
  startsAt?: Date | null;
  timePrecision?: 'exact' | 'date_only';
  timezone?: string;
  openNow?: boolean | null;
  ageMin?: number | null;
  verificationStatus?: 'confirmed' | 'likely' | 'unverified' | 'conflicting';
}

export type Budget = 'free' | 'low' | 'medium' | 'high';
export type AgeRange = 'under_18' | '18_24' | '25_34' | '35_44' | '45_54' | '55_plus';

export interface UserProfile {
  interests: InterestGroup[];
  /** Implicit category affinity in [-1, 1] learned from interactions. */
  affinity: Record<string, number>;
  budget?: Budget | null;
  ageRange?: AgeRange | null;
  dismissed?: ReadonlySet<string>;
  saved?: ReadonlySet<string>;
}

export interface RankContext {
  now: Date;
  tz: string;
  radiusKm: number;
}

export type ReasonCode =
  | 'interest' | 'affinity' | 'nearby' | 'today' | 'tonight' | 'starts_soon' | 'open_now'
  | 'highly_rated' | 'popular' | 'free' | 'fits_budget' | 'good_time_of_day' | 'verified';

export interface Reason {
  code: ReasonCode;
  weight: number;
  params?: Record<string, string | number>;
}

export interface Scored<C extends Candidate = Candidate> {
  item: C;
  score: number;
  reasons: Reason[];
}

/** Bayesian-smoothed rating so 5.0 from 2 votes doesn't beat 4.7 from 400. */
export function bayesianRating(avg: number | null | undefined, count: number | null | undefined, prior = 4.0, m = 15): number | null {
  if (avg === null || avg === undefined || !count) return null;
  return (prior * m + avg * count) / (m + count);
}

const AGE_YEARS: Record<AgeRange, number> = { under_18: 16, '18_24': 21, '25_34': 30, '35_44': 40, '45_54': 50, '55_plus': 60 };

/** Hard filters: things that must never be recommended to this user. */
export function isEligible(c: Candidate, profile: UserProfile): boolean {
  if (profile.dismissed?.has(c.id)) return false;
  if (c.verificationStatus === 'conflicting') return false; // shown in search with a warning, never pushed as a recommendation
  if (c.ageMin && profile.ageRange && AGE_YEARS[profile.ageRange] < c.ageMin) return false;
  if (profile.ageRange === 'under_18' && c.categories.some((s) => (getCategory(s)?.ageMin ?? 0) >= 18)) return false;
  return true;
}

export function scoreCandidate(c: Candidate, profile: UserProfile, ctx: RankContext): Scored {
  const reasons: Reason[] = [];
  const add = (code: ReasonCode, weight: number, params?: Reason['params']) => {
    if (weight !== 0) reasons.push({ code, weight, params });
  };

  // 1. Interests (explicit) and affinity (implicit)
  const groups = new Set(c.categories.map(groupOf).filter((g): g is InterestGroup => !!g));
  const matchedInterest = profile.interests.find((i) => groups.has(i));
  if (matchedInterest) add('interest', 0.3, { group: matchedInterest });
  const aff = Math.max(...c.categories.map((s) => profile.affinity[s] ?? 0), -1);
  if (aff > 0.05) add('affinity', 0.25 * aff, { category: c.categories.find((s) => (profile.affinity[s] ?? 0) === aff) ?? c.categories[0]! });
  else if (aff < -0.05) add('affinity', 0.3 * aff);

  // 2. Distance (smooth decay relative to the chosen radius)
  if (c.distanceKm !== null && c.distanceKm !== undefined) {
    const rel = c.distanceKm / Math.max(1, ctx.radiusKm);
    const w = 0.2 * Math.exp(-2.2 * rel);
    add('nearby', w, { km: Math.round(c.distanceKm * 10) / 10 });
  }

  // 3. Time relevance
  if (c.type === 'event' && c.startsAt) {
    const tz = c.timezone ?? ctx.tz;
    const hoursUntil = (c.startsAt.getTime() - ctx.now.getTime()) / 3_600_000;
    if (c.timePrecision === 'exact' && hoursUntil >= -0.5 && hoursUntil <= 3) add('starts_soon', 0.2, { minutes: Math.max(0, Math.round(hoursUntil * 60)) });
    else if (localDate(c.startsAt, tz) === localDate(ctx.now, tz)) {
      const part = c.timePrecision === 'exact' ? dayPartOf(c.startsAt, tz) : null;
      add(part === 'evening' || part === 'night' ? 'tonight' : 'today', 0.15);
    } else if (hoursUntil > 0) add('today', 0.1 * Math.exp(-hoursUntil / 96)); // soon-ish
  }
  if (c.type === 'place') {
    if (c.openNow === true) add('open_now', 0.1);
    if (c.openNow === false) add('open_now', -0.25);
    const part: DayPart = dayPartOf(ctx.now, ctx.tz);
    const fits = c.categories.some((s) => getCategory(s)?.dayParts?.includes(part));
    const hasParts = c.categories.some((s) => getCategory(s)?.dayParts);
    if (fits) add('good_time_of_day', 0.08);
    else if (hasParts) add('good_time_of_day', -0.08);
  }

  // 4. Quality & popularity
  const br = bayesianRating(c.rating, c.ratingCount);
  if (br !== null && br >= 4.2) add('highly_rated', 0.15 * ((br - 4.0) / 1.0), { rating: Math.round((c.rating ?? 0) * 10) / 10 });
  if (c.popularity && c.popularity > 0.1) add('popular', 0.1 * Math.min(1, c.popularity));
  if (c.verificationStatus === 'confirmed') add('verified', 0.05);
  if (c.verificationStatus === 'unverified') add('verified', -0.08);

  // 5. Budget
  if (c.isFree) add('free', profile.budget === 'free' ? 0.25 : 0.05);
  else if (profile.budget) {
    const price = c.priceMin ?? (c.priceLevel ? [0, 10, 25, 50, 90][c.priceLevel] : null);
    if (price !== null && price !== undefined) {
      const limit = { free: 0, low: 15, medium: 40, high: Infinity }[profile.budget];
      add('fits_budget', price <= limit ? 0.08 : -0.2);
    }
  }

  if (profile.saved?.has(c.id)) add('affinity', -0.05); // already saved: don't keep pushing it

  const score = reasons.reduce((s, r) => s + r.weight, 0);
  return { item: c, score: Math.round(score * 10000) / 10000, reasons: reasons.sort((a, b) => b.weight - a.weight) };
}

/**
 * Maximal-marginal-relevance re-ranking: penalise items whose interest group already
 * appears above them, so the feed isn't ten bars in a row.
 */
export function diversify<C extends Candidate>(scored: Scored<C>[], limit: number, lambda = 0.2): Scored<C>[] {
  const pool = [...scored].sort((a, b) => b.score - a.score);
  const out: Scored<C>[] = [];
  const groupCount = new Map<string, number>();
  while (out.length < limit && pool.length) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const g = groupOf(pool[i]!.item.categories[0] ?? '') ?? 'other';
      const val = pool[i]!.score - lambda * (groupCount.get(g) ?? 0);
      if (val > bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    }
    const [picked] = pool.splice(bestIdx, 1);
    const g = groupOf(picked!.item.categories[0] ?? '') ?? 'other';
    groupCount.set(g, (groupCount.get(g) ?? 0) + 1);
    out.push(picked!);
  }
  return out;
}

export function rank<C extends Candidate>(candidates: C[], profile: UserProfile, ctx: RankContext, limit = 20): Scored<C>[] {
  const scored = candidates.filter((c) => isEligible(c, profile)).map((c) => scoreCandidate(c, profile, ctx) as Scored<C>);
  return diversify(scored, limit);
}

/**
 * "Surprise me": weighted random sampling from the top of the ranking with forced group diversity.
 * `random` is injectable for deterministic tests.
 */
export function surprise<C extends Candidate>(candidates: C[], profile: UserProfile, ctx: RankContext, count = 4, random: () => number = Math.random): Scored<C>[] {
  const top = rank(candidates, profile, ctx, 30);
  const picked: Scored<C>[] = [];
  const usedGroups = new Set<string>();
  const pool = [...top];
  while (picked.length < count && pool.length) {
    const minScore = Math.min(...pool.map((p) => p.score));
    const weights = pool.map((p) => {
      const g = groupOf(p.item.categories[0] ?? '') ?? 'other';
      return (p.score - minScore + 0.05) * (usedGroups.has(g) ? 0.2 : 1);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = random() * total;
    let idx = 0;
    for (; idx < weights.length - 1; idx++) {
      r -= weights[idx]!;
      if (r <= 0) break;
    }
    const [p] = pool.splice(idx, 1);
    usedGroups.add(groupOf(p!.item.categories[0] ?? '') ?? 'other');
    picked.push(p!);
  }
  return picked;
}

// ── Learning from interactions ─────────────────────────────────────────────

export type InteractionKind = 'view' | 'open' | 'save' | 'unsave' | 'share' | 'dismiss' | 'hide' | 'click_ticket' | 'navigate';

export const INTERACTION_WEIGHTS: Record<InteractionKind, number> = {
  view: 0.1, open: 1, save: 3, unsave: -1.5, share: 2, click_ticket: 3, navigate: 2, dismiss: -2, hide: -4,
};

/** Category affinity in [-1, 1] with a 14-day half-life. */
export function buildAffinity(
  interactions: Array<{ kind: InteractionKind; categories: string[]; at: Date }>,
  now: Date,
  halfLifeDays = 14,
): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const it of interactions) {
    const ageDays = Math.max(0, (now.getTime() - it.at.getTime()) / 86_400_000);
    const w = INTERACTION_WEIGHTS[it.kind] * Math.pow(0.5, ageDays / halfLifeDays);
    for (const cat of it.categories) raw[cat] = (raw[cat] ?? 0) + w;
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Math.tanh(v / 6);
  return out;
}

// ── Explanations (from real reasons only) ─────────────────────────────────

const T: Record<string, Record<Locale, string>> = {
  interest: { en: 'You’re into {group}', el: 'Σας ενδιαφέρει: {group}', ru: 'Вы интересуетесь: {group}' },
  affinity: { en: 'Similar to places you liked', el: 'Παρόμοιο με ό,τι σας άρεσε', ru: 'Похоже на то, что вам понравилось' },
  nearby: { en: '{km} km away', el: '{km} χλμ μακριά', ru: '{km} км от вас' },
  today: { en: 'Happening soon', el: 'Σύντομα', ru: 'Скоро' },
  tonight: { en: 'Tonight', el: 'Απόψε', ru: 'Сегодня вечером' },
  starts_soon: { en: 'Starts in {minutes} min', el: 'Ξεκινά σε {minutes} λεπτά', ru: 'Начало через {minutes} мин' },
  open_now: { en: 'Open now', el: 'Ανοιχτό τώρα', ru: 'Открыто сейчас' },
  highly_rated: { en: 'Rated {rating}', el: 'Βαθμολογία {rating}', ru: 'Рейтинг {rating}' },
  popular: { en: 'Popular right now', el: 'Δημοφιλές τώρα', ru: 'Популярно сейчас' },
  free: { en: 'Free', el: 'Δωρεάν', ru: 'Бесплатно' },
  fits_budget: { en: 'Fits your budget', el: 'Εντός προϋπολογισμού', ru: 'В рамках бюджета' },
  good_time_of_day: { en: 'Good for this time of day', el: 'Ιδανικό για αυτή την ώρα', ru: 'Подходит для этого времени' },
  verified: { en: 'Verified info', el: 'Επιβεβαιωμένα στοιχεία', ru: 'Проверенные данные' },
};

/** Build "You're into Music · 4 km away · Tonight" from the positive reasons. */
export function explain(reasons: Reason[], locale: Locale, groupLabel: (g: string) => string, max = 3): string {
  const seen = new Set<ReasonCode>();
  const parts: string[] = [];
  for (const r of reasons) {
    if (r.weight <= 0 || seen.has(r.code) || !T[r.code]) continue;
    seen.add(r.code);
    let s = T[r.code]![locale];
    for (const [k, v] of Object.entries(r.params ?? {})) s = s.replace(`{${k}}`, k === 'group' ? groupLabel(String(v)) : String(v));
    if (s.includes('{')) continue;
    parts.push(s);
    if (parts.length >= max) break;
  }
  return parts.join(' · ');
}
