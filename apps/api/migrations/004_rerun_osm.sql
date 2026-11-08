-- The OpenStreetMap connector now imports per tile with Overpass fallbacks; queue it right away
-- instead of waiting for the back-off left by earlier failed runs.
UPDATE sources SET next_run_at = now(), consecutive_failures = 0, locked_until = NULL WHERE key = 'osm_cy';
