import { DateTime } from 'luxon';
import type { DayPart } from './categories';
import type { Locale } from './locales';

export const DEFAULT_TIMEZONE = 'Europe/Nicosia';
/** Assumed duration for events with a known start but no end — used only for "is it over?" checks. */
export const DEFAULT_EVENT_DURATION_MIN = 180;

const ZONE_ALIASES: Record<string, string> = { 'Asia/Nicosia': 'Europe/Nicosia' };

/** Normalise IANA zone aliases and validate. Falls back to `fallback` for invalid zones. */
export function normalizeZone(tz: string | null | undefined, fallback = DEFAULT_TIMEZONE): string {
  if (!tz) return fallback;
  const z = ZONE_ALIASES[tz] ?? tz;
  return DateTime.now().setZone(z).isValid ? z : fallback;
}

export type LocalTimeAdjustment = 'none' | 'gap' | 'ambiguous';

/**
 * Convert a wall-clock time without offset ("2026-11-19 20:30:00") in `tz` to a UTC instant.
 * - Non-existent times (spring-forward gap) are shifted forward by the gap, flagged 'gap'.
 * - Ambiguous times (fall-back overlap) resolve to the earlier instant (first occurrence), flagged 'ambiguous'.
 */
export function localToUtc(local: string, tz: string): { utc: Date; adjustment: LocalTimeAdjustment } {
  const zone = normalizeZone(tz);
  const iso = local.trim().replace(' ', 'T');
  const dt = DateTime.fromISO(iso, { zone });
  if (!dt.isValid) throw new Error(`Invalid local datetime "${local}" (${dt.invalidExplanation ?? 'unknown'})`);
  const wall = DateTime.fromISO(iso, { zone: 'UTC' });
  const sameWall = dt.hour === wall.hour && dt.minute === wall.minute && dt.day === wall.day;
  if (!sameWall) return { utc: dt.toJSDate(), adjustment: 'gap' };
  // Ambiguity check: is the same wall time also reachable with the other offset?
  const offsets = new Set([dt.offset, dt.minus({ hours: 1 }).offset, dt.plus({ hours: 1 }).offset]);
  for (const off of offsets) {
    if (off === dt.offset) continue;
    const candidate = wall.minus({ minutes: off });
    const back = DateTime.fromJSDate(candidate.toJSDate(), { zone });
    if (back.hour === wall.hour && back.minute === wall.minute && back.offset === off) {
      const earlier = candidate.toMillis() < dt.toMillis() ? candidate.toJSDate() : dt.toJSDate();
      return { utc: earlier, adjustment: 'ambiguous' };
    }
  }
  return { utc: dt.toJSDate(), adjustment: 'none' };
}

/** The calendar date (YYYY-MM-DD) of an instant in a zone. */
export function localDate(instant: Date, tz: string): string {
  return DateTime.fromJSDate(instant, { zone: normalizeZone(tz) }).toISODate()!;
}

export function localTime(instant: Date, tz: string): string {
  return DateTime.fromJSDate(instant, { zone: normalizeZone(tz) }).toFormat('HH:mm');
}

export function dayPartOf(instant: Date, tz: string): DayPart {
  const h = DateTime.fromJSDate(instant, { zone: normalizeZone(tz) }).hour;
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

export type WindowKind = 'now' | 'today' | 'tonight' | 'tomorrow' | 'weekend' | 'this_week' | 'next_7_days';

export interface TimeWindow {
  kind: WindowKind | 'custom';
  start: Date;
  end: Date;
  /** Local calendar dates covered (inclusive), for date-only events. */
  startDate: string;
  endDate: string;
}

function win(kind: TimeWindow['kind'], s: DateTime, e: DateTime): TimeWindow {
  return { kind, start: s.toJSDate(), end: e.toJSDate(), startDate: s.toISODate()!, endDate: e.minus({ milliseconds: 1 }).toISODate()! };
}

/**
 * Time windows evaluated in the user's/city's zone.
 * - tonight: from max(now, 18:00) until 04:00 next morning (after midnight it continues the previous night)
 * - weekend: Friday 17:00 → Monday 00:00; if already inside it, from now
 */
export function timeWindow(kind: WindowKind, now: Date, tz: string): TimeWindow {
  const zone = normalizeZone(tz);
  const n = DateTime.fromJSDate(now, { zone });
  const startOfDay = n.startOf('day');
  switch (kind) {
    case 'now':
      return win('now', n, n.plus({ minutes: 1 }));
    case 'today':
      return win('today', n, startOfDay.plus({ days: 1 }));
    case 'tomorrow':
      return win('tomorrow', startOfDay.plus({ days: 1 }), startOfDay.plus({ days: 2 }));
    case 'tonight': {
      if (n.hour < 4) return win('tonight', n, startOfDay.set({ hour: 4 }));
      const evening = startOfDay.set({ hour: 18 });
      return win('tonight', n > evening ? n : evening, startOfDay.plus({ days: 1 }).set({ hour: 4 }));
    }
    case 'weekend': {
      // Luxon weekday: 1 = Monday … 7 = Sunday
      const daysToFriday = (5 - n.weekday + 7) % 7;
      const friday = startOfDay.plus({ days: n.weekday >= 6 ? -(n.weekday - 5) : daysToFriday }).set({ hour: 17 });
      const mondayStart = friday.startOf('day').plus({ days: 3 });
      return win('weekend', n > friday ? n : friday, mondayStart);
    }
    case 'this_week':
      return win('this_week', n, startOfDay.plus({ days: 8 - n.weekday }));
    case 'next_7_days':
      return win('next_7_days', n, startOfDay.plus({ days: 7 }));
  }
}

export interface EventTiming {
  startsAt: Date;
  endsAt?: Date | null;
  timePrecision: 'exact' | 'date_only';
  timezone: string;
  /** Local start/end dates; required for date_only events. */
  localStartDate?: string;
  localEndDate?: string | null;
}

function effectiveEnd(e: EventTiming): Date {
  if (e.timePrecision === 'date_only') {
    const lastDay = e.localEndDate ?? e.localStartDate ?? localDate(e.startsAt, e.timezone);
    return DateTime.fromISO(lastDay, { zone: normalizeZone(e.timezone) }).plus({ days: 1 }).toJSDate();
  }
  return e.endsAt ?? new Date(e.startsAt.getTime() + DEFAULT_EVENT_DURATION_MIN * 60_000);
}

/** True while the event has not ended yet. Past events must never be listed as upcoming. */
export function isNotOver(e: EventTiming, now: Date): boolean {
  return effectiveEnd(e).getTime() > now.getTime();
}

export function isHappeningNow(e: EventTiming, now: Date): boolean {
  if (e.timePrecision === 'date_only') {
    const today = localDate(now, e.timezone);
    const start = e.localStartDate ?? localDate(e.startsAt, e.timezone);
    const end = e.localEndDate ?? start;
    return today >= start && today <= end;
  }
  return e.startsAt.getTime() <= now.getTime() && isNotOver(e, now);
}

/** Does the event overlap the window? */
export function overlapsWindow(e: EventTiming, w: TimeWindow): boolean {
  if (e.timePrecision === 'date_only') {
    const start = e.localStartDate ?? localDate(e.startsAt, e.timezone);
    const end = e.localEndDate ?? start;
    return start <= w.endDate && end >= w.startDate;
  }
  return e.startsAt.getTime() < w.end.getTime() && effectiveEnd(e).getTime() > w.start.getTime();
}

const L = {
  today: { en: 'Today', el: 'Σήμερα', ru: 'Сегодня' },
  tomorrow: { en: 'Tomorrow', el: 'Αύριο', ru: 'Завтра' },
  now: { en: 'Happening now', el: 'Τώρα', ru: 'Идёт сейчас' },
  noTime: { en: 'time not announced', el: 'η ώρα δεν έχει ανακοινωθεί', ru: 'время не объявлено' },
  allDay: { en: 'all day', el: 'όλη μέρα', ru: 'весь день' },
} satisfies Record<string, Record<Locale, string>>;

/**
 * Human label for an event time in the event's own zone, e.g. "Today · 20:30–22:00",
 * "Sat 15 Nov · 20:30", "12–15 Nov". Never invents a time for date-only events.
 */
export function formatEventTime(e: EventTiming, locale: Locale, now: Date, opts: { allDay?: boolean } = {}): string {
  const zone = normalizeZone(e.timezone);
  const s = DateTime.fromJSDate(e.startsAt, { zone }).setLocale(locale);
  const today = DateTime.fromJSDate(now, { zone }).startOf('day');
  const dayLabel = (d: DateTime) => {
    const diff = Math.round(d.startOf('day').diff(today, 'days').days);
    if (diff === 0) return L.today[locale];
    if (diff === 1) return L.tomorrow[locale];
    return d.toFormat(d.year === today.year ? 'ccc d LLL' : 'ccc d LLL yyyy');
  };

  if (e.timePrecision === 'date_only') {
    const startD = DateTime.fromISO(e.localStartDate ?? s.toISODate()!, { zone }).setLocale(locale);
    const endD = e.localEndDate ? DateTime.fromISO(e.localEndDate, { zone }).setLocale(locale) : startD;
    if (endD.hasSame(startD, 'day')) return `${dayLabel(startD)} · ${opts.allDay ? L.allDay[locale] : L.noTime[locale]}`;
    if (isHappeningNow(e, now)) return `${L.now[locale]} · ${endD.toFormat('d LLL')}`;
    return endD.hasSame(startD, 'month')
      ? `${startD.toFormat('d')}–${endD.toFormat('d LLL')}`
      : `${startD.toFormat('d LLL')} – ${endD.toFormat('d LLL')}`;
  }

  const startStr = s.toFormat('HH:mm');
  if (e.endsAt) {
    const en = DateTime.fromJSDate(e.endsAt, { zone }).setLocale(locale);
    if (en.diff(s, 'hours').hours > 24) {
      return `${s.toFormat('d LLL')} – ${en.toFormat('d LLL')}`;
    }
    return `${dayLabel(s)} · ${startStr}–${en.toFormat('HH:mm')}`;
  }
  return `${dayLabel(s)} · ${startStr}`;
}

/** Minutes between two instants, rounded. */
export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}
