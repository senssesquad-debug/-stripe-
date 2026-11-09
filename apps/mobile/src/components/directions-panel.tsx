import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Platform, ScrollView, TextInput, View } from 'react-native';
import i18n from '@/i18n';
import { api, type Directions, type StreetRoute, type TransitOption } from '@/lib/api';
import { usePosition, type PositionStatus } from '@/lib/position';
import { useTheme } from '@/theme';
import type { RouteOverlay, UserFix } from './map-shared';
import { Banner, Button, Chip, Icon, Tap, Txt } from './ui';

type Mode = 'walk' | 'bike' | 'drive' | 'transit';
type Origin = { lat: number; lng: number; label: string; kind: 'gps' | 'manual' };

const hhmm = (iso: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Nicosia' }).format(new Date(iso));
const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`);
const fmtMin = (min: number, _t?: unknown) => (min >= 60 ? i18n.t('route.hm', { h: Math.floor(min / 60), m: min % 60 }) : i18n.t('route.m', { m: min }));

/** Live position card: coordinates, accuracy, age, warnings, refresh and follow. */
function PositionCard({ pos }: { pos: ReturnType<typeof usePosition> }) {
  const th = useTheme();
  const { t } = useTranslation();
  const warn: Partial<Record<PositionStatus, string>> = {
    weak: t('route.posWeak', { m: Math.round(pos.fix?.accuracyM ?? 0) }), stale: t('route.posStale', { s: pos.ageS }), lost: t('route.posLost'),
    denied: t('route.locationDenied'), unavailable: t('route.locationFailed'),
  };
  return (
    <View style={{ gap: 6 }}>
      {pos.fix ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={pos.status === 'ok' ? 'crosshairs-gps' : 'crosshairs-question'} size={18} color={pos.status === 'ok' ? th.c.success : th.c.warning} />
          <Txt v="caption" tone="secondary" style={{ flex: 1 }} selectable>
            {pos.fix.lat.toFixed(5)}, {pos.fix.lng.toFixed(5)} · {pos.fix.accuracyM !== null ? t('route.accuracy', { m: Math.round(pos.fix.accuracyM) }) : t('route.accuracyUnknown')} · {t('route.updated', { s: pos.ageS ?? 0 })}
          </Txt>
        </View>
      ) : null}
      {warn[pos.status] ? <Banner icon="map-marker-alert-outline" tone="warning" text={warn[pos.status]!} /> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button title={pos.status === 'locating' ? t('route.locating') : t('route.refreshPos')} compact icon="refresh" kind="secondary" loading={pos.status === 'locating'} onPress={() => void pos.refresh(true)} />
        <Chip icon="navigation-variant-outline" label={t('route.follow')} active={pos.following} onPress={() => void pos.follow(!pos.following)} />
      </View>
    </View>
  );
}

function Steps({ r }: { r: StreetRoute }) {
  const th = useTheme();
  const { t } = useTranslation();
  if (!r.steps.length) return null;
  return (
    <View style={{ gap: 2 }}>
      <Txt v="caption" tone="secondary">{t('route.steps')}</Txt>
      {r.steps.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6, borderBottomWidth: i < r.steps.length - 1 ? 1 : 0, borderColor: th.c.border }}>
          <Txt v="caption" tone="tertiary" style={{ width: 18 }}>{i + 1}</Txt>
          <Txt v="callout" style={{ flex: 1 }}>{s.text}</Txt>
          {s.distanceM > 0 ? <Txt v="caption" tone="tertiary">{fmtKm(s.distanceM / 1000)}</Txt> : null}
        </View>
      ))}
    </View>
  );
}

function TransitOptionView({ o, selected, onSelect }: { o: TransitOption; selected: boolean; onSelect: () => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  return (
    <Tap onPress={onSelect} accessibilityRole="button" accessibilityState={{ selected }}
      style={{ padding: 12, borderRadius: th.radius.md, borderWidth: 1, borderColor: selected ? th.c.primary : th.c.border, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Txt v="bodyStrong">{hhmm(o.departAt)} → {hhmm(o.arriveAt)}</Txt>
        <Txt v="caption" tone="secondary">{fmtMin(o.durationMin, t)} · {o.transfers ? t('route.transfers', { count: o.transfers }) : t('route.direct')}</Txt>
        <Txt v="caption" tone="secondary">· {o.fareEur !== null ? `€${o.fareEur.toFixed(2)}` : t('route.fareUnknown')}</Txt>
      </View>
      {selected ? o.legs.map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Icon name={l.type === 'walk' ? 'walk' : 'bus'} size={18} color={l.type === 'bus' ? l.color ?? th.c.primaryText : th.c.textTertiary} />
          {l.type === 'walk' ? (
            <Txt v="caption" tone="secondary" style={{ flex: 1 }}>{t('route.walkLeg', { m: l.distanceM, min: l.durationMin, to: l.to === 'destination' ? t('route.toDestination') : l.to })}</Txt>
          ) : (
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="callout"><Txt v="bodyStrong" style={{ color: l.color ?? th.c.primaryText }}>{l.route ?? '—'}</Txt> {l.headsign ? `→ ${l.headsign}` : ''} · {l.operator}</Txt>
              <Txt v="caption" tone="secondary">{hhmm(l.departure)} {l.from} → {hhmm(l.arrival)} {l.to}</Txt>
              <Txt v="caption" tone="tertiary">{t('route.stopsCount', { count: l.stops })} · {t('route.wait', { min: l.waitMin })}{l.fareEur !== null ? ` · €${l.fareEur.toFixed(2)}` : ''}</Txt>
            </View>
          )}
        </View>
      )) : null}
    </Tap>
  );
}

/**
 * Directions inside the app: four ways to go (walk, bicycle/e-scooter, car, public transport) with distance, time,
 * arrival, steps; transit from official timetables. Start = fresh GPS fix (asked only on demand) or a typed place.
 */
export function DirectionsPanel({ dest, nav, onRoute, onUser }: { dest: { lat: number; lng: number; title: string }; nav: { google: string; apple: string } | null; onRoute: (r: RouteOverlay | null) => void; onUser: (u: UserFix | null) => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  const pos = usePosition();
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [mode, setMode] = useState<Mode>('walk');
  const [transitIdx, setTransitIdx] = useState(0);
  const [manual, setManual] = useState(false);
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const id = setTimeout(() => setDebounced(text.trim()), 400); return () => clearTimeout(id); }, [text]);

  // Permission already given → take a fresh fix right away; otherwise wait for the user to choose.
  useEffect(() => { void pos.ensurePermission(false).then((ok) => { if (ok) void pos.refresh(false); }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  // The GPS start follows fresh fixes; a manual start stays put.
  useEffect(() => {
    if (pos.fix && (!origin || origin.kind === 'gps') && !manual) setOrigin({ lat: pos.fix.lat, lng: pos.fix.lng, label: t('route.myLocation'), kind: 'gps' });
    onUser(pos.fix ? { lat: pos.fix.lat, lng: pos.fix.lng, accuracyM: pos.fix.accuracyM } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.fix]);
  useEffect(() => { if (pos.status === 'denied' || pos.status === 'unavailable') setManual(true); }, [pos.status]);

  // Route from the origin rounded to ~10 m so small GPS jitter doesn't refetch; refetch when moved further.
  const key = origin ? [Math.round(origin.lat * 1e4), Math.round(origin.lng * 1e4)] : null;
  const dir = useQuery({ queryKey: ['directions', key, dest.lat, dest.lng], queryFn: () => api.directions(origin!, dest), enabled: !!origin, staleTime: 60_000 });
  const suggestions = useQuery({ queryKey: ['geocode', debounced], queryFn: () => api.geocode(debounced), enabled: manual && debounced.length >= 3, staleTime: 5 * 60_000 });

  const d: Directions | undefined = dir.data;
  const street = mode !== 'transit' && d ? d[mode] : null;
  const opt = mode === 'transit' && d?.transit.status === 'ok' ? d.transit.options[transitIdx] ?? d.transit.options[0] : null;
  const overlay = useMemo<RouteOverlay | null>(() => {
    if (!origin || !d) return null;
    if (street) return { geometry: street.geometry, origin };
    if (opt) return { geometry: opt.legs.flatMap((l) => [l.fromPoint, l.toPoint]), origin, schematic: true };
    return null;
  }, [origin, d, street, opt]);
  useEffect(() => { onRoute(overlay); }, [overlay, onRoute]);

  const summary = (m: Mode) => {
    if (!d) return null;
    if (m === 'transit') {
      const o = d.transit.options[0];
      return o ? `${fmtMin(o.durationMin, t)} · ${hhmm(o.arriveAt)}` : t('route.noTransitShort');
    }
    return `${fmtMin(d[m].durationMin, t)} · ${hhmm(d[m].arriveAt)}`;
  };
  const modes: Array<{ m: Mode; icon: 'walk' | 'bike' | 'car' | 'bus'; label: string }> = [
    { m: 'walk', icon: 'walk', label: t('route.walk') }, { m: 'bike', icon: 'bike', label: t('route.bike') },
    { m: 'drive', icon: 'car', label: t('route.drive') }, { m: 'transit', icon: 'bus', label: t('route.transit') },
  ];
  const transitMsg: Record<string, string> = { no_stops_nearby: t('route.noStops'), no_service: t('route.noService'), no_timetable: t('route.noTimetable'), unavailable: t('route.transitUnavailable') };

  return (
    <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
      <Txt v="headline" numberOfLines={2}>{t('route.title')}: {dest.title}</Txt>

      <View style={{ gap: 8 }}>
        <Txt v="caption" tone="secondary">{t('route.from')}</Txt>
        {origin && !manual ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name={origin.kind === 'gps' ? 'crosshairs-gps' : 'map-marker-outline'} size={20} color={th.c.primaryText} />
            <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{origin.label}</Txt>
            <Button title={t('route.change')} compact kind="ghost" onPress={() => { setManual(true); setText(''); }} />
          </View>
        ) : null}
        {!origin && !manual ? (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button title={t('route.myLocation')} compact icon="crosshairs-gps" loading={pos.status === 'locating'} onPress={() => void pos.refresh(true)} />
            <Button title={t('route.enterStart')} compact kind="secondary" icon="form-textbox" onPress={() => setManual(true)} />
          </View>
        ) : null}
        {(origin?.kind === 'gps' || pos.fix) && !manual ? <PositionCard pos={pos} /> : null}
        {manual ? (
          <View style={{ gap: 6 }}>
            {pos.status === 'denied' || pos.status === 'unavailable' ? <Banner icon="map-marker-off-outline" tone="warning" text={pos.status === 'denied' ? t('route.locationDenied') : t('route.locationFailed')} /> : null}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput value={text} onChangeText={setText} placeholder={t('route.searchPlaceholder')} placeholderTextColor={th.c.textTertiary} autoFocus accessibilityLabel={t('route.enterStart')}
                style={{ flex: 1, padding: 12, borderRadius: th.radius.md, backgroundColor: th.c.surface, color: th.c.text, fontFamily: th.font.medium, fontSize: 15 }} />
              {suggestions.isFetching ? <ActivityIndicator color={th.c.primary} /> : null}
            </View>
            {(suggestions.data?.items ?? []).map((s, i) => (
              <Tap key={`${s.lat},${s.lng},${i}`} accessibilityRole="button" style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, alignItems: 'center' }}
                onPress={() => { setOrigin({ lat: s.lat, lng: s.lng, label: s.label, kind: 'manual' }); setManual(false); }}>
                <Icon name="map-marker-outline" size={18} color={th.c.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Txt v="callout" numberOfLines={1}>{s.label}</Txt>
                  {s.sublabel ? <Txt v="caption" tone="tertiary" numberOfLines={1}>{s.sublabel}</Txt> : null}
                </View>
              </Tap>
            ))}
            {suggestions.data && !suggestions.data.items.length ? <Txt v="caption" tone="tertiary">{t('route.noResults')}</Txt> : null}
            {pos.status !== 'denied' ? <Button title={t('route.useMyLocation')} compact kind="ghost" icon="crosshairs-gps" onPress={() => { setManual(false); setOrigin(null); void pos.refresh(true); }} /> : null}
          </View>
        ) : null}
      </View>

      {origin ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {modes.map((x) => (
            <Tap key={x.m} onPress={() => setMode(x.m)} accessibilityRole="tab" accessibilityState={{ selected: mode === x.m }}
              style={{ flexGrow: 1, flexBasis: '45%', padding: 10, borderRadius: th.radius.md, borderWidth: 1, borderColor: mode === x.m ? th.c.primary : th.c.border, backgroundColor: mode === x.m ? th.c.primarySoft : 'transparent', gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name={x.icon} size={18} color={mode === x.m ? th.c.primaryText : th.c.textSecondary} />
                <Txt v="callout" style={{ fontFamily: th.font.semibold }} numberOfLines={1}>{x.label}</Txt>
              </View>
              <Txt v="caption" tone="secondary" numberOfLines={1}>{dir.isFetching && !d ? t('route.building') : summary(x.m) ?? ''}</Txt>
            </Tap>
          ))}
        </View>
      ) : null}

      {dir.isError ? <Banner icon="alert-outline" tone="warning" text={(dir.error as Error).message} /> : null}
      {street ? (
        <View style={{ gap: 8 }}>
          <Txt v="title">{fmtKm(street.distanceKm)} · {fmtMin(street.durationMin, t)}</Txt>
          <Txt v="callout" tone="secondary">{t('route.arriveAt', { time: hhmm(street.arriveAt) })}</Txt>
          {mode === 'bike' ? <Txt v="caption" tone="tertiary">{t('route.bikeNote')}</Txt> : null}
          {mode === 'drive' ? <Txt v="caption" tone="tertiary">{t('route.carNote')}</Txt> : null}
          {street.estimate ? <Banner icon="vector-line" tone="warning" text={t('route.estimate')} /> : <Steps r={street} />}
          {street.attribution ? <Txt v="micro" tone="tertiary">{street.attribution}</Txt> : null}
        </View>
      ) : null}
      {mode === 'transit' && d ? (
        <View style={{ gap: 8 }}>
          {d.transit.status === 'ok' ? d.transit.options.map((o, i) => <TransitOptionView key={i} o={o} selected={i === transitIdx} onSelect={() => setTransitIdx(i)} />)
            : <Banner icon="bus-alert" tone="warning" text={transitMsg[d.transit.status] ?? t('route.transitUnavailable')} />}
          <Txt v="micro" tone="tertiary">{t('route.scheduled')}{d.transit.validUntil ? ` · ${t('route.validUntil', { date: d.transit.validUntil })}` : ''}</Txt>
          {d.transit.attribution ? <Txt v="micro" tone="tertiary">{d.transit.attribution}</Txt> : null}
        </View>
      ) : null}

      {nav ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <Txt v="caption" tone="tertiary">{t('route.openIn')}</Txt>
          <Button title="Google Maps" kind="ghost" compact onPress={() => void Linking.openURL(nav.google)} />
          {Platform.OS !== 'android' ? <Button title="Apple Maps" kind="ghost" compact onPress={() => void Linking.openURL(nav.apple)} /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
