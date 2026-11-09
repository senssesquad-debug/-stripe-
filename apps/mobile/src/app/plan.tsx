import { GROUP_LABELS, pickText, type EntityDTO, type InterestGroup, type Locale, type PlanDayResponse, type PlanStopDTO } from '@passtra/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, TextInput, View } from 'react-native';
import { Cover, openEntity } from '@/components/cards';
import { Badge, Banner, Button, Chip, EmptyState, ErrorState, Icon, Tap, Txt } from '@/components/ui';
import { api, type PlanItem, type PlanParams, type TripType } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { showToast } from '@/lib/feedback';
import { WEB_URL } from '@/lib/share';
import { Platform, Share } from 'react-native';
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

const TRIPS: TripType[] = ['balanced', 'relaxed', 'active', 'culture', 'family', 'nightlife', 'foodie'];
const DISTANCES: Array<number | null> = [2, 5, 10, 25, null];

const itemOf = (st: PlanStopDTO): PlanItem => (st.entity
  ? { kind: st.entity.type, id: st.entity.id, ...(st.entity.type === 'place' ? { durationMin: st.durationMin } : {}) }
  : { kind: 'custom', title: st.custom?.title ?? '', lat: st.custom?.lat ?? null, lng: st.custom?.lng ?? null, durationMin: st.durationMin });
const locOf = (st: PlanStopDTO) => (st.entity?.type === 'place' ? st.entity.location : st.entity?.type === 'event' && st.entity.location ? st.entity.location : st.custom?.lat != null && st.custom.lng != null ? { lat: st.custom.lat, lng: st.custom.lng } : null);
const blurb = (e: EntityDTO | null) => {
  if (!e) return null;
  const text = e.type === 'place' ? e.about?.text ?? e.description : e.description;
  return text ? (text.length > 160 ? `${text.slice(0, 160).replace(/\s+\S*$/, '')}…` : text) : null;
};

function StopCard({ st, i, total, onReplace, onRemove, onMove }: { st: PlanStopDTO; i: number; total: number; onReplace: () => void; onRemove: () => void; onMove: (d: -1 | 1) => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  const e = st.entity;
  const title = e ? (e.type === 'place' ? e.name : e.title) : st.custom?.title ?? '';
  const address = e ? (e.type === 'place' ? [e.address, e.city?.name].filter(Boolean).join(', ') : [e.venue.name, e.venue.address, e.city?.name].filter(Boolean).join(', ')) : null;
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 52, alignItems: 'center' }}>
        <Txt v="bodyStrong">{st.arriveLabel}</Txt>
        <Txt v="caption" tone="tertiary">{st.departLabel}</Txt>
        {i < total - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: th.c.border, marginVertical: 4 }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 8, paddingBottom: 14 }}>
        <Tap onPress={() => (e ? openEntity(e) : undefined)} style={{ borderRadius: th.radius.lg, backgroundColor: th.c.surface, overflow: 'hidden' }} accessibilityRole={e ? 'button' : undefined}>
          {e ? <Cover entity={e} height={120} radius={0} width={480} /> : null}
          <View style={{ padding: 12, gap: 4 }}>
            <Txt v="bodyStrong" numberOfLines={2}>{title}</Txt>
            {e ? <Txt v="caption" tone="primary">{e.category.label}</Txt> : <Txt v="caption" tone="secondary">{t('plan.ownStop')}</Txt>}
            {blurb(e) ? <Txt v="caption" tone="secondary" numberOfLines={3}>{blurb(e)}</Txt> : null}
            {address ? <Txt v="caption" tone="tertiary" numberOfLines={1}>{address}</Txt> : null}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <Badge label={t('plan.duration', { min: st.durationMin })} />
              {e ? <Badge label={st.costEur !== null ? (st.costEur === 0 ? t('common.free') : `€${st.costEur.toFixed(2)}`) : t('common.priceUnknown')} tone={st.costEur === null ? 'warning' : 'neutral'} /> : null}
              {st.notes.includes('meal') ? <Badge label={t('plan.meal')} tone="primary" /> : null}
              {st.notes.includes('fixed_time') ? <Badge label={t('plan.fixedTime')} /> : null}
              {st.notes.includes('hours_unknown') ? <Badge label={t('plan.hoursUnknown')} tone="warning" /> : null}
              {(st.issues ?? []).filter((x) => x !== 'hours_unknown').map((x) => <Badge key={x} label={t(`plan.issue_${x}`)} tone="danger" icon="alert-outline" />)}
            </View>
          </View>
        </Tap>
        <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
          <Button title={t('plan.replace')} compact kind="ghost" icon="swap-horizontal" onPress={onReplace} />
          <Button title={t('plan.remove')} compact kind="ghost" icon="close" onPress={onRemove} />
          {i > 0 ? <Button title="↑" compact kind="ghost" onPress={() => onMove(-1)} /> : null}
          {i < total - 1 ? <Button title="↓" compact kind="ghost" onPress={() => onMove(1)} /> : null}
        </View>
        {st.travelToNextMin !== null && st.distanceToNextKm !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="map-marker-distance" size={14} color={th.c.textTertiary} />
            <Txt v="caption" tone="tertiary">{t('plan.toNext', { km: st.distanceToNextKm, min: st.travelToNextMin })}</Txt>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Pick a replacement (places confirmed open for the visit, or events starting then) for one stop. */
function ReplaceSheet({ stop, prevLoc, exclude, onPick, onClose }: { stop: PlanStopDTO | null; prevLoc: { lat: number; lng: number } | null; exclude: string[]; onPick: (e: EntityDTO) => void; onClose: () => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  const near = stop ? locOf(stop) ?? prevLoc : null;
  const q = useQuery({
    queryKey: ['plan-alt', stop?.arrive, stop?.durationMin, near?.lat, near?.lng],
    queryFn: () => api.planAlternatives({ arrive: stop!.arrive, durationMin: stop!.durationMin, near: near!, exclude, categories: stop?.entity?.type === 'place' && ['restaurant', 'cafe', 'bakery', 'fast-food'].includes(stop.entity.category.slug) ? ['restaurant', 'cafe', 'bakery', 'fast-food'] : undefined }),
    enabled: !!stop && !!near,
  });
  return (
    <Modal visible={!!stop} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
        <View style={{ maxHeight: '80%', backgroundColor: th.c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt v="title">{t('plan.replaceTitle', { time: stop?.arriveLabel ?? '' })}</Txt>
            <Tap onPress={onClose} accessibilityLabel={t('common.close')}><Icon name="close" size={24} /></Tap>
          </View>
          <Txt v="caption" tone="secondary">{t('plan.replaceHint')}</Txt>
          <ScrollView contentContainerStyle={{ gap: 8 }}>
            {q.isLoading ? <Txt v="callout" tone="secondary">{t('common.loading')}</Txt> : null}
            {q.data && !q.data.items.length ? <Txt v="callout" tone="secondary">{t('plan.noAlternatives')}</Txt> : null}
            {(q.data?.items ?? []).map((e) => (
              <Tap key={e.id} onPress={() => onPick(e)} accessibilityRole="button" style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 6 }}>
                <View style={{ width: 64 }}><Cover entity={e} height={64} radius={12} width={64} /></View>
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong" numberOfLines={1}>{e.type === 'place' ? e.name : e.title}</Txt>
                  <Txt v="caption" tone="secondary" numberOfLines={1}>{e.category.label}{e.distanceKm !== null ? ` · ${e.distanceKm} km` : ''}</Txt>
                  {e.type === 'place' && e.hours.label ? <Txt v="caption" tone="success" numberOfLines={1}>{e.hours.label}</Txt> : null}
                </View>
              </Tap>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Add a stop: a real place/event (search) or the user's own (title + duration). */
function AddSheet({ open, onAdd, onClose }: { open: boolean; onAdd: (it: PlanItem) => void; onClose: () => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [typed, setTyped] = useState('');
  const [dur, setDur] = useState(60);
  useEffect(() => { const id = setTimeout(() => setTyped(q.trim()), 250); return () => clearTimeout(id); }, [q]);
  const s = useQuery({ queryKey: ['suggest', typed], queryFn: () => api.suggest(typed, {}), enabled: open && typed.length >= 2 });
  const hits = (s.data?.suggestions ?? []).filter((x): x is Extract<typeof x, { id: string }> => x.type === 'place' || x.type === 'event');
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
        <View style={{ maxHeight: '85%', backgroundColor: th.c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt v="title">{t('plan.addStop')}</Txt>
            <Tap onPress={onClose} accessibilityLabel={t('common.close')}><Icon name="close" size={24} /></Tap>
          </View>
          <TextInput value={q} onChangeText={setQ} autoFocus placeholder={t('plan.addPlaceholder')} placeholderTextColor={th.c.textTertiary} accessibilityLabel={t('plan.addPlaceholder')}
            style={{ padding: 12, borderRadius: th.radius.md, backgroundColor: th.c.surface, color: th.c.text, fontFamily: th.font.medium, fontSize: 15 }} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[30, 60, 90, 120].map((m) => <Chip key={m} label={t('plan.duration', { min: m })} active={dur === m} onPress={() => setDur(m)} />)}
          </View>
          <ScrollView contentContainerStyle={{ gap: 4 }} keyboardShouldPersistTaps="handled">
            {hits.map((h) => (
              <Tap key={h.id} onPress={() => { onAdd({ kind: h.type, id: h.id, ...(h.type === 'place' ? { durationMin: dur } : {}) }); setQ(''); }} style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, alignItems: 'center' }}>
                <Icon name={h.type === 'event' ? 'calendar-star' : 'map-marker-outline'} size={20} color={th.c.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Txt v="body" numberOfLines={1}>{h.label}</Txt>
                  {h.sublabel ? <Txt v="caption" tone="tertiary" numberOfLines={1}>{h.sublabel}</Txt> : null}
                </View>
              </Tap>
            ))}
            {q.trim().length >= 2 ? (
              <Tap onPress={() => { onAdd({ kind: 'custom', title: q.trim(), durationMin: dur }); setQ(''); }} style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, alignItems: 'center' }}>
                <Icon name="pencil-plus-outline" size={20} color={th.c.primaryText} />
                <Txt v="bodyStrong" tone="primary">{t('plan.addOwn', { title: q.trim() })}</Txt>
              </Tap>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function Plan() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const p = useDiscoveryParams();
  const { planId } = useLocalSearchParams<{ planId?: string }>();
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
  const [participants, setParticipants] = useState(1);
  const [tripType, setTripType] = useState<TripType>('balanced');
  const [maxKm, setMaxKm] = useState<number | null>(10);
  const [interests, setInterests] = useState<InterestGroup[]>(saved.filter((g) => GROUPS.includes(g)).slice(0, 3));
  const [variant, setVariant] = useState(0);
  const [edit, setEdit] = useState<{ items: PlanItem[]; plan: PlanDayResponse } | null>(null);
  const [savedId, setSavedId] = useState<string | null>(planId ?? null);
  const [replaceIdx, setReplaceIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const params = (): PlanParams => ({ ...(p.usingGps ? { lat: p.lat, lng: p.lng } : { city: p.city }), date, start, end, budget, participants, mode });
  const m = useMutation<PlanDayResponse, Error>({ mutationFn: () => api.planDay({ ...params(), interests, tripType, maxDistanceKm: maxKm }), onSuccess: () => { setVariant(0); setEdit(null); } });
  const ev = useMutation<PlanDayResponse, Error, PlanItem[]>({ mutationFn: (items) => api.planEvaluate({ ...params(), items }), onSuccess: (plan, items) => setEdit({ items, plan }) });

  // Opening a saved plan (from "My plans") loads its parameters and stops.
  const loaded = useQuery({ queryKey: ['my-plan', planId], queryFn: () => api.myPlan(planId!), enabled: !!planId });
  useEffect(() => {
    const d = loaded.data;
    if (!d) return;
    setDate(d.date); setStart(d.params.start); setEnd(d.params.end); setBudget(d.params.budget ?? null); setParticipants(d.params.participants ?? 1); setMode(d.params.mode ?? 'auto');
    if (d.plan) setEdit({ items: d.items, plan: d.plan });
  }, [loaded.data]);

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

  const shown: PlanDayResponse | null = edit?.plan ?? (m.data && m.data.variants.length ? { ...m.data, ...m.data.variants[variant]! } : m.data ?? null);
  const items = edit?.items ?? (shown?.stops ?? []).map(itemOf);
  const change = (next: PlanItem[]) => (next.length ? ev.mutate(next) : setEdit({ items: [], plan: { ...shown!, stops: [], variants: [] } }));
  const savePlan = () => requireAuth('myEvents', async () => {
    try {
      const body = { title: t('plan.savedTitle', { date }), date, params: (({ date: _d, ...rest }) => rest)(params()), items };
      const r = await api.savePlan(body, savedId ?? undefined);
      setSavedId(r.id);
      showToast(t('plan.saved'));
      return r.id;
    } catch (e) {
      showToast(errorText(e), 'error');
      return null;
    }
  });
  const sharePlan = () => requireAuth('myEvents', async () => {
    try {
      const id = savedId ?? (await api.savePlan({ title: t('plan.savedTitle', { date }), date, params: (({ date: _d, ...rest }) => rest)(params()), items })).id;
      setSavedId(id);
      const { token } = await api.sharePlan(id);
      const url = `${WEB_URL}/shared-plan/${token}`;
      if (Platform.OS === 'web') {
        const nav = globalThis.navigator as Navigator;
        if (nav.share) await nav.share({ title: t('plan.title'), url }).catch(() => undefined);
        else { await nav.clipboard.writeText(url); showToast(t('share.copied')); }
      } else await Share.share({ message: url, url });
    } catch (e) {
      showToast(errorText(e), 'error');
    }
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="display" accessibilityRole="header">{t('plan.title')}</Txt>
        <Button title={t('plan.myPlans')} compact kind="ghost" icon="folder-outline" onPress={() => requireAuth('myEvents', () => router.push('/plans'))} />
      </View>
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
        <Txt v="headline">{t('plan.participants')}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Button title="−" compact kind="secondary" onPress={() => setParticipants((n) => Math.max(1, n - 1))} disabled={participants <= 1} />
          <Txt v="title" accessibilityLiveRegion="polite">{participants}</Txt>
          <Button title="+" compact kind="secondary" onPress={() => setParticipants((n) => Math.min(20, n + 1))} disabled={participants >= 20} />
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Txt v="headline">{t('plan.tripType')}</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{TRIPS.map((x) => <Chip key={x} label={t(`plan.trip_${x}`)} active={tripType === x} onPress={() => setTripType(x)} />)}</View>
      </View>
      <View style={{ gap: 8 }}>
        <Txt v="headline">{t('plan.budget')}</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[null, 0, 20, 50, 100].map((b) => <Chip key={String(b)} label={b === null ? t('plan.noLimit') : b === 0 ? t('common.free') : `€${b}`} active={budget === b} onPress={() => setBudget(b)} />)}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Txt v="headline">{t('plan.maxDistance')}</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{DISTANCES.map((d) => <Chip key={String(d)} label={d === null ? t('plan.anyDistance') : `${d} km`} active={maxKm === d} onPress={() => setMaxKm(d)} />)}</View>
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
      {!edit && m.data && m.data.variants.length === 0 ? (
        m.data.reason === 'window_passed'
          ? <EmptyState icon="clock-alert-outline" title={t('plan.windowPassed')} action={{ label: t('plan.planTomorrow'), onPress: planTomorrow }} />
          : <EmptyState icon="calendar-remove-outline" title={t('plan.empty')} />
      ) : null}

      {!edit && m.data && m.data.variants.length > 1 ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {m.data.variants.map((_, i) => <Chip key={i} label={t('plan.variant', { n: i + 1 })} active={variant === i} onPress={() => setVariant(i)} />)}
        </View>
      ) : null}
      {edit ? <Banner icon="pencil-outline" text={t('plan.edited')} /> : null}
      {ev.isError ? <Banner icon="alert-outline" tone="warning" text={errorText(ev.error)} /> : null}

      {shown && shown.stops.length > 0 ? (
        <View style={{ gap: 4 }}>
          {shown.stops.map((st, i) => (
            <StopCard key={`${st.entity?.id ?? st.custom?.title}-${i}`} st={st} i={i} total={shown.stops.length}
              onReplace={() => setReplaceIdx(i)}
              onRemove={() => change(items.filter((_, j) => j !== i))}
              onMove={(d) => { const next = [...items]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x!); change(next); }} />
          ))}
          <Button title={t('plan.addStop')} kind="secondary" icon="plus" onPress={() => setAdding(true)} />
          <View style={{ padding: 14, borderRadius: th.radius.md, backgroundColor: th.c.surface, gap: 4, marginTop: 8 }}>
            <Txt v="bodyStrong">{t('plan.total', { amount: `€${shown.totalKnownCost}` })}{shown.stopsWithUnknownPrice ? ` · ${t('plan.unknownPrices', { count: shown.stopsWithUnknownPrice })}` : ''}</Txt>
            {participants > 1 ? <Txt v="caption" tone="secondary">{t('plan.forPeople', { count: participants })}</Txt> : null}
            <Txt v="caption" tone="secondary">{shown.disclaimer}</Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <Button title={t('plan.recalculate')} kind="secondary" icon="refresh" loading={ev.isPending} onPress={() => ev.mutate(items)} />
            <Button title={savedId ? t('plan.update') : t('plan.save')} icon="content-save-outline" onPress={() => void savePlan()} />
            <Button title={t('common.share')} kind="ghost" icon="share-variant-outline" onPress={() => void sharePlan()} />
          </View>
        </View>
      ) : edit ? <EmptyState icon="playlist-remove" title={t('plan.allRemoved')} action={{ label: t('plan.addStop'), onPress: () => setAdding(true) }} /> : null}

      <ReplaceSheet stop={replaceIdx !== null ? shown?.stops[replaceIdx] ?? null : null}
        prevLoc={replaceIdx !== null && replaceIdx > 0 && shown ? locOf(shown.stops[replaceIdx - 1]!) : p.usingGps ? { lat: p.lat!, lng: p.lng! } : null}
        exclude={items.filter((x): x is Extract<PlanItem, { id: string }> => x.kind !== 'custom').map((x) => x.id)}
        onClose={() => setReplaceIdx(null)}
        onPick={(e) => { const i = replaceIdx!; setReplaceIdx(null); const next = [...items]; next[i] = { kind: e.type, id: e.id, ...(e.type === 'place' ? { durationMin: shown?.stops[i]?.durationMin } : {}) }; change(next); }} />
      <AddSheet open={adding} onClose={() => setAdding(false)} onAdd={(it) => { setAdding(false); change([...items, it]); }} />
    </ScrollView>
  );
}
