-- Accounts (own email+password auth), verified contact details, sessions,
-- personal events with reminders, Web Push subscriptions, app settings.

ALTER TABLE users
  ADD COLUMN name               text CHECK (char_length(name) <= 80),
  ADD COLUMN email              text,
  ADD COLUMN email_verified_at  timestamptz,
  ADD COLUMN phone              text,          -- E.164; only set after a confirmed code
  ADD COLUMN phone_verified_at  timestamptz,
  ADD COLUMN password_hash      text;
CREATE UNIQUE INDEX users_email_uq ON users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX users_phone_uq ON users (phone) WHERE phone IS NOT NULL;

CREATE TABLE auth_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id);

-- One-time codes for email/phone confirmation and password reset. Only hashes are stored.
CREATE TABLE verification_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose       text NOT NULL CHECK (purpose IN ('verify_email','verify_phone','reset_password')),
  target        text NOT NULL,
  code_hash     text NOT NULL,
  attempts      int NOT NULL DEFAULT 0,
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_codes_user_idx ON verification_codes (user_id, purpose, created_at DESC);

CREATE TABLE personal_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title              text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description        text CHECK (char_length(description) <= 2000),
  timezone           text NOT NULL,
  starts_at          timestamptz NOT NULL,
  ends_at            timestamptz NOT NULL,
  location_name      text CHECK (char_length(location_name) <= 200),
  address            text CHECK (char_length(address) <= 300),
  location           geography(Point, 4326),
  entity_type        text CHECK (entity_type IN ('event','place')),
  entity_id          uuid,
  reminder_minutes   int CHECK (reminder_minutes BETWEEN 0 AND 20160),
  reminder_due_at    timestamptz,
  reminder_sent_at   timestamptz,
  reminder_status    text CHECK (reminder_status IN ('sent','failed','no_channel','skipped_stale')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX personal_events_user_idx ON personal_events (user_id, starts_at);
CREATE INDEX personal_events_due_idx ON personal_events (reminder_due_at) WHERE reminder_sent_at IS NULL AND reminder_due_at IS NOT NULL;

CREATE TABLE web_push_subscriptions (
  endpoint         text PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh           text NOT NULL,
  auth             text NOT NULL,
  user_agent       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_success_at  timestamptz,
  disabled_at      timestamptz
);
CREATE INDEX web_push_user_idx ON web_push_subscriptions (user_id) WHERE disabled_at IS NULL;

-- Small key/value store for server-generated settings (e.g. Web Push VAPID keys when not set via env).
CREATE TABLE app_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
