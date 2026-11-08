-- Durable per-source state for long, resumable imports (e.g. which OpenStreetMap tiles are done in the current cycle).
CREATE TABLE connector_state (
  source_id  int NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  key        text NOT NULL,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, key)
);

-- Runs cut off by a host restart/sleep never reach "finished": close them so status pages don't show them as running.
UPDATE ingestion_runs SET status = 'failed', finished_at = now(), error_message = 'Interrupted (the server restarted or went to sleep); the import resumes in the next run'
 WHERE status = 'running' AND started_at < now() - interval '40 minutes';
UPDATE sources SET next_run_at = now(), locked_until = NULL, consecutive_failures = 0 WHERE key = 'osm_cy';
