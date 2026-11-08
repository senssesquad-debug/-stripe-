import { describe, expect, it } from 'vitest';
import { formatEventTime, isHappeningNow, isNotOver, localDate, localToUtc, normalizeZone, overlapsWindow, timeWindow, type EventTiming } from '../src/time';

const TZ = 'Europe/Nicosia';

describe('zones', () => {
  it('normalises Asia/Nicosia (as sent by visitcyprus.com) to Europe/Nicosia', () => {
    expect(normalizeZone('Asia/Nicosia')).toBe('Europe/Nicosia');
    expect(normalizeZone('Not/AZone')).toBe('Europe/Nicosia');
    expect(normalizeZone('Asia/Famagusta')).toBe('Asia/Famagusta');
  });
});

describe('local wall time → UTC with DST (Cyprus: last Sunday of March / October)', () => {
  it('winter time is UTC+2', () => {
    const { utc, adjustment } = localToUtc('2026-11-19 20:30:00', TZ);
    expect(utc.toISOString()).toBe('2026-11-19T18:30:00.000Z');
    expect(adjustment).toBe('none');
  });
  it('summer time is UTC+3', () => {
    expect(localToUtc('2026-07-01T21:00', TZ).utc.toISOString()).toBe('2026-07-01T18:00:00.000Z');
  });
  it('spring-forward gap (29 Mar 2026 03:00–04:00 does not exist) is shifted and flagged', () => {
    const { utc, adjustment } = localToUtc('2026-03-29 03:30', TZ);
    expect(adjustment).toBe('gap');
    expect(utc.toISOString()).toBe('2026-03-29T01:30:00.000Z'); // = 04:30 EEST
  });
  it('fall-back overlap (25 Oct 2026 03:00–04:00 happens twice) resolves to the first occurrence', () => {
    const { utc, adjustment } = localToUtc('2026-10-25 03:30', TZ);
    expect(adjustment).toBe('ambiguous');
    expect(utc.toISOString()).toBe('2026-10-25T00:30:00.000Z'); // 03:30 EEST (UTC+3)
  });
  it('rejects garbage', () => {
    expect(() => localToUtc('tomorrow evening', TZ)).toThrow();
  });
});

describe('windows', () => {
  // Sunday 8 Nov 2026, 15:00 local = 13:00Z
  const sundayAfternoon = new Date('2026-11-08T13:00:00Z');
  it('today runs until local midnight', () => {
    const w = timeWindow('today', sundayAfternoon, TZ);
    expect(w.end.toISOString()).toBe('2026-11-08T22:00:00.000Z');
  });
  it('tonight is 18:00–04:00 local', () => {
    const w = timeWindow('tonight', sundayAfternoon, TZ);
    expect(w.start.toISOString()).toBe('2026-11-08T16:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-11-09T02:00:00.000Z');
  });
  it('after midnight, tonight continues the previous night', () => {
    const w = timeWindow('tonight', new Date('2026-11-08T23:30:00Z'), TZ); // 01:30 local Monday
    expect(w.end.toISOString()).toBe('2026-11-09T02:00:00.000Z');
  });
  it('weekend on a Sunday starts now and ends Monday 00:00', () => {
    const w = timeWindow('weekend', sundayAfternoon, TZ);
    expect(w.start.toISOString()).toBe(sundayAfternoon.toISOString());
    expect(w.end.toISOString()).toBe('2026-11-08T22:00:00.000Z');
  });
  it('weekend on a Wednesday is the coming Friday 17:00 → Monday', () => {
    const w = timeWindow('weekend', new Date('2026-11-11T09:00:00Z'), TZ);
    expect(w.start.toISOString()).toBe('2026-11-13T15:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-11-15T22:00:00.000Z');
    expect(w.startDate).toBe('2026-11-13');
    expect(w.endDate).toBe('2026-11-15');
  });
});

describe('event timing', () => {
  const concert: EventTiming = { startsAt: new Date('2026-11-19T18:30:00Z'), endsAt: new Date('2026-11-19T20:00:00Z'), timePrecision: 'exact', timezone: TZ };
  const allDayMultiDay: EventTiming = { startsAt: new Date('2026-11-07T22:00:00Z'), timePrecision: 'date_only', timezone: TZ, localStartDate: '2026-11-08', localEndDate: '2026-11-15' };

  it('a finished event is over', () => {
    expect(isNotOver(concert, new Date('2026-11-19T20:01:00Z'))).toBe(false);
    expect(isNotOver(concert, new Date('2026-11-19T19:59:00Z'))).toBe(true);
  });
  it('an event without end time is assumed over 3h after start', () => {
    const e: EventTiming = { startsAt: new Date('2026-11-19T18:30:00Z'), timePrecision: 'exact', timezone: TZ };
    expect(isNotOver(e, new Date('2026-11-19T21:29:00Z'))).toBe(true);
    expect(isNotOver(e, new Date('2026-11-19T21:31:00Z'))).toBe(false);
  });
  it('multi-day all-day events are happening on each local day and end at local midnight after the last day', () => {
    expect(isHappeningNow(allDayMultiDay, new Date('2026-11-10T10:00:00Z'))).toBe(true);
    expect(isNotOver(allDayMultiDay, new Date('2026-11-15T21:59:00Z'))).toBe(true);
    expect(isNotOver(allDayMultiDay, new Date('2026-11-15T22:00:00Z'))).toBe(false);
  });
  it('window overlap', () => {
    const tonight = timeWindow('tonight', new Date('2026-11-19T10:00:00Z'), TZ);
    expect(overlapsWindow(concert, tonight)).toBe(true);
    const weekend = timeWindow('weekend', new Date('2026-11-11T09:00:00Z'), TZ);
    expect(overlapsWindow(allDayMultiDay, weekend)).toBe(true);
  });
  it('localDate uses the event zone, not UTC', () => {
    expect(localDate(new Date('2026-11-19T22:30:00Z'), TZ)).toBe('2026-11-20');
  });
  it('labels never invent a time for date-only events', () => {
    const single: EventTiming = { startsAt: new Date('2026-11-12T22:00:00Z'), timePrecision: 'date_only', timezone: TZ, localStartDate: '2026-11-13' };
    expect(formatEventTime(single, 'en', new Date('2026-11-08T10:00:00Z'))).toBe('Fri 13 Nov · time not announced');
    expect(formatEventTime(single, 'ru', new Date('2026-11-08T10:00:00Z'))).toContain('время не объявлено');
    expect(formatEventTime(concert, 'en', new Date('2026-11-19T08:00:00Z'))).toBe('Today · 20:30–22:00');
    expect(formatEventTime(concert, 'en', new Date('2026-11-18T08:00:00Z'))).toBe('Tomorrow · 20:30–22:00');
    expect(formatEventTime(allDayMultiDay, 'en', new Date('2026-11-01T08:00:00Z'))).toBe('8–15 Nov');
  });
});
