-- Day plans saved by users; a share token makes a read-only link that works without signing in.
CREATE TABLE saved_plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  date         date NOT NULL,
  params       jsonb NOT NULL,          -- start, end, budget, participants, mode, city/lat/lng
  items        jsonb NOT NULL,          -- ordered stops: {kind:'event'|'place', id} | {kind:'custom', title, lat, lng, durationMin}
  share_token  text UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_plans_user_idx ON saved_plans (user_id, date DESC);
