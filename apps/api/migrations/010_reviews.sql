-- Reviews: moderation results, helpful votes, reports; ratings for events too (passtra users only).
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_status_check;
ALTER TABLE reviews ADD CONSTRAINT reviews_status_check CHECK (status IN ('published','pending','rejected','removed'));
ALTER TABLE reviews
  ADD COLUMN moderation    jsonb,                 -- {decision, labels[], reasons[], engine}
  ADD COLUMN moderated_at  timestamptz,
  ADD COLUMN helpful_count int NOT NULL DEFAULT 0,
  ADD COLUMN report_count  int NOT NULL DEFAULT 0,
  ADD COLUMN edited_at     timestamptz;
CREATE TABLE review_votes (
  review_id  uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);
CREATE TABLE review_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  client_key  text NOT NULL,
  reason      text NOT NULL CHECK (reason IN ('offensive','spam','fake','personal_data','threat','other')),
  message     text CHECK (char_length(message) <= 1000),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, client_key)
);
CREATE INDEX reviews_pending_idx ON reviews (created_at) WHERE status = 'pending';
ALTER TABLE events ADD COLUMN user_rating_avg numeric(3,2), ADD COLUMN user_rating_count int NOT NULL DEFAULT 0;
