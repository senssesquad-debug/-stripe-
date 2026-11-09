import type { VerificationStatus } from './confidence';
import type { SearchFilters } from './query-parser';

/** Shared API contract between apps/api and apps/mobile / apps/admin. */

export type LocationPrecision = 'exact' | 'approximate' | 'city' | 'unknown';
export type EventStatus = 'scheduled' | 'cancelled' | 'postponed' | 'rescheduled' | 'unlisted' | 'completed';
export type PlaceStatus = 'active' | 'temporarily_closed' | 'permanently_closed' | 'unverified' | 'hidden';

export interface ImageDTO {
  url: string;
  attribution?: string | null;
  license?: string | null;
  source?: string | null;
  /** "current" photos show the place as it looks today; "historical" ones are kept in a separate gallery. */
  kind?: 'current' | 'historical';
  /** Year the photo was taken, when the file metadata states it. */
  year?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface SourceRefDTO {
  key: string;
  name: string;
  url: string | null;
  isOfficial: boolean;
  attribution: string | null;
  lastSeenAt: string;
}

export interface ConflictDTO {
  field: string;
  status: 'open' | 'auto_resolved';
  candidates: Array<{ value: unknown; display: string; sources: string[] }>;
}

export interface VerificationDTO {
  status: VerificationStatus;
  confidence: number;
  lastVerifiedAt: string | null;
  sources: SourceRefDTO[];
  conflicts: ConflictDTO[];
}

export interface CategoryRefDTO {
  slug: string;
  label: string;
  group: string;
  icon: string;
}

export interface CityRefDTO {
  slug: string;
  name: string;
}

export interface EventTimeDTO {
  startsAt: string; // ISO with offset in the event zone
  endsAt: string | null;
  timezone: string;
  precision: 'exact' | 'date_only';
  localStartDate: string;
  localEndDate: string | null;
  label: string; // e.g. "Today · 20:30–22:00"
  happeningNow: boolean;
  /** Present when sources disagree on the time — the UI must say "time unconfirmed". */
  unconfirmed: boolean;
}

export interface PriceDTO {
  isFree: boolean | null;
  min: number | null;
  max: number | null;
  currency: string | null;
  text: string | null;
  label: string | null;
}

export interface EventDTO {
  type: 'event';
  id: string;
  title: string;
  description: string | null;
  category: CategoryRefDTO;
  categories: string[];
  venue: { name: string | null; address: string | null; placeId: string | null };
  location: { lat: number; lng: number; precision: LocationPrecision } | null;
  city: CityRefDTO | null;
  time: EventTimeDTO;
  price: PriceDTO;
  ticketUrl: string | null;
  website: string | null;
  organizer: string | null;
  ageMin: number | null;
  status: EventStatus;
  images: ImageDTO[];
  distanceKm: number | null;
  verification: VerificationDTO;
  sponsored: false;
  isDemo: boolean;
}

export interface OpeningHoursDTO {
  openNow: boolean | null;
  /** e.g. "Closes 23:00", "Opens 09:00", "Open 24 hours" */
  label: string | null;
  raw: string | null;
  weekText: string[] | null;
}

export interface PlaceDTO {
  type: 'place';
  id: string;
  name: string;
  description: string | null;
  category: CategoryRefDTO;
  categories: string[];
  location: { lat: number; lng: number; precision: LocationPrecision };
  address: string | null;
  city: CityRefDTO | null;
  phone: string | null;
  website: string | null;
  hours: OpeningHoursDTO;
  priceLevel: number | null;
  /** "source": a source states it (e.g. OSM fee=no). "typical": category is usually free (beaches, parks) — label accordingly. */
  free: { isFree: boolean | null; basis: 'source' | 'typical' | null };
  rating: { average: number; count: number; source: 'passtra' } | null;
  ageMin: number | null;
  status: PlaceStatus;
  images: ImageDTO[];
  distanceKm: number | null;
  verification: VerificationDTO;
  externalIds: Record<string, string>;
  sponsored: false;
  isDemo: boolean;
  /** Longer text about the place (localized), with its source and licence. */
  about: { text: string; source: string; url: string | null; license: string | null } | null;
}

export type EntityDTO = EventDTO | PlaceDTO;

export interface RecommendationDTO {
  entity: EntityDTO;
  score: number;
  reason: string; // built from real ranking reasons, never generated
}

export type FeedSectionKey =
  | 'happening_today' | 'right_now' | 'tonight' | 'this_weekend' | 'near_you' | 'free' | 'hidden_gems' | 'popular' | 'for_you';

export interface FeedSectionDTO {
  key: FeedSectionKey;
  title: string;
  subtitle: string | null;
  items: EntityDTO[];
}

export interface WeatherDTO {
  temperatureC: number;
  symbol: string; // MET Norway symbol code
  summary: string;
  updatedAt: string;
  attribution: string;
}

export interface FeedResponse {
  generatedAt: string;
  timezone: string;
  context: { city: CityRefDTO | null; lat: number | null; lng: number | null; radiusKm: number; usedLocation: boolean };
  weather: WeatherDTO | null;
  sections: FeedSectionDTO[];
  dataNotice: string | null;
}

export interface SearchResponse {
  query: string;
  interpretation: SearchFilters & { engine: 'ai' | 'rules'; summary: string };
  results: EntityDTO[];
  total: number;
  /** Radius actually searched (km). */
  radiusKm: number;
  /** Typo-corrected query used when the literal one found nothing. */
  didYouMean: string | null;
  /** How many results wider radii would give, when few were found nearby. */
  widen: Array<{ radiusKm: number; count: number }>;
}

export interface PlanStopDTO {
  /** null for a stop the user added themselves (see `custom`). */
  entity: EntityDTO | null;
  custom?: { title: string; lat: number | null; lng: number | null } | null;
  arrive: string;
  depart: string;
  arriveLabel: string;
  departLabel: string;
  durationMin: number;
  travelMinFromPrev: number;
  travelMode: 'walk' | 'drive';
  /** To the next stop (null for the last). */
  distanceToNextKm: number | null;
  travelToNextMin: number | null;
  /** Known cost for all participants (null = not listed). */
  costEur: number | null;
  notes: Array<'meal' | 'hours_unknown' | 'price_unknown' | 'fixed_time'>;
  /** Problems found when re-checking an edited plan. */
  issues?: Array<'closed' | 'hours_unknown' | 'event_missed' | 'event_not_started' | 'after_window' | 'over_budget'>;
}

export interface PlanVariantDTO {
  stops: PlanStopDTO[];
  totalKnownCost: number;
  stopsWithUnknownPrice: number;
  totalTravelMin: number;
  freeMinutes: number;
}

export interface PlanDayResponse {
  /** Several different plans for the same request (the first is the best match). */
  variants: PlanVariantDTO[];
  participants: number;
  stops: PlanStopDTO[];
  totalKnownCost: number;
  stopsWithUnknownPrice: number;
  totalTravelMin: number;
  freeMinutes: number;
  disclaimer: string;
  /** The window actually planned (start moves to "now" for today), local date and HH:mm in the city's zone. */
  window: { date: string; start: string; end: string; endsNextDay: boolean };
  /** Why the plan is empty: today's window is (almost) over, or nothing suitable is listed for it. */
  reason: 'window_passed' | 'nothing_fits' | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
