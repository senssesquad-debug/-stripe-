import type { EventStatus, ImageDTO, ParsedPrice, PlaceStatus, LocalTimeAdjustment } from '@passtra/core';
import type { AppConfig } from '../config';
import type { HttpClient } from '../lib/http';

export interface SourceRow {
  id: number;
  key: string;
  name: string;
  connector: string;
  entity_type: 'event' | 'place';
  country_code: string | null;
  homepage_url: string | null;
  attribution: string | null;
  authority: number;
  is_official: boolean;
  requires_key: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  min_interval_s: number;
  max_interval_s: number;
  current_interval_s: number;
  consecutive_failures: number;
  http_cache: Record<string, { etag?: string | null; lastModified?: string | null }>;
}

export interface RawRecord {
  externalId: string;
  url?: string | null;
  payload: unknown;
}

export interface NormalizedEvent {
  kind: 'event';
  externalId: string;
  title: string;
  description: string | null;
  /** Category slugs if the source maps cleanly; otherwise empty and the engine classifies. */
  categories: string[];
  /** Free-text labels from the source, used for classification. */
  sourceLabels: string[];
  venueName: string | null;
  address: string | null;
  cityHint: string | null;
  location: { lat: number; lng: number } | null;
  timezone: string;
  startsAt: Date;
  endsAt: Date | null;
  timePrecision: 'exact' | 'date_only';
  localStartDate: string;
  localEndDate: string | null;
  timeAdjustment?: LocalTimeAdjustment;
  price: ParsedPrice | null;
  ticketUrl: string | null;
  website: string | null;
  organizerName: string | null;
  organizerUrl: string | null;
  ageMin: number | null;
  images: ImageDTO[];
  status: Extract<EventStatus, 'scheduled' | 'cancelled' | 'postponed' | 'rescheduled'>;
  sourceUrl: string | null;
  externalIds: Record<string, string>;
}

export interface NormalizedPlace {
  kind: 'place';
  externalId: string;
  name: string;
  nameI18n: Record<string, string>;
  description: string | null;
  categories: string[];
  location: { lat: number; lng: number };
  address: string | null;
  cityHint: string | null;
  phone: string | null;
  website: string | null;
  openingHours: { format: 'osm'; value: string } | null;
  isFree: boolean | null;
  wheelchair: string | null;
  status: PlaceStatus;
  images: ImageDTO[];
  externalIds: Record<string, string>;
  sourceUrl: string | null;
}

export type Normalized = NormalizedEvent | NormalizedPlace;

export interface Logger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  debug(obj: unknown, msg?: string): void;
}

export interface ConnectorContext {
  source: SourceRow;
  http: HttpClient;
  config: AppConfig;
  now: Date;
  log: Logger;
  /** Persisted conditional-request validators for this source, keyed by URL. */
  httpCache: SourceRow['http_cache'];
}

export interface Connector {
  id: string;
  entityType: 'event' | 'place';
  /** If true, each successful run returns the complete current listing, so absence is a signal. */
  fullSnapshot: boolean;
  /** Env var that must be set for this connector to run. */
  requiresKey?: keyof AppConfig;
  fetch(ctx: ConnectorContext): AsyncIterable<RawRecord>;
  normalize(raw: RawRecord, ctx: ConnectorContext): Normalized | null;
}
