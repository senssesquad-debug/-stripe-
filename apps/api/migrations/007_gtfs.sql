-- Public transport timetables from the official GTFS feeds of Cyprus bus operators (Motion portal, CC BY 4.0).
CREATE TABLE gtfs_feeds (
  feed_key      text PRIMARY KEY,              -- e.g. "emel"
  agency_name   text NOT NULL,
  url           text NOT NULL,
  version       text,
  valid_from    date,
  valid_to      date,
  imported_at   timestamptz,
  checked_at    timestamptz,
  error         text
);
CREATE TABLE gtfs_stops (
  feed_key  text NOT NULL REFERENCES gtfs_feeds(feed_key) ON DELETE CASCADE,
  stop_id   text NOT NULL,
  name      text NOT NULL,
  location  geography(Point, 4326) NOT NULL,
  PRIMARY KEY (feed_key, stop_id)
);
CREATE INDEX gtfs_stops_geo_idx ON gtfs_stops USING gist (location);
CREATE TABLE gtfs_routes (
  feed_key    text NOT NULL REFERENCES gtfs_feeds(feed_key) ON DELETE CASCADE,
  route_id    text NOT NULL,
  short_name  text,
  long_name   text,
  route_type  int,
  color       text,
  fare_eur    numeric(6,2),
  PRIMARY KEY (feed_key, route_id)
);
CREATE TABLE gtfs_trips (
  feed_key    text NOT NULL REFERENCES gtfs_feeds(feed_key) ON DELETE CASCADE,
  trip_id     text NOT NULL,
  route_id    text NOT NULL,
  service_id  text NOT NULL,
  headsign    text,
  PRIMARY KEY (feed_key, trip_id)
);
CREATE TABLE gtfs_service_dates (
  feed_key    text NOT NULL REFERENCES gtfs_feeds(feed_key) ON DELETE CASCADE,
  service_id  text NOT NULL,
  date        date NOT NULL,
  PRIMARY KEY (feed_key, date, service_id)
);
-- Times are seconds after midnight of the service day (may exceed 24h for after-midnight trips).
CREATE TABLE gtfs_stop_times (
  feed_key   text NOT NULL,
  trip_id    text NOT NULL,
  seq        int NOT NULL,
  stop_id    text NOT NULL,
  arr        int NOT NULL,
  dep        int NOT NULL,
  PRIMARY KEY (feed_key, trip_id, seq)
);
CREATE INDEX gtfs_stop_times_stop_idx ON gtfs_stop_times (feed_key, stop_id, dep);
