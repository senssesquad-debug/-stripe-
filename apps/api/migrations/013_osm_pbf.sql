-- OpenStreetMap: import the whole country from the daily Geofabrik extract instead of hundreds of Overpass
-- queries (which time out from shared hosting IPs and never reached the later categories). Start right away.
UPDATE sources SET config = jsonb_set(config, '{mode}', '"pbf"'), next_run_at = now(), locked_until = NULL, consecutive_failures = 0
WHERE key = 'osm_cy';
DELETE FROM connector_state WHERE key = 'osm_cycle' AND source_id = (SELECT id FROM sources WHERE key = 'osm_cy');
