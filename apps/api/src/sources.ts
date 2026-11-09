import { SOURCE_AUTHORITY } from '@passtra/core';
import type pg from 'pg';

export interface SourceDef {
  key: string;
  name: string;
  connector: string;
  entity_type: 'event' | 'place';
  country_code: string | null;
  homepage_url: string | null;
  terms_url: string | null;
  terms_notes: string | null;
  attribution: string | null;
  authority: number;
  is_official: boolean;
  requires_key: string | null;
  config: Record<string, unknown>;
  /** Enabled on first registration (admins control it afterwards). */
  enabled: boolean;
  min_interval_s: number;
  max_interval_s: number;
}

const DAY = 86_400;

export const DEFAULT_SOURCES: SourceDef[] = [
  // Internal sources used for moderation. Never scheduled.
  { key: 'passtra_admin_events', name: 'passtra moderators (events)', connector: 'manual', entity_type: 'event', country_code: null, homepage_url: null, terms_url: null, terms_notes: null, attribution: null, authority: 1, is_official: false, requires_key: null, config: {}, enabled: false, min_interval_s: DAY, max_interval_s: DAY },
  { key: 'passtra_admin_places', name: 'passtra moderators (places)', connector: 'manual', entity_type: 'place', country_code: null, homepage_url: null, terms_url: null, terms_notes: null, attribution: null, authority: 1, is_official: false, requires_key: null, config: {}, enabled: false, min_interval_s: DAY, max_interval_s: DAY },
  { key: 'organizer_submissions', name: 'Organisers (verified by passtra)', connector: 'manual', entity_type: 'event', country_code: null, homepage_url: null, terms_url: null, terms_notes: 'Organisers submit events; moderators approve before publication.', attribution: null, authority: SOURCE_AUTHORITY.official_venue, is_official: true, requires_key: null, config: {}, enabled: false, min_interval_s: DAY, max_interval_s: DAY },

  // Events
  {
    key: 'visitcyprus_events', name: 'Visit Cyprus — Deputy Ministry of Tourism', connector: 'tribe_events', entity_type: 'event', country_code: 'CY',
    homepage_url: 'https://www.visitcyprus.com', terms_url: 'https://www.visitcyprus.com',
    terms_notes: 'Public REST API of the site calendar (The Events Calendar). robots.txt allows. Terms page returned 404 on 2026-11-08 — obtain written confirmation of reuse before production. Images disabled until confirmed.',
    attribution: 'visitcyprus.com', authority: SOURCE_AUTHORITY.government, is_official: false, requires_key: null,
    config: { baseUrl: 'https://www.visitcyprus.com', daysAhead: 180, allowImages: false, timezone: 'Europe/Nicosia' }, enabled: true, min_interval_s: 900, max_interval_s: 1800,
  },
  {
    key: 'ticketmaster_cy', name: 'Ticketmaster Discovery API', connector: 'ticketmaster', entity_type: 'event', country_code: 'CY',
    homepage_url: 'https://developer.ticketmaster.com', terms_url: 'https://developer.ticketmaster.com/support/terms-of-use/', terms_notes: '5000 calls/day, 5 rps. Cyprus coverage expected to be small.',
    attribution: 'Ticketmaster', authority: SOURCE_AUTHORITY.ticketing, is_official: false, requires_key: 'TICKETMASTER_API_KEY',
    config: { countryCode: 'CY' }, enabled: true, min_interval_s: 1800, max_interval_s: 3 * 3600,
  },
  {
    key: 'eventbrite_orgs', name: 'Eventbrite (connected organisers)', connector: 'eventbrite_org', entity_type: 'event', country_code: 'CY',
    homepage_url: 'https://www.eventbrite.com/platform', terms_url: 'https://www.eventbrite.com/help/en-us/articles/833731/eventbrite-api-terms-of-use/', terms_notes: 'Location search was shut down in 2019; only organisations listed in config.organizationIds are fetched.',
    attribution: 'Eventbrite', authority: SOURCE_AUTHORITY.ticketing, is_official: true, requires_key: 'EVENTBRITE_TOKEN',
    config: { organizationIds: [] }, enabled: true, min_interval_s: 1800, max_interval_s: 3 * 3600,
  },

  // Places
  {
    key: 'osm_cy', name: 'OpenStreetMap', connector: 'osm', entity_type: 'place', country_code: 'CY',
    homepage_url: 'https://www.openstreetmap.org', terms_url: 'https://www.openstreetmap.org/copyright', terms_notes: 'ODbL: attribution required. Daily Geofabrik extract (download.geofabrik.de), one download per day.',
    attribution: '© OpenStreetMap contributors (ODbL)', authority: SOURCE_AUTHORITY.open_data, is_official: false, requires_key: null,
    config: { mode: 'pbf', countryIso: 'CY' }, enabled: true, min_interval_s: DAY, max_interval_s: 7 * DAY,
  },
  {
    key: 'wikidata_cy', name: 'Wikidata + Wikimedia Commons', connector: 'wikidata', entity_type: 'place', country_code: 'CY',
    homepage_url: 'https://www.wikidata.org', terms_url: 'https://www.wikidata.org/wiki/Wikidata:Licensing', terms_notes: 'Data CC0. Images kept only with an open licence; author and licence shown.',
    attribution: 'Wikidata (CC0); images via Wikimedia Commons', authority: SOURCE_AUTHORITY.open_data, is_official: false, requires_key: null,
    config: { countryQid: 'Q229' }, enabled: true, min_interval_s: 3 * DAY, max_interval_s: 14 * DAY,
  },
];

/** Insert missing sources; never overwrite admin-controlled fields (enabled, terms review, intervals) of existing ones. */
export async function registerSources(pool: pg.Pool, defs: SourceDef[] = DEFAULT_SOURCES): Promise<string[]> {
  const created: string[] = [];
  for (const s of defs) {
    const r = await pool.query(
      `INSERT INTO sources (key, name, connector, entity_type, country_code, homepage_url, terms_url, terms_notes, attribution, authority, is_official, requires_key, config, enabled, min_interval_s, max_interval_s, current_interval_s)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$15)
       ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, homepage_url = EXCLUDED.homepage_url, terms_url = EXCLUDED.terms_url, attribution = EXCLUDED.attribution, requires_key = EXCLUDED.requires_key
       RETURNING (xmax = 0) AS inserted`,
      [s.key, s.name, s.connector, s.entity_type, s.country_code, s.homepage_url, s.terms_url, s.terms_notes, s.attribution, s.authority, s.is_official, s.requires_key, JSON.stringify(s.config), s.enabled, s.min_interval_s, s.max_interval_s],
    );
    if (r.rows[0]?.inserted) created.push(s.key);
  }
  return created;
}
