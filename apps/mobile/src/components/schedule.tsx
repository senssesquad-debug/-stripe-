import type { EventDTO, PlaceDTO } from '@passtra/core';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { DaySchedule } from '@/lib/api';
import { useTheme } from '@/theme';
import { Badge, Icon, Txt } from './ui';

const tzFmt = (iso: string, opts: Intl.DateTimeFormatOptions, locale: string) => new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'Europe/Nicosia' }).format(new Date(iso));

/** Opening hours: status now, the next 7 days (breaks, closed days, public holidays), holiday rule. Unknown is said so. */
export function PlaceHours({ place, week, holidayRule }: { place: PlaceDTO; week: DaySchedule[] | null; holidayRule: string | null }) {
  const th = useTheme();
  const { t } = useTranslation();
  const h = place.hours;
  const hol = holidayRule ? (/\bPH\s+off\b/i.test(holidayRule) ? t('hours.phClosed') : t('hours.phHours', { rule: holidayRule.replace(/\bPH\b\s*/i, '').replace(/-/g, '–') })) : null;
  return (
    <View style={{ gap: 10, padding: 16, borderRadius: th.radius.lg, backgroundColor: th.c.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Icon name="clock-outline" size={20} color={th.c.primaryText} />
        <Txt v="headline" style={{ flex: 1 }}>{t('detail.hours')}</Txt>
        {h.openNow === true ? <Badge label={t('hours.openNow')} tone="success" /> : h.openNow === false ? <Badge label={t('hours.closedNow')} tone="danger" /> : null}
      </View>
      {h.label ? <Txt v="callout" tone="secondary">{h.label}</Txt> : null}
      {week ? week.map((d, i) => (
        <View key={d.date} style={{ flexDirection: 'row', gap: 12, paddingVertical: 3 }} accessibilityLabel={`${d.weekday}: ${d.intervals === null ? t('hours.unknownDay') : d.intervals.length ? d.intervals.map((x) => x.join('–')).join(', ') : t('hours.closed')}`}>
          <Txt v={i === 0 ? 'bodyStrong' : 'callout'} style={{ width: 92 }}>{i === 0 ? t('time.today') : d.weekday} <Txt v="caption" tone="tertiary">{d.date.slice(8)}.{d.date.slice(5, 7)}</Txt></Txt>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {d.intervals === null ? <Txt v="callout" tone="tertiary">{t('hours.unknownDay')}</Txt>
              : d.intervals.length === 0 ? <Txt v="callout" tone="secondary">{t('hours.closed')}</Txt>
              : <Txt v={i === 0 ? 'bodyStrong' : 'callout'}>{d.intervals.map((x) => (x[0] === '00:00' && x[1] === '24:00' ? t('hours.allDay') : x.join('–'))).join(', ')}</Txt>}
            {d.publicHoliday ? <Badge label={t('hours.holiday')} tone="warning" /> : null}
          </View>
        </View>
      )) : <Txt v="callout" tone="secondary">{h.raw ? t('hours.cantRead', { raw: h.raw }) : t('hours.notListed')}</Txt>}
      {hol ? <Txt v="caption" tone="secondary">{hol}</Txt> : null}
      <Txt v="caption" tone="tertiary">{t('hours.tzNote')}</Txt>
    </View>
  );
}

/** Event schedule: dates (all days of a multi-day event), doors (if different), start, end, duration — Cyprus time. */
export function EventSchedule({ event }: { event: EventDTO }) {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const tm = event.time;
  const L = i18n.language;
  const row = (label: string, value: string, strong = false) => (
    <View style={{ flexDirection: 'row', gap: 12 }} key={label}>
      <Txt v="callout" tone="secondary" style={{ width: 110 }}>{label}</Txt>
      <Txt v={strong ? 'bodyStrong' : 'callout'} style={{ flex: 1 }}>{value}</Txt>
    </View>
  );
  const date = tzFmt(tm.startsAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, L);
  const hhmm = (iso: string) => tzFmt(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, L);
  const multi = !!tm.days && tm.days.length > 1;
  const dm = (iso: string) => tzFmt(iso, { day: 'numeric', month: 'short' }, L);
  const dur = tm.durationMin ? (tm.durationMin >= 60 ? t('route.hm', { h: Math.floor(tm.durationMin / 60), m: tm.durationMin % 60 }) : t('route.m', { m: tm.durationMin })) : null;
  return (
    <View style={{ gap: 8, padding: 16, borderRadius: th.radius.lg, backgroundColor: th.c.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="calendar-clock" size={20} color={th.c.primaryText} />
        <Txt v="headline" style={{ flex: 1 }}>{t('schedule.title')}</Txt>
        {tm.happeningNow ? <Badge label={t('card.now')} tone="success" /> : null}
      </View>
      {tm.days && tm.days.length > 1 ? (
        <>
          {row(t('schedule.dates'), `${tzFmt(`${tm.days[0]}T12:00:00+02:00`, { day: 'numeric', month: 'long' }, L)} – ${tzFmt(`${tm.days[tm.days.length - 1]}T12:00:00+02:00`, { day: 'numeric', month: 'long', year: 'numeric' }, L)}`, true)}
          {row(t('schedule.days'), String(tm.days.length))}
        </>
      ) : row(t('schedule.date'), date, true)}
      {tm.precision === 'exact' ? (
        <>
          {tm.doorsAt ? row(t('schedule.doors'), hhmm(tm.doorsAt)) : null}
          {/* Multi-day: start and end carry their dates; daily hours aren't known, so no per-day times are implied. */}
          {row(t('schedule.start'), multi ? `${dm(tm.startsAt)}, ${hhmm(tm.startsAt)}` : hhmm(tm.startsAt), true)}
          {row(t('schedule.end'), tm.endsAt ? (multi ? `${dm(tm.endsAt)}, ${hhmm(tm.endsAt)}` : hhmm(tm.endsAt)) : t('schedule.notListed'))}
          {dur && !multi ? row(t('schedule.duration'), dur) : null}
        </>
      ) : row(t('schedule.time'), t('schedule.timeNotListed'))}
      {tm.unconfirmed ? <Txt v="caption" tone="warning">{t('card.unconfirmedTime')}</Txt> : null}
      <Txt v="caption" tone="tertiary">{t('detail.timezoneNote', { tz: tm.timezone })}</Txt>
    </View>
  );
}
