-- passtra — initial schema
-- PostgreSQL 15+ with PostGIS 3 and pg_trgm.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ───────────────────────────── Geography (international by design) ─────────────────────────────
CREATE TABLE countries (
  code              char(2) PRIMARY KEY,
  name              jsonb   NOT NULL,
  default_timezone  text    NOT NULL,
  default_currency  char(3) NOT NULL,
  default_locale    text    NOT NULL,
  bbox              geometry(Polygon, 4326),
  enabled           boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cities (
  id            serial PRIMARY KEY,
  slug          text NOT NULL UNIQUE,
  country_code  char(2) NOT NULL REFERENCES countries(code),
  name          jsonb NOT NULL,
  aliases       text[] NOT NULL DEFAULT '{}',
  timezone      text NOT NULL,
  center        geography(Point, 4326) NOT NULL,
  radius_km     numeric(6,2) NOT NULL DEFAULT 10,
  featured      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cities_center_gix ON cities USING gist (center);

-- ───────────────────────────── Taxonomy (synced from packages/core) ─────────────────────────────
CREATE TABLE categories (
  slug        text PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('event','place','both')),
  group_slug  text NOT NULL,
  icon        text NOT NULL,
  label       jsonb NOT NULL,
  age_min     smallint,
  sort_order  int NOT NULL DEFAULT 0
);

-- ───────────────────────────── Sources & ingestion ─────────────────────────────
CREATE TABLE sources (
  id                   serial PRIMARY KEY,
  key                  text NOT NULL UNIQUE,
  name                 text NOT NULL,
  connector            text NOT NULL,
  entity_type          text NOT NULL CHECK (entity_type IN ('event','place')),
  country_code         char(2) REFERENCES countries(code),
  homepage_url         text,
  terms_url            text,
  terms_reviewed_at    timestamptz,
  terms_notes          text,
  attribution          text,
  authority            numeric(3,2) NOT NULL CHECK (authority BETWEEN 0 AND 1),
  is_official          boolean NOT NULL DEFAULT false,
  requires_key         text,                       -- env var name the connector needs, if any
  config               jsonb NOT NULL DEFAULT '{}',
  enabled              boolean NOT NULL DEFAULT false,
  min_interval_s       int NOT NULL DEFAULT 900  CHECK (min_interval_s >= 60),
  max_interval_s       int NOT NULL DEFAULT 1800 CHECK (max_interval_s >= min_interval_s),
  current_interval_s   int NOT NULL DEFAULT 900,
  next_run_at          timestamptz NOT NULL DEFAULT now(),
  locked_until         timestamptz,
  last_run_at          timestamptz,
  last_success_at      timestamptz,
  consecutive_failures int NOT NULL DEFAULT 0,
  http_cache           jsonb NOT NULL DEFAULT '{}', -- ETag / Last-Modified per URL
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  -- A source that scrapes a website can only be enabled after a human reviewed its terms.
  CONSTRAINT sources_terms_before_enable CHECK (NOT enabled OR terms_reviewed_at IS NOT NULL OR connector NOT IN ('jsonld_events','ical_feed'))
);
CREATE INDEX sources_due_idx ON sources (next_run_at) WHERE enabled;

CREATE TABLE ingestion_runs (
  id            bigserial PRIMARY KEY,
  source_id     int NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  trigger       text NOT NULL DEFAULT 'schedule' CHECK (trigger IN ('schedule','manual','test')),
  status        text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed','skipped')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  fetched       int NOT NULL DEFAULT 0,
  created       int NOT NULL DEFAULT 0,
  updated       int NOT NULL DEFAULT 0,
  unchanged     int NOT NULL DEFAULT 0,
  merged        int NOT NULL DEFAULT 0,
  conflicts     int NOT NULL DEFAULT 0,
  skipped       int NOT NULL DEFAULT 0,
  errors        int NOT NULL DEFAULT 0,
  missing       int NOT NULL DEFAULT 0,
  error_message text,
  details       jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX ingestion_runs_source_idx ON ingestion_runs (source_id, started_at DESC);

CREATE TABLE ingestion_errors (
  id           bigserial PRIMARY KEY,
  run_id       bigint REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  source_id    int NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  external_id  text,
  stage        text NOT NULL,
  message      text NOT NULL,
  sample       jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ingestion_errors_created_idx ON ingestion_errors (created_at DESC);

-- ───────────────────────────── Places ─────────────────────────────
CREATE TABLE places (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  name_i18n            jsonb NOT NULL DEFAULT '{}',
  description          text,
  primary_category     text NOT NULL REFERENCES categories(slug),
  categories           text[] NOT NULL DEFAULT '{}',
  location             geography(Point, 4326) NOT NULL,
  location_precision   text NOT NULL DEFAULT 'exact' CHECK (location_precision IN ('exact','approximate','city')),
  address              text,
  city_id              int REFERENCES cities(id),
  country_code         char(2) NOT NULL REFERENCES countries(code),
  phone                text,
  website              text,
  opening_hours        jsonb,          -- {"format":"osm","value":"Mo-Fr 09:00-17:00"}
  price_level          smallint CHECK (price_level BETWEEN 1 AND 4),
  is_free              boolean,        -- only from a source fact (e.g. OSM fee=no), never guessed
  age_min              smallint,
  wheelchair           text,
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active','temporarily_closed','permanently_closed','unverified','hidden')),
  images               jsonb NOT NULL DEFAULT '[]',
  external_ids         jsonb NOT NULL DEFAULT '{}',
  user_rating_avg      numeric(3,2),
  user_rating_count    int NOT NULL DEFAULT 0,
  popularity           real NOT NULL DEFAULT 0,
  confidence           smallint NOT NULL DEFAULT 0,
  verification_status  text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('confirmed','likely','unverified','conflicting')),
  field_sources        jsonb NOT NULL DEFAULT '{}',
  source_count         smallint NOT NULL DEFAULT 1,
  last_verified_at     timestamptz,
  search_doc           text NOT NULL DEFAULT '',
  is_demo              boolean NOT NULL DEFAULT false,
  merged_into          uuid REFERENCES places(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX places_location_gix ON places USING gist (location);
CREATE INDEX places_categories_gin ON places USING gin (categories);
CREATE INDEX places_search_trgm ON places USING gin (search_doc gin_trgm_ops);
CREATE INDEX places_external_ids_gin ON places USING gin (external_ids jsonb_path_ops);
CREATE INDEX places_city_idx ON places (city_id) WHERE merged_into IS NULL;

-- ───────────────────────────── Events ─────────────────────────────
CREATE TABLE events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                text NOT NULL,
  title_i18n           jsonb NOT NULL DEFAULT '{}',
  description          text,
  primary_category     text NOT NULL REFERENCES categories(slug),
  categories           text[] NOT NULL DEFAULT '{}',
  place_id             uuid REFERENCES places(id) ON DELETE SET NULL,
  venue_name           text,
  address              text,
  city_id              int REFERENCES cities(id),
  country_code         char(2) NOT NULL REFERENCES countries(code),
  location             geography(Point, 4326),
  location_precision   text NOT NULL DEFAULT 'unknown' CHECK (location_precision IN ('exact','approximate','city','unknown')),
  timezone             text NOT NULL,
  starts_at            timestamptz NOT NULL,
  ends_at              timestamptz,
  time_precision       text NOT NULL CHECK (time_precision IN ('exact','date_only')),
  time_unconfirmed     boolean NOT NULL DEFAULT false,
  local_start_date     date NOT NULL,
  local_end_date       date,
  is_free              boolean,
  price_min            numeric(10,2),
  price_max            numeric(10,2),
  currency             char(3),
  price_text           text,
  ticket_url           text,
  website              text,
  organizer_name       text,
  organizer_url        text,
  age_min              smallint,
  images               jsonb NOT NULL DEFAULT '[]',
  status               text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled','postponed','rescheduled','unlisted','completed')),
  verification_status  text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('confirmed','likely','unverified','conflicting')),
  confidence           smallint NOT NULL DEFAULT 0,
  organizer_confirmed  boolean NOT NULL DEFAULT false,
  field_sources        jsonb NOT NULL DEFAULT '{}',
  source_count         smallint NOT NULL DEFAULT 1,
  external_ids         jsonb NOT NULL DEFAULT '{}',
  last_verified_at     timestamptz,
  popularity           real NOT NULL DEFAULT 0,
  search_doc           text NOT NULL DEFAULT '',
  is_demo              boolean NOT NULL DEFAULT false,
  merged_into          uuid REFERENCES events(id),
  archived_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CHECK (local_end_date IS NULL OR local_end_date >= local_start_date),
  CHECK (price_min IS NULL OR price_max IS NULL OR price_max >= price_min)
);
CREATE INDEX events_location_gix ON events USING gist (location);
CREATE INDEX events_starts_idx ON events (starts_at) WHERE merged_into IS NULL AND archived_at IS NULL;
CREATE INDEX events_local_date_idx ON events (local_start_date, local_end_date) WHERE merged_into IS NULL AND archived_at IS NULL;
CREATE INDEX events_categories_gin ON events USING gin (categories);
CREATE INDEX events_search_trgm ON events USING gin (search_doc gin_trgm_ops);
CREATE INDEX events_external_ids_gin ON events USING gin (external_ids jsonb_path_ops);

-- ───────────────────────────── Provenance ─────────────────────────────
CREATE TABLE source_records (
  id               bigserial PRIMARY KEY,
  source_id        int NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  external_id      text NOT NULL,
  entity_type      text NOT NULL CHECK (entity_type IN ('event','place')),
  entity_id        uuid,
  url              text,
  payload          jsonb,                -- raw payload; purged after retention period
  normalized       jsonb,
  content_hash     text NOT NULL,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_changed_at  timestamptz NOT NULL DEFAULT now(),
  missing_runs     int NOT NULL DEFAULT 0,
  missing_since    timestamptz,
  UNIQUE (source_id, external_id)
);
CREATE INDEX source_records_entity_idx ON source_records (entity_type, entity_id);

CREATE TABLE field_observations (
  id                bigserial PRIMARY KEY,
  entity_type       text NOT NULL CHECK (entity_type IN ('event','place')),
  entity_id         uuid NOT NULL,
  field             text NOT NULL,
  source_id         int NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  source_record_id  bigint REFERENCES source_records(id) ON DELETE SET NULL,
  value             jsonb,
  observed_at       timestamptz NOT NULL DEFAULT now(),  -- first time this source reported this value
  last_seen_at      timestamptz NOT NULL DEFAULT now(),  -- last time this source confirmed it
  UNIQUE (entity_type, entity_id, field, source_id)
);
CREATE INDEX field_observations_entity_idx ON field_observations (entity_type, entity_id);

CREATE TABLE data_conflicts (
  id           bigserial PRIMARY KEY,
  entity_type  text NOT NULL CHECK (entity_type IN ('event','place')),
  entity_id    uuid NOT NULL,
  field        text NOT NULL,
  critical     boolean NOT NULL DEFAULT false,
  candidates   jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','auto_resolved','resolved','dismissed')),
  resolution   jsonb,
  resolved_by  uuid,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX data_conflicts_active_uq ON data_conflicts (entity_type, entity_id, field) WHERE status IN ('open','auto_resolved');
CREATE INDEX data_conflicts_status_idx ON data_conflicts (status, created_at DESC);

CREATE TABLE duplicate_candidates (
  id           bigserial PRIMARY KEY,
  entity_type  text NOT NULL CHECK (entity_type IN ('event','place')),
  a_id         uuid NOT NULL,
  b_id         uuid NOT NULL,
  score        real NOT NULL,
  reasons      jsonb NOT NULL DEFAULT '[]',
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','merged','dismissed')),
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (a_id < b_id),
  UNIQUE (entity_type, a_id, b_id)
);

CREATE TABLE geocode_cache (
  query_key   text PRIMARY KEY,
  query       text NOT NULL,
  provider    text NOT NULL,
  result      jsonb,                -- null = "no result" (cached to avoid re-asking)
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE TABLE http_cache (
  key            text PRIMARY KEY,
  payload        jsonb NOT NULL,
  last_modified  text,
  expires_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────────── Users (minimal data, GDPR) ─────────────────────────────
CREATE TABLE users (
  id                        uuid PRIMARY KEY,       -- subject of the auth provider JWT
  role                      text NOT NULL DEFAULT 'user' CHECK (role IN ('user','organizer','moderator','admin')),
  locale                    text NOT NULL DEFAULT 'en',
  interests                 text[] NOT NULL DEFAULT '{}',
  age_range                 text CHECK (age_range IN ('under_18','18_24','25_34','35_44','45_54','55_plus')),
  budget                    text CHECK (budget IN ('free','low','medium','high')),
  home_city_id              int REFERENCES cities(id),
  personalization_enabled   boolean NOT NULL DEFAULT true,
  notification_prefs        jsonb NOT NULL DEFAULT '{"enabled":false,"maxPerDay":1,"maxPerWeek":4,"quietStart":"22:00","quietEnd":"09:00","categories":[],"newInCity":true,"favoritesUpdates":true}',
  is_premium                boolean NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  last_seen_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_interactions (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type  text NOT NULL CHECK (entity_type IN ('event','place')),
  entity_id    uuid NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('view','open','save','unsave','share','dismiss','hide','click_ticket','navigate')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_interactions_user_idx ON user_interactions (user_id, created_at DESC);
CREATE INDEX user_interactions_entity_idx ON user_interactions (entity_type, entity_id, created_at DESC);

CREATE TABLE user_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  is_public   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE saved_items (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type  text NOT NULL CHECK (entity_type IN ('event','place')),
  entity_id    uuid NOT NULL,
  list_id      uuid REFERENCES user_lists(id) ON DELETE SET NULL,
  note         text CHECK (char_length(note) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entity_type, entity_id)
);

CREATE TABLE push_tokens (
  token         text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform      text NOT NULL CHECK (platform IN ('ios','android')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  disabled_at   timestamptz
);

CREATE TABLE notification_log (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  kind         text NOT NULL,
  title        text NOT NULL,
  body         text NOT NULL,
  status       text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  ticket_id    text,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id, kind)
);
CREATE INDEX notification_log_user_idx ON notification_log (user_id, created_at DESC);

CREATE TABLE reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type  text NOT NULL CHECK (entity_type IN ('event','place')),
  entity_id    uuid NOT NULL,
  rating       smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body         text CHECK (char_length(body) <= 2000),
  status       text NOT NULL DEFAULT 'published' CHECK (status IN ('published','pending','rejected')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);
CREATE INDEX reviews_entity_idx ON reviews (entity_type, entity_id) WHERE status = 'published';

-- Reports can be anonymous; client_key is a salted hash used only for abuse rate limiting.
CREATE TABLE reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  client_key   text,
  entity_type  text NOT NULL CHECK (entity_type IN ('event','place')),
  entity_id    uuid NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('cancelled','wrong_time','wrong_location','wrong_price','closed','duplicate','inappropriate','other')),
  message      text CHECK (char_length(message) <= 2000),
  proposed     jsonb,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected')),
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_status_idx ON reports (status, created_at DESC);

CREATE TABLE event_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  contact      text,
  payload      jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  event_id     uuid REFERENCES events(id) ON DELETE SET NULL,
  reviewer_id  uuid,
  review_notes text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_at  timestamptz
);
CREATE INDEX event_submissions_status_idx ON event_submissions (status, created_at DESC);

-- Paid placements are stored separately and never influence organic ranking.
-- Disabled by default (FEATURE_PROMOTIONS) until core functionality is complete.
CREATE TABLE promotions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text NOT NULL CHECK (entity_type IN ('event','place')),
  entity_id    uuid NOT NULL,
  placement    text NOT NULL CHECK (placement IN ('feed_today','search','map')),
  city_id      int REFERENCES cities(id),
  label        text NOT NULL DEFAULT 'Sponsored',
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE search_interpretations (
  query_key       text PRIMARY KEY,   -- hash of normalised query + locale; no user id stored
  interpretation  jsonb NOT NULL,
  engine          text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_audit_log (
  id           bigserial PRIMARY KEY,
  actor_id     uuid NOT NULL,
  action       text NOT NULL,
  entity_type  text,
  entity_id    text,
  before       jsonb,
  after        jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
