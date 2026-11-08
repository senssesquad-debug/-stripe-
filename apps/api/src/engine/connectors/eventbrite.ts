import { cleanTitle, excerpt, localDate, normalizeZone } from '@passtra/core';
import { detectStatus } from '../classify';
import type { Connector, NormalizedEvent, RawRecord } from '../types';

/**
 * Eventbrite API v3. Public location search was shut down in Dec 2019, so only events of
 * organizations that connect with passtra (organization IDs in config) can be fetched.
 * Config: { organizationIds: string[] }
 */
interface EbEvent {
  id: string;
  name?: { text?: string };
  summary?: string;
  description?: { text?: string };
  url?: string;
  start?: { timezone?: string; utc?: string; local?: string };
  end?: { utc?: string };
  status?: string;
  online_event?: boolean;
  is_free?: boolean;
  logo?: { url?: string } | null;
  venue?: { name?: string; address?: { localized_address_display?: string; city?: string; latitude?: string; longitude?: string } } | null;
  ticket_availability?: { minimum_ticket_price?: { major_value?: string; currency?: string } | null; maximum_ticket_price?: { major_value?: string } | null } | null;
  organizer?: { name?: string; website?: string } | null;
}

export const eventbriteConnector: Connector = {
  id: 'eventbrite_org',
  entityType: 'event',
  fullSnapshot: true,
  requiresKey: 'EVENTBRITE_TOKEN',

  async *fetch(ctx): AsyncIterable<RawRecord> {
    const orgs = (ctx.source.config.organizationIds as string[]) ?? [];
    for (const org of orgs) {
      let continuation: string | undefined;
      for (let i = 0; i < 20; i++) {
        const url = `https://www.eventbriteapi.com/v3/organizations/${encodeURIComponent(org)}/events/?status=live&time_filter=current_future&expand=venue,ticket_availability,organizer${continuation ? `&continuation=${continuation}` : ''}`;
        const res = await ctx.http.json<{ events: EbEvent[]; pagination?: { has_more_items?: boolean; continuation?: string } }>(url, { headers: { authorization: `Bearer ${ctx.config.EVENTBRITE_TOKEN}` } });
        for (const e of res.data?.events ?? []) if (!e.online_event) yield { externalId: e.id, url: e.url ?? null, payload: e };
        if (!res.data?.pagination?.has_more_items) break;
        continuation = res.data.pagination.continuation;
      }
    }
  },

  normalize(raw): NormalizedEvent | null {
    const e = raw.payload as EbEvent;
    if (!e.name?.text || !e.start?.utc) return null;
    const tz = normalizeZone(e.start.timezone);
    const startsAt = new Date(e.start.utc);
    const endsAt = e.end?.utc ? new Date(e.end.utc) : null;
    const lat = Number(e.venue?.address?.latitude);
    const lng = Number(e.venue?.address?.longitude);
    const min = Number(e.ticket_availability?.minimum_ticket_price?.major_value);
    const max = Number(e.ticket_availability?.maximum_ticket_price?.major_value);
    const title = cleanTitle(e.name.text);
    return {
      kind: 'event',
      externalId: raw.externalId,
      title,
      description: excerpt(e.summary ?? e.description?.text ?? '', 600) || null,
      categories: [],
      sourceLabels: [],
      venueName: e.venue?.name ?? null,
      address: e.venue?.address?.localized_address_display ?? null,
      cityHint: e.venue?.address?.city ?? null,
      location: Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 ? { lat, lng } : null,
      timezone: tz,
      startsAt,
      endsAt: endsAt && endsAt > startsAt ? endsAt : null,
      timePrecision: 'exact',
      localStartDate: localDate(startsAt, tz),
      localEndDate: endsAt ? localDate(endsAt, tz) : null,
      price: e.is_free
        ? { isFree: true, min: 0, max: 0, currency: null, confident: true, text: '' }
        : Number.isFinite(min) ? { isFree: false, min, max: Number.isFinite(max) ? max : null, currency: e.ticket_availability?.minimum_ticket_price?.currency ?? null, confident: true, text: '' } : null,
      ticketUrl: e.url ?? null,
      website: null,
      organizerName: e.organizer?.name ?? null,
      organizerUrl: e.organizer?.website ?? null,
      ageMin: null,
      images: e.logo?.url ? [{ url: e.logo.url, source: 'eventbrite', attribution: e.organizer?.name ?? 'Eventbrite' }] : [],
      status: e.status === 'canceled' ? 'cancelled' : detectStatus(title) ?? 'scheduled',
      sourceUrl: e.url ?? null,
      externalIds: { eventbrite: raw.externalId },
    };
  },
};
