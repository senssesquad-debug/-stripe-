import { GROUP_LABELS, pickText, type InterestGroup, type Locale, type PlanDayResponse } from '@passtra/core';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { EntityRow } from '@/components/cards';
import { Badge, Button, Chip, EmptyState, ErrorState, Icon, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useDiscoveryParams } from '@/lib/location';
import { CYPRUS_TZ, todayIn } from '@/lib/my-events';
import { useAppState } from '@/lib/store';
import { useTheme } from '@/theme';

const START_HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
/** End options; 00:00–02:00 mean "after midnight" (a night out). */
const END_HOURS = ['12:00', '14:00', '16:00', '18:00', '20:00', '21:00', '22:00', '23:00', '00:00', '01:00', '02:00'];
const GROUPS: InterestGroup[] = ['food', 'culture', 'nature', 'music', 'nightlife', 'family', 'shopping', 'art', 'adventure', 'sports'];
const mins = (h: string) => { const [a, b] = h.split(':').map(Number); return a! * 60 + b!; };
/** End as minutes after the start day's midnight (after-midnight ends count as the next day). */
const endMins = (h: string) => (mins(h) <= 4 * 60 ? mins(h) + 24 * 60 : mins(h));

/** Current time in Cyprus as minutes since midnight (the plan is always in Cyprus time, whatever the phone's zone). */
function cyprusNowMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: CYPRUS_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === 'hour')?.value) * 60 + Number(parts.find((p) => p.type === 'minute')?.value);
}

function dayOptions(locale: string, t: (k: string) => string) {
  const out: Array<{ date: string; label: string }> = [{ date: todayIn(CYPRUS_TZ), label: t('time.today') }, { date: todayIn(CYPRUS_TZ, 1), label: t('time.tomorrow') }];
  for (let i = 2; i < 8 && out.length < 4; i++) {
    const date = todayIn(CYPRUS_TZ, i);
    const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (wd === 6 || wd === 0) out.push({ date, label: new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) });
  }
  return out;
}

export default function Plan() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const p = useDiscoveryParams();
  const saved = useAppState((s) => s.interests);
  const days = useMemo(() => dayOptions(locale, t), [locale, t]);
  const nowMin = cyprusNowMinutes();
  // Late in the evening, default to tomorrow instead of an almost-finished today.
  const [date, setDate] = useState(nowMin >= 20 * 60 ? days[1]!.date : days[0]!.date);
  const isToday = date === days[0]!.date;
  const firstStart = isToday ? START_HOURS.find((h) => mins(h) > nowMin) : START_HOURS[2];
  const [start, setStart] = useState(firstStart ?? '10:00');
  const [end, setEnd] = useState('22:00');
  const [budget, setBudget] = useState<number | null>(null);
  const [mode, setMode] = useState<'walk' | 'drive' | 'auto'>('auto');
  const [interests, setInterests] = useState<InterestGroup[]>(saved.filter((g) => GROUPS.includes(g)).slice(0, 3));
  const m = useMutation<PlanDayResponse, Error>({ mutationFn: () => api.planDay({ lat: p.lat, lng: p.lng, city: p.city, date, start, end, budget, interests, mode }) });

  const startOk = (h: string) => !isToday || mins(h) > nowMin - 60;
  const chooseDay = (d: string) => {
    setDate(d);
    m.reset();
    if (d === days[0]!.date && !START_HOURS.some((h) => h === start && mins(h) > nowMin - 60)) setStart(START_HOURS.find((h) => mins(h) > nowMin) ?? '22:00');
  };
  const chooseStart = (h: string) => {
    setStart(h);
    if (endMins(end) <= mins(h) + 60) setEnd(END_HOURS.find((e) => endMins(e) >= mins(h) + 120) ?? '02:00');
  };
  const planTomorrow = () => { chooseDay(days[1]!.date); setStart('10:00'); setEnd('22:00'); setTimeout(() => m.mutate(), 0); };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 48 }}>
      <Txt v="display" accessibilityRole="header">{t('plan.title')}</Txt>
      <View style={{ gap: 8 }}>
        <Txt v="headline">{t('plan.day')}</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{days.map((d) => <Chip key={d.date} label={d.label} active={date === d.date} onPress={() => chooseDay(d.date)} />)}</View>
        <Txt v="headline">{t('plan.from')}</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {START_HOURS.filter(startOk).map((h) => <Chip key={h} label={h} active={start === h} onPress={() => chooseStart(h)} />)}
        </ScrollView>
        <Txt v="headline">{t('plan.to')}</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {END_HOURS.filter((h) => endMins(h) >= mins(start) + 60).map((h) => (
            <Chip key={h} label={endMins(h) >= 24 * 60 ? `${h} (+1)` : h} active={end === h} onPress={() => setEnd(h)} />
          ))}
        </ScrollView>
        <Txt v="caption" tone="tertiary">{t('plan.cyprusTime')}</Txt>
      </View>
      <View style={{ gap: 8 }}>
        <Txt v="headline">{t('plan.budget')}</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[null, 0, 20, 50, 100].map((b) => <Chip key={String(b)} label={b === null ? t('plan.noLimit') : b === 0 ? t('common.free') : `€${b}`} active={budget === b} onPress={() => setBudget(b)} />)}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Txt v="headline">{t('plan.interests')}</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {GROUPS.map((g) => <Chip key={g} label={pickText(GROUP_LABELS[g], locale)} active={interests.includes(g)} onPress={() => setInterests((x) => (x.includes(g) ? x.filter((y) => y !== g) : [...x, g]))} />)}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Txt v="headline">{t('plan.transport')}</Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>{(['auto', 'walk', 'drive'] as const).map((x) => <Chip key={x} label={t(`plan.${x}`)} active={mode === x} onPress={() => setMode(x)} />)}</View>
      </View>
      <Button title={t('plan.build')} icon="map-marker-path" loading={m.isPending} onPress={() => m.mutate()} />

      {m.isError ? <ErrorState error={m.error} onRetry={() => m.mutate()} /> : null}
      {m.data && m.data.stops.length === 0 ? (
        m.data.reason === 'window_passed'
          ? <EmptyState icon="clock-alert-outline" title={t('plan.windowPassed')} action={{ label: t('plan.planTomorrow'), onPress: planTomorrow }} />
          : <EmptyState icon="calendar-remove-outline" title={t('plan.empty')} />
      ) : null}
      {m.data && m.data.stops.length > 0 && isToday && m.data.window.start !== start ? <Txt v="caption" tone="secondary">{t('plan.fromNow', { time: m.data.window.start })}</Txt> : null}
      {m.data && m.data.stops.length > 0 ? (
        <View style={{ gap: 4 }}>
          {m.data.stops.map((s, i) => (
            <View key={`${s.entity.id}-${i}`} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 54, alignItems: 'center' }}>
                <Txt v="bodyStrong">{s.arriveLabel}</Txt>
                <Txt v="caption" tone="tertiary">{s.departLabel}</Txt>
                {i < m.data!.stops.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: th.c.border, marginVertical: 4 }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: 12 }}>
                {i > 0 && s.travelMinFromPrev > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name={s.travelMode === 'walk' ? 'walk' : 'car'} size={14} color={th.c.textTertiary} />
                    <Txt v="caption" tone="tertiary">{t('plan.travel', { min: s.travelMinFromPrev, mode: t(s.travelMode === 'walk' ? 'plan.walking' : 'plan.driving') })}</Txt>
                  </View>
                ) : null}
                <EntityRow entity={s.entity} />
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {s.notes.includes('meal') ? <Badge label={t('plan.meal')} tone="primary" /> : null}
                  {s.notes.includes('fixed_time') ? <Badge label={t('plan.fixedTime')} /> : null}
                  {s.notes.includes('hours_unknown') ? <Badge label={t('plan.hoursUnknown')} tone="warning" /> : null}
                  {s.notes.includes('price_unknown') ? <Badge label={t('common.priceUnknown')} tone="warning" /> : null}
                </View>
              </View>
            </View>
          ))}
          <View style={{ padding: 14, borderRadius: th.radius.md, backgroundColor: th.c.surface, gap: 4 }}>
            <Txt v="bodyStrong">{t('plan.total', { amount: `€${m.data.totalKnownCost}` })}{m.data.stopsWithUnknownPrice ? ` · ${t('plan.unknownPrices', { count: m.data.stopsWithUnknownPrice })}` : ''}</Txt>
            <Txt v="caption" tone="secondary">{m.data.disclaimer}</Txt>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
