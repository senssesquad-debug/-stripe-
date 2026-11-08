import type { EntityDTO } from '@passtra/core';
import i18n from '@/i18n';
import type { MyEvent } from './api';

export const CYPRUS_TZ = 'Europe/Nicosia';
/** Aliases of Cyprus time (Asia/Nicosia is the same zone; Asia/Famagusta has used the same offsets since 2017). */
const CYPRUS_ALIASES = new Set(['Europe/Nicosia', 'Asia/Nicosia', 'Asia/Famagusta']);
export const deviceTz = (): string => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || CYPRUS_TZ;
    return CYPRUS_ALIASES.has(tz) ? CYPRUS_TZ : tz;
  } catch {
    return CYPRUS_TZ;
  }
};
export const REMINDERS = [null, 0, 10, 30, 60, 120, 1440, 2880, 10080] as const;

export function reminderLabel(m: number | null): string {
  const t = i18n.t.bind(i18n);
  if (m === null) return t('myEvents.none');
  if (m === 0) return t('myEvents.atStart');
  if (m < 60) return t('myEvents.min', { count: m });
  if (m < 1440) return t('myEvents.hours', { count: m / 60 });
  if (m === 1440) return t('myEvents.day');
  if (m === 10080) return t('myEvents.week');
  return t('myEvents.days', { count: m / 1440 });
}

/** The same instant shown in the device's zone — only when that differs from the event's zone. */
export function inDeviceTime(iso: string, eventTz: string): string | null {
  const tz = deviceTz();
  if (tz === eventTz || (CYPRUS_ALIASES.has(tz) && CYPRUS_ALIASES.has(eventTz))) return null;
  try {
    return new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz, timeZoneName: 'short' }).format(new Date(iso));
  } catch {
    return null;
  }
}

export function formatInstant(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Today's date in a zone as YYYY-MM-DD. */
export function todayIn(tz: string, addDays = 0): string {
  const d = new Date(Date.now() + addDays * 86_400_000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Route params that pre-fill the editor from a passtra event or place ("Add to My events"). */
export function prefillFrom(e: EntityDTO): Record<string, string> {
  if (e.type === 'event') {
    const exact = e.time.precision === 'exact';
    return {
      title: e.title, entityType: 'event', entityId: e.id, tz: e.time.timezone,
      date: e.time.localStartDate,
      startTime: exact ? e.time.startsAt.slice(11, 16) : '',
      endTime: exact && e.time.endsAt ? e.time.endsAt.slice(11, 16) : '',
      endDate: exact && e.time.endsAt && e.time.endsAt.slice(0, 10) !== e.time.startsAt.slice(0, 10) ? e.time.endsAt.slice(0, 10) : '',
      locName: e.venue.name ?? '', address: e.venue.address ?? '',
      lat: e.location ? String(e.location.lat) : '', lng: e.location ? String(e.location.lng) : '',
    };
  }
  return {
    title: e.name, entityType: 'place', entityId: e.id, tz: CYPRUS_TZ, locName: e.name, address: [e.address, e.city?.name].filter(Boolean).join(', '),
    lat: String(e.location.lat), lng: String(e.location.lng),
  };
}

export const reminderStatusText = (ev: MyEvent): string | null => {
  if (!ev.reminder) return null;
  const s = ev.reminder.status;
  if (s === 'scheduled') return ev.reminder.at ? i18n.t('myEvents.reminderStatus_scheduled', { time: formatInstant(ev.reminder.at, ev.timezone) }) : null;
  return i18n.t(`myEvents.reminderStatus_${s}`);
};
