import type { Interval, Locale } from '@passtra/core';
import { normalizeZone } from '@passtra/core';
import { DateTime } from 'luxon';
import OpeningHours from 'opening_hours';

/**
 * Evaluates OSM `opening_hours` strings in the place's own time zone.
 * The library reads local Date fields, so we hand it "wall-clock" Dates (local fields = time in `tz`)
 * and convert results back. Processes run with TZ=UTC so wall-clock Dates never hit a DST gap.
 * Unparseable values or public-holiday rules we can't evaluate → "unknown" (never guessed).
 */

const toWall = (instant: Date, tz: string): Date => {
  const d = DateTime.fromJSDate(instant, { zone: normalizeZone(tz) });
  return new Date(d.year, d.month - 1, d.day, d.hour, d.minute, d.second);
};
const fromWall = (wall: Date, tz: string): Date =>
  DateTime.fromObject({ year: wall.getFullYear(), month: wall.getMonth() + 1, day: wall.getDate(), hour: wall.getHours(), minute: wall.getMinutes(), second: wall.getSeconds() }, { zone: normalizeZone(tz) }).toJSDate();

/**
 * The opening_hours library has no public-holiday (PH) calendar for Cyprus. Greece's calendar
 * (also Orthodox-Easter based) matches Cyprus except on the dates below, where a PH rule's
 * outcome is reported as unknown instead of guessed.
 */
const PH_PROXY: Record<string, string> = { cy: 'gr' };

/** Orthodox Easter Sunday (Gregorian calendar), valid 1900–2099. */
export function orthodoxEaster(year: number): { month: number; day: number } {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const julianMonth = Math.floor((d + e + 114) / 31);
  const julianDay = ((d + e + 114) % 31) + 1;
  const g = DateTime.utc(year, julianMonth, julianDay).plus({ days: 13 });
  return { month: g.month, day: g.day };
}

/** Cyprus public holidays that the Greek calendar lacks (1 Apr, 1 Oct, Easter Tuesday) plus 24 Dec (varies). */
export function cyprusPhDifferences(year: number): string[] {
  const e = orthodoxEaster(year);
  const tue = DateTime.utc(year, e.month, e.day).plus({ days: 2 });
  return [`${year}-04-01`, `${year}-10-01`, tue.toISODate()!, `${year}-12-24`];
}

function phUncertain(value: string, countryCode: string, wall: Date): boolean {
  if (countryCode.toLowerCase() !== 'cy' || !/\bPH\b/.test(value)) return false;
  const iso = `${wall.getFullYear()}-${String(wall.getMonth() + 1).padStart(2, '0')}-${String(wall.getDate()).padStart(2, '0')}`;
  return cyprusPhDifferences(wall.getFullYear()).includes(iso);
}

const cache = new Map<string, OpeningHours | null>();
function parse(value: string, lat: number, lng: number, countryCodeIn: string): OpeningHours | null {
  const countryCode = PH_PROXY[countryCodeIn.toLowerCase()] ?? countryCodeIn;
  const key = `${countryCode}|${value}`;
  if (cache.has(key)) return cache.get(key)!;
  let oh: OpeningHours | null = null;
  try {
    oh = new OpeningHours(value, { lat, lon: lng, address: { country_code: countryCode.toLowerCase(), state: '' } }, { mode: 0, tag_key: 'opening_hours', map_value: true, warnings_severity: 0 } as never);
  } catch {
    oh = null;
  }
  if (cache.size > 5000) cache.clear();
  cache.set(key, oh);
  return oh;
}

export interface HoursEval {
  openNow: boolean | null;
  nextChange: Date | null;
  label: string | null;
  raw: string;
  weekText: string[];
}

const L = {
  open24: { en: 'Open 24 hours', el: 'Ανοιχτό 24 ώρες', ru: 'Круглосуточно' },
  closes: { en: 'Open · closes {t}', el: 'Ανοιχτό · κλείνει {t}', ru: 'Открыто · до {t}' },
  opens: { en: 'Closed · opens {t}', el: 'Κλειστό · ανοίγει {t}', ru: 'Закрыто · откроется в {t}' },
  opensDay: { en: 'Closed · opens {d} {t}', el: 'Κλειστό · ανοίγει {d} {t}', ru: 'Закрыто · откроется {d} в {t}' },
  open: { en: 'Open now', el: 'Ανοιχτό τώρα', ru: 'Открыто' },
  closed: { en: 'Closed now', el: 'Κλειστό τώρα', ru: 'Закрыто' },
} satisfies Record<string, Record<Locale, string>>;

export function evaluateHours(value: string | null | undefined, at: Date, tz: string, lat: number, lng: number, locale: Locale, countryCode = 'CY'): HoursEval | null {
  if (!value) return null;
  const oh = parse(value, lat, lng, countryCode);
  const weekText = value.split(';').map((s) => s.trim()).filter(Boolean);
  if (!oh) return { openNow: null, nextChange: null, label: null, raw: value, weekText };
  try {
    const wall = toWall(at, tz);
    if (phUncertain(value, countryCode, wall) || oh.getUnknown(wall)) return { openNow: null, nextChange: null, label: null, raw: value, weekText };
    const open = oh.getState(wall);
    const next = oh.getNextChange(wall, new Date(wall.getTime() + 8 * 86_400_000));
    const nextInstant = next ? fromWall(next, tz) : null;
    let label: string;
    if (!nextInstant) label = open ? L.open24[locale] : L.closed[locale];
    else {
      const n = DateTime.fromJSDate(nextInstant, { zone: normalizeZone(tz) }).setLocale(locale);
      const t = n.toFormat('HH:mm');
      const sameDay = n.hasSame(DateTime.fromJSDate(at, { zone: normalizeZone(tz) }), 'day');
      label = open ? L.closes[locale].replace('{t}', t) : sameDay ? L.opens[locale].replace('{t}', t) : L.opensDay[locale].replace('{d}', n.toFormat('ccc')).replace('{t}', t);
    }
    return { openNow: open, nextChange: nextInstant, label, raw: value, weekText };
  } catch {
    return { openNow: null, nextChange: null, label: null, raw: value, weekText };
  }
}

/** Open intervals between two instants (for Plan My Day). Undefined = hours unknown. */
export function openIntervals(value: string | null | undefined, from: Date, to: Date, tz: string, lat: number, lng: number, countryCode = 'CY'): Interval[] | undefined {
  if (!value) return undefined;
  const oh = parse(value, lat, lng, countryCode);
  if (!oh) return undefined;
  try {
    if (phUncertain(value, countryCode, toWall(from, tz)) || phUncertain(value, countryCode, toWall(new Date(to.getTime() - 1), tz))) return undefined;
    const list = oh.getOpenIntervals(toWall(from, tz), toWall(to, tz));
    if (list.some(([, , unknown]) => unknown)) return undefined;
    return list.map(([s, e]) => ({ start: fromWall(s, tz), end: fromWall(e, tz) }));
  } catch {
    return undefined;
  }
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD (local)
  weekday: string; // localized short name
  /** Open intervals that day as HH:mm (several = breaks in between). Empty = closed. null = not known that day. */
  intervals: Array<[string, string]> | null;
  publicHoliday: boolean;
}

let PH_PROBE: OpeningHours | null = null;
/** Cyprus public holiday? (Greek Orthodox calendar via the opening_hours library + Cyprus-specific dates.) */
export function isCyprusPublicHoliday(date: DateTime): boolean {
  const iso = date.toISODate()!;
  if (cyprusPhDifferences(date.year).includes(iso)) return true;
  try {
    PH_PROBE ??= new OpeningHours('PH 00:00-24:00', { lat: 35, lon: 33, address: { country_code: 'gr', state: '' } }, { mode: 0, tag_key: 'opening_hours', map_value: true, warnings_severity: 0 } as never);
    return PH_PROBE.getState(new Date(date.year, date.month - 1, date.day, 12, 0));
  } catch {
    return false;
  }
}

/**
 * The next 7 days of opening hours (Cyprus time), day by day: intervals with breaks, closed days, public
 * holidays flagged. Days whose hours can't be determined are null — never guessed.
 */
export function weeklySchedule(value: string | null | undefined, from: Date, tz: string, lat: number, lng: number, locale: Locale, countryCode = 'CY'): DaySchedule[] | null {
  if (!value) return null;
  const oh = parse(value, lat, lng, countryCode);
  if (!oh) return null;
  const zone = normalizeZone(tz);
  const start = DateTime.fromJSDate(from, { zone }).startOf('day');
  const out: DaySchedule[] = [];
  for (let i = 0; i < 8; i++) { // one extra day so the 7th day's after-midnight hours are known
    const day = start.plus({ days: i });
    const next = day.plus({ days: 1 });
    const ivs = openIntervals(value, day.toJSDate(), next.toJSDate(), tz, lat, lng, countryCode);
    const fmt = (d: Date) => {
      const t = DateTime.fromJSDate(d, { zone });
      return t >= next ? '24:00' : t.toFormat('HH:mm');
    };
    out.push({
      date: day.toISODate()!, weekday: day.setLocale(locale).toFormat('ccc'),
      intervals: ivs ? ivs.map((iv) => [fmt(iv.start), fmt(iv.end)] as [string, string]) : null,
      publicHoliday: isCyprusPublicHoliday(day),
    });
  }
  // After-midnight hours belong to the evening before: "08:00–24:00" + next day "00:00–02:00" → "08:00–02:00".
  for (let i = 0; i < out.length; i++) {
    const cur = out[i]!.intervals;
    const nxt = out[i + 1]?.intervals;
    if (!cur?.length) continue;
    const last = cur[cur.length - 1]!;
    if (last[1] === '24:00' && nxt?.length && nxt[0]![0] === '00:00' && nxt[0]![1] !== '24:00') {
      last[1] = nxt[0]![1];
      nxt.shift();
    }
  }
  // The first day may still start with the tail of the night before; it isn't an opening of that day.
  const first = out[0]?.intervals;
  if (first?.length && first[0]![0] === '00:00' && first[0]![1] !== '24:00' && first.length > 1) first.shift();
  return out.slice(0, 7);
}

/** The public-holiday rule of an opening_hours value, if any (e.g. "PH off", "PH 10:00-14:00"). */
export function holidayRule(value: string | null | undefined): string | null {
  if (!value) return null;
  const seg = value.split(';').map((s) => s.trim()).find((s) => /\bPH\b/.test(s));
  return seg ?? null;
}
