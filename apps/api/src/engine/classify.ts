import { CITIES, canonicalKey, getCategory, haversineKm, normalizeText, parseQuery, type CityDef, type InterestGroup } from '@passtra/core';

const CANCELLED = /(^|\s)(cancelled|canceled|cancellation|ακυρων\S*|ακυρωσ\S*|ακυρωθηκ\S*|отмен\S*)(\s|$)/;
const POSTPONED = /(^|\s)(postponed|rescheduled to|new date|αναβαλλ\S*|αναβολ\S*|αναβληθηκ\S*|перенес\S*|перенос\S*)(\s|$)/;

/** Cancellation/postponement only from explicit wording; never inferred from absence. */
export function detectStatus(...texts: Array<string | null | undefined>): 'cancelled' | 'postponed' | null {
  const t = normalizeText(texts.filter(Boolean).join(' '));
  if (CANCELLED.test(t)) return 'cancelled';
  if (POSTPONED.test(t)) return 'postponed';
  return null;
}

const GROUP_DEFAULT_EVENT: Record<InterestGroup, string> = {
  music: 'concert', nightlife: 'party', food: 'food-festival', shopping: 'fair', sports: 'sports-event',
  nature: 'community-event', culture: 'community-event', family: 'kids-event', adventure: 'sports-event',
  technology: 'tech-meetup', art: 'exhibition', wellness: 'wellness-event', practical: 'community-event',
};

/** Deterministic event classification from title + source labels (no AI, no invention). */
export function classifyEvent(title: string, labels: string[], hinted: string[] = []): { primary: string; categories: string[] } {
  const f = parseQuery(`${labels.join(' . ')} . ${title}`);
  const all = [...new Set([...hinted.filter((s) => getCategory(s)), ...f.categories])];
  const eventCats = all.filter((s) => {
    const k = getCategory(s)?.kind;
    return k === 'event' || k === 'both';
  });
  let primary = eventCats[0];
  if (!primary) {
    const group = f.groups[0] ?? (all[0] ? getCategory(all[0])?.group : undefined);
    primary = group ? GROUP_DEFAULT_EVENT[group] : 'community-event';
  }
  return { primary, categories: [...new Set([primary, ...all])] };
}

export function primaryPlaceCategory(categories: string[]): string | null {
  return categories.find((s) => {
    const k = getCategory(s)?.kind;
    return k === 'place' || k === 'both';
  }) ?? null;
}

/** Match a free-text city hint ("Lefkosia", "Pano Lefkara", "Λεμεσός") to a known city. */
export function cityFromHint(hint: string | null | undefined): CityDef | null {
  if (!hint) return null;
  const key = canonicalKey(hint);
  if (!key) return null;
  let best: { city: CityDef; len: number } | null = null;
  for (const c of CITIES) {
    for (const n of [c.name.en, c.name.el ?? '', c.name.ru ?? '', c.slug.replace('-', ' '), ...c.aliases]) {
      const nk = canonicalKey(n);
      if (!nk) continue;
      if (key === nk || key.startsWith(`${nk} `) || key.endsWith(` ${nk}`) || key.includes(` ${nk} `)) {
        if (!best || nk.length > best.len) best = { city: c, len: nk.length };
      }
    }
  }
  return best?.city ?? null;
}

/** Nearest known city whose area contains the point (with tolerance). */
export function cityFromLocation(lat: number, lng: number): CityDef | null {
  let best: { city: CityDef; km: number } | null = null;
  for (const c of CITIES) {
    const km = haversineKm({ lat, lng }, c);
    if (km <= Math.max(c.radiusKm * 1.5, 6) && (!best || km / c.radiusKm < best.km / best.city.radiusKm)) best = { city: c, km };
  }
  return best?.city ?? null;
}
