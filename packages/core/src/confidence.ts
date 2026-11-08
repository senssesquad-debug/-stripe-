import { haversineKm, type LatLng } from './geo';
import { normalizeText } from './text';

/** Default authority by source type. A specific source can override this in the `sources` table. */
export const SOURCE_AUTHORITY = {
  organizer_verified: 1.0, // organizer confirmed through their passtra account
  official_venue: 0.95, // the venue's/organizer's own site or feed
  government: 0.9, // tourism board, municipality, ministry
  ticketing: 0.85, // official ticketing platform for the event
  aggregator_api: 0.75, // Ticketmaster, Eventbrite, PredictHQ …
  open_data: 0.7, // OSM, Wikidata
  editorial: 0.65, // curated listings / press
  user_report: 0.3, // unverified user submissions
} as const;

export const VERIFICATION_STATUSES = ['confirmed', 'likely', 'unverified', 'conflicting'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Fields whose disagreement makes an event "conflicting". */
export const CRITICAL_EVENT_FIELDS = ['starts_at', 'ends_at', 'local_start_date', 'location', 'venue_name', 'status'] as const;

export interface SourceEvidence {
  sourceId: number;
  authority: number; // 0..1
  isOfficial: boolean;
  lastSeenAt: Date;
}

export interface ConfidenceInput {
  sources: SourceEvidence[];
  /** Number of distinct sources agreeing on date/time/place (≥1 when there is any source). */
  agreementCount: number;
  hasOfficialPage: boolean;
  organizerConfirmed: boolean;
  openConflicts: Array<{ field: string; critical: boolean }>;
  /** Event start; places pass undefined. */
  startsAt?: Date;
  now: Date;
}

export interface ConfidenceResult {
  score: number; // 0..100
  status: VerificationStatus;
  factors: { authority: number; freshness: number; official: number; agreement: number; organizer: number; conflictPenalty: number };
}

/**
 * Freshness 0..1 with exponential decay. The half-life shrinks as the event approaches:
 * one-week-old data is fine for an event in two months, stale for an event tomorrow.
 */
export function freshness(lastVerifiedAt: Date, now: Date, startsAt?: Date): number {
  const ageH = Math.max(0, (now.getTime() - lastVerifiedAt.getTime()) / 3_600_000);
  let halfLifeH: number;
  if (startsAt) {
    const untilH = (startsAt.getTime() - now.getTime()) / 3_600_000;
    halfLifeH = Math.min(14 * 24, Math.max(6, untilH / 4));
  } else {
    halfLifeH = 60 * 24; // places change slowly
  }
  return Math.pow(0.5, ageH / halfLifeH);
}

export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  if (input.sources.length === 0) {
    return { score: 0, status: 'unverified', factors: { authority: 0, freshness: 0, official: 0, agreement: 0, organizer: 0, conflictPenalty: 0 } };
  }
  const authority = Math.max(...input.sources.map((s) => s.authority));
  const latest = new Date(Math.max(...input.sources.map((s) => s.lastSeenAt.getTime())));
  const fresh = freshness(latest, input.now, input.startsAt);
  const official = input.hasOfficialPage || input.sources.some((s) => s.isOfficial) ? 1 : 0;
  const agreement = input.agreementCount >= 3 ? 1 : input.agreementCount === 2 ? 0.7 : 0.3;
  const organizer = input.organizerConfirmed ? 1 : 0;
  const criticalConflicts = input.openConflicts.filter((c) => c.critical).length;
  const minorConflicts = input.openConflicts.length - criticalConflicts;
  const conflictPenalty = Math.min(40, criticalConflicts * 25 + minorConflicts * 5);

  const raw = 100 * (0.35 * authority + 0.2 * fresh + 0.1 * official + 0.15 * agreement + 0.2 * organizer) - conflictPenalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  let status: VerificationStatus;
  if (criticalConflicts > 0) status = 'conflicting';
  else if (score >= 62 && (authority >= 0.85 || input.agreementCount >= 2 || input.organizerConfirmed) && fresh >= 0.5) status = 'confirmed';
  else if (score >= 45) status = 'likely';
  else status = 'unverified';

  return { score, status, factors: { authority, freshness: fresh, official, agreement, organizer, conflictPenalty } };
}

// ── Field resolution ────────────────────────────────────────────────────────

export interface FieldObservation<T = unknown> {
  sourceId: number;
  sourceKey: string;
  authority: number;
  value: T;
  lastSeenAt: Date;
}

export type ResolutionDecision = 'single' | 'unanimous' | 'authority' | 'conflict';

export interface FieldResolution<T = unknown> {
  value: T | null;
  sourceId: number | null;
  decision: ResolutionDecision;
  agreeingSources: number;
  candidates: Array<{ value: T; sourceIds: number[]; authority: number }>;
}

/** Minimum authority gap for the most authoritative source to win a disagreement automatically. */
export const AUTHORITY_GAP = 0.15;

function isLatLng(v: unknown): v is LatLng {
  return typeof v === 'object' && v !== null && typeof (v as LatLng).lat === 'number' && typeof (v as LatLng).lng === 'number';
}

/** Field-aware equality: instants to the minute, locations within 150 m, text after normalisation. */
export function valuesEqual(field: string, a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (isLatLng(a) && isLatLng(b)) return haversineKm(a, b) <= 0.15;
  const asTime = (v: unknown) => (v instanceof Date ? v.getTime() : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? Date.parse(v) : NaN);
  const ta = asTime(a);
  const tb = asTime(b);
  if (!Number.isNaN(ta) && !Number.isNaN(tb)) return Math.abs(ta - tb) < 60_000;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.005;
  if (typeof a === 'string' && typeof b === 'string') {
    if (field === 'website' || field === 'ticket_url' || field === 'url') {
      const u = (s: string) => s.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '').toLowerCase();
      return u(a) === u(b);
    }
    return normalizeText(a) === normalizeText(b);
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Pick the value of a field from several sources, deterministically:
 *  1. one source → its value
 *  2. all agree → that value
 *  3. disagree and the strongest group out-ranks the next by ≥ AUTHORITY_GAP → strongest wins ("authority")
 *  4. otherwise → "conflict": the value of the strongest group is kept for display,
 *     but callers must flag the field as unconfirmed. Ties are broken by source id, never randomly.
 */
export function resolveField<T>(field: string, observations: FieldObservation<T>[]): FieldResolution<T> {
  const obs = observations.filter((o) => o.value !== null && o.value !== undefined);
  if (obs.length === 0) return { value: null, sourceId: null, decision: 'single', agreeingSources: 0, candidates: [] };

  const groups: Array<{ value: T; sourceIds: number[]; authority: number; lastSeen: number }> = [];
  for (const o of [...obs].sort((x, y) => x.sourceId - y.sourceId)) {
    const g = groups.find((gr) => valuesEqual(field, gr.value, o.value));
    if (g) {
      g.sourceIds.push(o.sourceId);
      g.authority = Math.max(g.authority, o.authority);
      g.lastSeen = Math.max(g.lastSeen, o.lastSeenAt.getTime());
    } else {
      groups.push({ value: o.value, sourceIds: [o.sourceId], authority: o.authority, lastSeen: o.lastSeenAt.getTime() });
    }
  }
  groups.sort((a, b) => b.authority - a.authority || b.sourceIds.length - a.sourceIds.length || a.sourceIds[0]! - b.sourceIds[0]!);
  const candidates = groups.map(({ value, sourceIds, authority }) => ({ value, sourceIds, authority }));
  const top = groups[0]!;
  const topSource = obs.filter((o) => top.sourceIds.includes(o.sourceId)).sort((a, b) => b.authority - a.authority || a.sourceId - b.sourceId)[0]!;

  if (groups.length === 1) {
    return { value: top.value, sourceId: topSource.sourceId, decision: obs.length === 1 ? 'single' : 'unanimous', agreeingSources: top.sourceIds.length, candidates };
  }
  const second = groups[1]!;
  const decision: ResolutionDecision = top.authority - second.authority >= AUTHORITY_GAP ? 'authority' : 'conflict';
  return { value: top.value, sourceId: topSource.sourceId, decision, agreeingSources: top.sourceIds.length, candidates };
}
