-- Searchable details of places (cuisine, diets, brand, sport) shown on cards and used by search.
ALTER TABLE places ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
-- Rebuild search documents once with the richer content (done by the API at start-up, see reindexSearch).
INSERT INTO app_settings (key, value) VALUES ('search_doc_version', '1') ON CONFLICT (key) DO UPDATE SET value = '1';
