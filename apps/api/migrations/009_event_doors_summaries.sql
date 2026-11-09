-- Doors (venue opening) time, separate from the event start; and short descriptions written from verified facts.
ALTER TABLE events ADD COLUMN doors_at timestamptz;
CREATE TABLE entity_summaries (
  entity_type  text NOT NULL CHECK (entity_type IN ('event','place')),
  entity_id    uuid NOT NULL,
  locale       text NOT NULL,
  facts_hash   text NOT NULL,
  text         text NOT NULL,
  engine       text NOT NULL,        -- 'ai' | 'facts'
  model        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id, locale)
);
