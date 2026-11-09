-- Profile avatars: one of the built-in presets, or an uploaded photo (stored as a processed square JPEG).
ALTER TABLE users ADD COLUMN avatar_preset text, ADD COLUMN avatar_url text, ADD COLUMN avatar_updated_at timestamptz;
CREATE TABLE user_avatars (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mime        text NOT NULL,
  data        bytea NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
