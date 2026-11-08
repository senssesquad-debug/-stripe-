import type { Connector } from '../types';
import { eventbriteConnector } from './eventbrite';
import { osmConnector } from './osm';
import { icalConnector, jsonLdConnector } from './structured-web';
import { ticketmasterConnector } from './ticketmaster';
import { tribeEventsConnector } from './tribe-events';
import { wikidataConnector } from './wikidata';

export const CONNECTORS: Record<string, Connector> = Object.fromEntries(
  [tribeEventsConnector, osmConnector, wikidataConnector, ticketmasterConnector, eventbriteConnector, jsonLdConnector, icalConnector].map((c) => [c.id, c]),
);

export function getConnector(id: string): Connector | undefined {
  return CONNECTORS[id];
}
