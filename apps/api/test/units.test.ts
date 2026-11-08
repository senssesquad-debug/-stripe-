process.env.TZ = 'UTC';
import { describe, expect, it } from 'vitest';
import { extractJsonLdEvents, normalizeJsonLdEvent, parseIcs, parseSchemaDate } from '../src/engine/connectors/structured-web';
import { icalConnector } from '../src/engine/connectors/structured-web';
import { classifyEvent, cityFromHint, cityFromLocation, detectStatus } from '../src/engine/classify';
import { cyprusPhDifferences, evaluateHours, openIntervals, orthodoxEaster } from '../src/lib/hours';
import { inQuietHours } from '../src/services/notifications';
import { HttpClient, HttpError } from '../src/lib/http';
import { fakeFetch } from './helpers';

const TZ = 'Europe/Nicosia';
const LIM = { lat: 34.6786, lng: 33.0413 };

describe('opening hours in Cyprus time', () => {
  it('summer (EEST) and winter (EET) evaluate against local wall time', () => {
    expect(evaluateHours('Mo-Su 09:00-17:00', new Date('2026-07-01T06:30:00Z'), TZ, LIM.lat, LIM.lng, 'en')!.openNow).toBe(true); // 09:30 local
    expect(evaluateHours('Mo-Su 09:00-17:00', new Date('2026-07-01T05:30:00Z'), TZ, LIM.lat, LIM.lng, 'en')!.openNow).toBe(false); // 08:30
    expect(evaluateHours('Mo-Su 09:00-17:00', new Date('2026-11-09T07:30:00Z'), TZ, LIM.lat, LIM.lng, 'en')!.openNow).toBe(true); // 09:30 EET
  });
  it('labels in three languages', () => {
    const at = new Date('2026-11-09T07:30:00Z');
    expect(evaluateHours('Mo-Fr 09:00-17:00', at, TZ, LIM.lat, LIM.lng, 'en')!.label).toBe('Open · closes 17:00');
    expect(evaluateHours('Mo-Fr 09:00-17:00', at, TZ, LIM.lat, LIM.lng, 'ru')!.label).toBe('Открыто · до 17:00');
    expect(evaluateHours('Mo-Fr 10:00-17:00', at, TZ, LIM.lat, LIM.lng, 'el')!.label).toBe('Κλειστό · ανοίγει 10:00');
    expect(evaluateHours('24/7', at, TZ, LIM.lat, LIM.lng, 'en')!.label).toBe('Open 24 hours');
  });
  it('past midnight hours (bars)', () => {
    expect(evaluateHours('Mo-Su 18:00-02:00', new Date('2026-11-09T23:30:00Z'), TZ, LIM.lat, LIM.lng, 'en')!.openNow).toBe(true); // 01:30 local
  });
  it('garbage is unknown, never guessed', () => {
    expect(evaluateHours('call us', new Date(), TZ, LIM.lat, LIM.lng, 'en')!.openNow).toBeNull();
  });
  it('Orthodox Easter and Cyprus-only public holidays', () => {
    expect(orthodoxEaster(2025)).toEqual({ month: 4, day: 20 });
    expect(orthodoxEaster(2026)).toEqual({ month: 4, day: 12 });
    expect(orthodoxEaster(2027)).toEqual({ month: 5, day: 2 });
    expect(cyprusPhDifferences(2026)).toEqual(['2026-04-01', '2026-10-01', '2026-04-14', '2026-12-24']);
  });
  it('PH rules: evaluated with the Orthodox calendar, unknown on Cyprus-only holidays', () => {
    const v = 'Mo-Sa 09:00-20:00; PH off';
    expect(evaluateHours(v, new Date('2026-11-09T10:00:00Z'), TZ, LIM.lat, LIM.lng, 'en')!.openNow).toBe(true); // normal Monday
    expect(evaluateHours(v, new Date('2026-04-13T10:00:00Z'), TZ, LIM.lat, LIM.lng, 'en')!.openNow).toBe(false); // Easter Monday (shared)
    expect(evaluateHours(v, new Date('2026-04-14T10:00:00Z'), TZ, LIM.lat, LIM.lng, 'en')!.openNow).toBeNull(); // Easter Tuesday (Cyprus only)
    expect(evaluateHours(v, new Date('2026-10-01T10:00:00Z'), TZ, LIM.lat, LIM.lng, 'en')!.openNow).toBeNull(); // Independence Day
  });
  it('open intervals for a day', () => {
    const ivs = openIntervals('Mo-Fr 09:00-13:00,15:00-19:00', new Date('2026-11-09T00:00:00+02:00'), new Date('2026-11-09T23:59:00+02:00'), TZ, LIM.lat, LIM.lng)!;
    expect(ivs.map((i) => i.start.toISOString())).toEqual(['2026-11-09T07:00:00.000Z', '2026-11-09T13:00:00.000Z']);
  });
});

describe('JSON-LD (schema.org Event)', () => {
  const html = `<html><script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","itemListElement":[
    {"@type":"ListItem","item":{"@type":"TheaterEvent","name":"Η Δωδέκατη Νύχτα","startDate":"2026-12-03T20:30","location":{"@type":"Place","name":"Rialto Theatre","address":{"@type":"PostalAddress","streetAddress":"Andrea Drousioti 19","addressLocality":"Λεμεσός"}},"offers":{"@type":"Offer","price":"15","priceCurrency":"EUR","url":"https://tickets.example/1"},"image":["/img/a.jpg"]}},
    {"@type":"ListItem","item":{"@type":"Event","name":"Online talk","startDate":"2026-12-04","eventAttendanceMode":"https://schema.org/OnlineEventAttendanceMode"}}
  ]}</script><script type="application/ld+json">not json</script></html>`;

  it('extracts events from lists/graphs and ignores broken blocks', () => {
    expect(extractJsonLdEvents(html)).toHaveLength(2);
  });
  it('local times without offset use the source zone; online events are skipped', () => {
    const [theatre, online] = extractJsonLdEvents(html);
    const n = normalizeJsonLdEvent(online!, 'https://rialto.example/', TZ, 'rialto');
    expect(n).toBeNull();
    const t = normalizeJsonLdEvent(theatre!, 'https://rialto.example/whats-on', TZ, 'rialto')!;
    expect(t.startsAt.toISOString()).toBe('2026-12-03T18:30:00.000Z');
    expect(t.cityHint).toBe('Λεμεσός');
    expect(t.price).toMatchObject({ min: 15, max: 15, currency: 'EUR' });
    expect(t.ticketUrl).toBe('https://tickets.example/1');
    expect(t.images[0]!.url).toBe('https://rialto.example/img/a.jpg');
  });
  it('date-only and offset dates', () => {
    expect(parseSchemaDate('2026-12-04', TZ)).toMatchObject({ precision: 'date_only', localDate: '2026-12-04' });
    expect(parseSchemaDate('2026-12-04T22:30:00Z', TZ)).toMatchObject({ precision: 'exact', localDate: '2026-12-05' });
    expect(parseSchemaDate('soon', TZ)).toBeNull();
  });
});

describe('iCalendar', () => {
  const ics = [
    'BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:a@x', 'SUMMARY:Open-air cinema\\, Larnaca', 'DTSTART;TZID=Asia/Nicosia:20260620T213000', 'DTEND;TZID=Asia/Nicosia:20260620T233000',
    'LOCATION:Finikoudes', 'GEO:34.9131;33.6386', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:b@x', 'SUMMARY:Wine festival', 'DTSTART;VALUE=DATE:20260828', 'DTEND;VALUE=DATE:20260831', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:c@x', 'SUMMARY:Weekly market', 'DTSTART:20260601T060000Z', 'RRULE:FREQ=WEEKLY', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:d@x', 'SUMMARY:Gig', 'STATUS:CANCELLED', 'DTSTART:20260701T180000Z', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const ctx = { source: { key: 'ics', config: {} } } as never;

  it('parses timed, all-day (exclusive DTEND), recurring (skipped) and cancelled events', () => {
    const evs = parseIcs(ics);
    expect(evs).toHaveLength(4);
    const [cinema, fest, weekly, gig] = evs.map((e) => icalConnector.normalize({ externalId: e.uid, payload: e }, ctx) as never as { title: string; startsAt: Date; endsAt: Date | null; localEndDate: string | null; timePrecision: string; status: string; location: unknown } | null);
    expect(cinema!.title).toBe('Open-air cinema, Larnaca');
    expect(cinema!.startsAt.toISOString()).toBe('2026-06-20T18:30:00.000Z'); // EEST
    expect(cinema!.location).toEqual({ lat: 34.9131, lng: 33.6386 });
    expect(fest!.timePrecision).toBe('date_only');
    expect(fest!.localEndDate).toBe('2026-08-30');
    expect(weekly).toBeNull(); // not expanded: we never invent occurrences
    expect(gig!.status).toBe('cancelled');
  });
});

describe('classification & cities', () => {
  it('detects cancellations only from explicit wording (en/el/ru)', () => {
    expect(detectStatus('CANCELLED: Jazz night')).toBe('cancelled');
    expect(detectStatus('Η συναυλία ακυρώνεται')).toBe('cancelled');
    expect(detectStatus('Концерт отменён')).toBe('cancelled');
    expect(detectStatus('Αναβολή παράστασης')).toBe('postponed');
    expect(detectStatus('Cancel culture: a talk')).toBeNull();
  });
  it('classifies real visitcyprus listings', () => {
    expect(classifyEvent('Regatta of Champions', ['Sailing', 'Sports']).primary).toBe('sports-event');
    // Ambiguous labels are resolved by the source's explicit label map (passed as hinted categories).
    expect(classifyEvent('LA TRAVIATA', ['Cultural', 'Musical/opera'], ['classical']).primary).toBe('classical');
    expect(classifyEvent('Cyprus Symphony Orchestra – Starlight 2', ['Cultural', 'Music']).primary).toBe('classical');
    expect(classifyEvent('Some gathering', []).primary).toBe('community-event');
  });
  it('resolves city hints and coordinates', () => {
    expect(cityFromHint('Lefkosia')?.slug).toBe('nicosia');
    expect(cityFromHint('Pano Lefkara')?.slug).toBe('lefkara');
    expect(cityFromHint('Λεμεσός')?.slug).toBe('limassol');
    expect(cityFromHint('Atlantis')).toBeNull();
    expect(cityFromLocation(34.676, 33.044)?.slug).toBe('limassol');
  });
});

describe('notifications', () => {
  it('quiet hours wrap midnight', () => {
    expect(inQuietHours('23:00', '22:00', '09:00')).toBe(true);
    expect(inQuietHours('08:59', '22:00', '09:00')).toBe(true);
    expect(inQuietHours('12:00', '22:00', '09:00')).toBe(false);
    expect(inQuietHours('12:00', '13:00', '15:00')).toBe(false);
  });
});

describe('HTTP client', () => {
  it('never retries around 403/429 and reports them', async () => {
    const http = new HttpClient('passtra-bot/test', 0, fakeFetch([[/x\.example\/a/, () => new Response('no', { status: 403 })]]));
    await expect(http.json('https://x.example/a')).rejects.toBeInstanceOf(HttpError);
  });
  it('treats a 403 on robots.txt as "do not crawl"', async () => {
    const http = new HttpClient('passtra-bot/test', 0, fakeFetch([[/robots\.txt/, () => new Response('', { status: 403 })]]));
    await expect(http.request('https://y.example/events', { respectRobots: true })).rejects.toThrow(/robots\.txt disallows/);
  });
});
