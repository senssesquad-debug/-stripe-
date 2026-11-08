import { haversineKm, type LatLng } from './geo';
import { nameSimilarity, canonicalKey } from './text';

export const EVENT_AUTO_MERGE = 0.8;
export const EVENT_REVIEW = 0.6;
export const PLACE_AUTO_MERGE = 0.82;
export const PLACE_REVIEW = 0.62;

export interface EventLike {
  title: string;
  startsAt: Date;
  timePrecision: 'exact' | 'date_only';
  localStartDate: string; // YYYY-MM-DD in the event zone
  location?: LatLng | null;
  locationPrecision?: 'exact' | 'approximate' | 'city' | 'unknown';
  venueName?: string | null;
  citySlug?: string | null;
}

export interface MatchResult {
  score: number;
  reasons: string[];
}

function dayDiff(a: string, b: string): number {
  return Math.round(Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

/** How likely two event records describe the same occurrence (0..1). */
export function eventMatchScore(a: EventLike, b: EventLike): MatchResult {
  const reasons: string[] = [];
  const days = dayDiff(a.localStartDate, b.localStartDate);
  if (days > 1) return { score: 0, reasons: ['different_dates'] };

  // Time
  let timeScore: number;
  if (a.timePrecision === 'exact' && b.timePrecision === 'exact') {
    const mins = Math.abs(a.startsAt.getTime() - b.startsAt.getTime()) / 60_000;
    timeScore = mins < 1 ? 1 : mins <= 30 ? 0.85 : mins <= 120 ? 0.6 : days === 0 ? 0.4 : 0.1;
    reasons.push(mins < 1 ? 'same_time' : `time_diff_${Math.round(mins)}m`);
  } else {
    timeScore = days === 0 ? 0.85 : 0.2;
    reasons.push(days === 0 ? 'same_date' : 'adjacent_date');
  }

  // Place
  let placeScore = 0.3; // unknown on one side: neutral-ish
  const venueSim = a.venueName && b.venueName ? nameSimilarity(a.venueName, b.venueName) : 0;
  const precise = (e: EventLike) => e.location && (e.locationPrecision === 'exact' || e.locationPrecision === 'approximate' || e.locationPrecision === undefined);
  if (precise(a) && precise(b)) {
    const km = haversineKm(a.location!, b.location!);
    placeScore = km <= 0.15 ? 1 : km <= 0.5 ? 0.8 : km <= 2 ? 0.5 : km <= 5 ? 0.2 : 0;
    reasons.push(`distance_${km.toFixed(2)}km`);
    if (km > 5 && venueSim < 0.6) {
      return { score: 0, reasons: [...reasons, 'far_apart'] };
    }
  } else if (a.citySlug && b.citySlug) {
    placeScore = a.citySlug === b.citySlug ? 0.45 : 0.05;
    reasons.push(a.citySlug === b.citySlug ? 'same_city' : 'different_city');
  }
  if (venueSim >= 0.7) {
    placeScore = Math.max(placeScore, 0.9);
    reasons.push('same_venue_name');
  }

  const titleSim = nameSimilarity(a.title, b.title);
  reasons.push(`title_${titleSim.toFixed(2)}`);
  if (titleSim < 0.3) return { score: Math.min(0.3, titleSim), reasons: [...reasons, 'different_titles'] };

  const score = 0.5 * titleSim + 0.25 * timeScore + 0.25 * placeScore;
  return { score: Math.round(score * 1000) / 1000, reasons };
}

export interface PlaceLike {
  name: string;
  location: LatLng;
  externalIds?: Record<string, string>;
  website?: string | null;
  phone?: string | null;
  primaryCategory?: string;
}

const digits = (p?: string | null) => (p ? p.replace(/\D/g, '').replace(/^00357|^357/, '') : '');
/** Hostname without "www." (regex-based so core stays free of runtime-specific globals). */
const host = (u?: string | null) => {
  if (!u) return '';
  const m = u.trim().toLowerCase().match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/]*@)?([^/:?#]+)/);
  return m ? m[1]!.replace(/^www\./, '') : '';
};

/** How likely two place records are the same physical place (0..1). */
export function placeMatchScore(a: PlaceLike, b: PlaceLike): MatchResult {
  const reasons: string[] = [];
  for (const [k, v] of Object.entries(a.externalIds ?? {})) {
    const other = b.externalIds?.[k];
    if (other !== undefined) {
      if (other === v) return { score: 1, reasons: [`same_${k}_id`] };
      // Same provider, different IDs → different places (unless the provider has duplicates; leave to review).
      if (k === 'osm' || k === 'google') return { score: 0, reasons: [`different_${k}_id`] };
    }
  }
  const km = haversineKm(a.location, b.location);
  const sameSite = host(a.website) !== '' && host(a.website) === host(b.website);
  const samePhone = digits(a.phone).length >= 8 && digits(a.phone) === digits(b.phone);
  if (km > 0.3 && !sameSite && !samePhone) return { score: 0, reasons: [`distance_${km.toFixed(2)}km`] };

  const nameSim = canonicalKey(a.name) === canonicalKey(b.name) ? 1 : nameSimilarity(a.name, b.name);
  reasons.push(`name_${nameSim.toFixed(2)}`, `distance_${Math.round(km * 1000)}m`);
  const distScore = km <= 0.025 ? 1 : km <= 0.075 ? 0.85 : km <= 0.15 ? 0.6 : 0.3;
  let score = 0.6 * nameSim + 0.4 * distScore;
  if (sameSite) {
    score = Math.min(1, score + 0.15);
    reasons.push('same_website');
  }
  if (samePhone) {
    score = Math.min(1, score + 0.15);
    reasons.push('same_phone');
  }
  if (a.primaryCategory && b.primaryCategory && a.primaryCategory !== b.primaryCategory && nameSim < 0.9) {
    score *= 0.85;
    reasons.push('different_category');
  }
  return { score: Math.round(score * 1000) / 1000, reasons };
}
