import type { SimScenario } from '@passtra/core';
import { useQuery } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavMap } from '@/components/nav-map';
import { Banner, Button, EmptyState, ErrorState, Icon, Skeleton, Tap, Txt } from '@/components/ui';
import i18n from '@/i18n';
import { api, type Directions, type TransitOption } from '@/lib/api';
import { useNavigationSession, type NavKind } from '@/lib/navigation-session';
import { useTheme } from '@/theme';

type IconName = Parameters<typeof Icon>[0]['name'];
const SIMS: SimScenario[] = ['walk', 'bike', 'scooter', 'drive', 'off_route', 'stop', 'turn_around', 'gps_loss'];

const hhmm = (ms: number | string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Nicosia' }).format(new Date(ms));
export const fmtDist = (m: number) => (m < 1000 ? `${Math.max(0, Math.round(m / 10) * 10)} m` : `${(m / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`);
const fmtMin = (min: number) => (min >= 60 ? i18n.t('route.hm', { h: Math.floor(min / 60), m: min % 60 }) : i18n.t('route.m', { m: min }));

function maneuverIcon(type?: string, modifier?: string | null): IconName {
  if (type === 'arrive') return 'flag-checkered';
  if (type === 'walk') return 'walk';
  if (type === 'board') return 'bus';
  if (type === 'alight') return 'bus-stop';
  if (type === 'roundabout' || type === 'rotary' || type === 'exit roundabout') return 'rotate-right';
  switch (modifier) {
    case 'left': return 'arrow-left-top';
    case 'right': return 'arrow-right-top';
    case 'slight left': return 'arrow-top-left';
    case 'slight right': return 'arrow-top-right';
    case 'sharp left': return 'arrow-left-bottom';
    case 'sharp right': return 'arrow-right-bottom';
    case 'uturn': return 'arrow-u-left-top';
    default: return 'arrow-up';
  }
}

/** Street steps are already worded by the server; transit steps are structured and worded here. */
function stepText(text: string): string {
  if (!text.startsWith('{')) return text;
  const s = JSON.parse(text) as { k: string; to?: string | null; route?: string | null; headsign?: string | null; stop?: string; at?: string };
  if (s.k === 'walk') return s.to ? i18n.t('nav.walkTo', { stop: s.to }) : i18n.t('nav.walkToDest');
  if (s.k === 'board') return i18n.t('nav.board', { route: s.route ?? '—', headsign: s.headsign ? `→ ${s.headsign}` : '', stop: s.stop, time: hhmm(s.at!) });
  if (s.k === 'alight') return i18n.t('nav.alight', { stop: s.stop, time: hhmm(s.at!) });
  return i18n.t('nav.arrive');
}

export default function Navigate() {
  const { t } = useTranslation();
  const th = useTheme();
  const p = useLocalSearchParams<{ lat: string; lng: string; title: string; mode: NavKind; from: string; transit?: string; sim?: SimScenario; speed?: string; at?: string }>();
  const dest = useMemo(() => ({ lat: Number(p.lat), lng: Number(p.lng), title: p.title ?? '' }), [p.lat, p.lng, p.title]);
  const [fromLat, fromLng] = (p.from ?? '').split(',').map(Number) as [number, number];
  const sim = p.sim && SIMS.includes(p.sim) ? p.sim : null;
  const dir = useQuery({ queryKey: ['nav-directions', p.from, p.lat, p.lng], queryFn: () => api.directions({ lat: fromLat, lng: fromLng }, dest, p.at), enabled: Number.isFinite(fromLat) && Number.isFinite(dest.lat), staleTime: Infinity });
  const header = <Stack.Screen options={{ headerShown: false }} />;
  if (dir.isLoading) return <View style={{ flex: 1, padding: 20, backgroundColor: th.c.background }}>{header}<Skeleton width="100%" height={400} /></View>;
  if (dir.isError || !dir.data) return <>{header}<ErrorState error={dir.error} onRetry={() => void dir.refetch()} /></>;
  return <Session d={dir.data} kind={p.mode ?? 'walk'} dest={dest} transitIdx={Number(p.transit ?? 0)} sim={sim} simSpeed={Number(p.speed ?? 1) || 1} header={header} />;
}

function Session({ d, kind, dest, transitIdx, sim, simSpeed, header }: { d: Directions; kind: NavKind; dest: { lat: number; lng: number; title: string }; transitIdx: number; sim: SimScenario | null; simSpeed: number; header: React.ReactNode }) {
  // Keep the screen on while guiding (best effort: some browsers refuse a wake lock).
  useEffect(() => {
    void activateKeepAwakeAsync('passtra-nav').catch(() => undefined);
    return () => { try { void Promise.resolve(deactivateKeepAwake('passtra-nav')).catch(() => undefined); } catch { /* not active */ } };
  }, []);
  const { t } = useTranslation();
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const s = useNavigationSession({ kind, dest, initial: d, transitIdx, sim, simSpeed });

  const geometry = useMemo(() => (s.route ? s.route.points.slice(s.state?.segIndex ?? 0) : []), [s.route, s.state?.segIndex]);
  const traveled = useMemo(() => (s.route && s.state ? [...s.route.points.slice(0, s.state.segIndex + 1), [s.state.position.lng, s.state.position.lat] as [number, number]] : []), [s.route, s.state]);
  const stops = useMemo(() => (s.transit ? s.transit.legs.flatMap((l) => (l.type === 'bus' ? (l.stopList ?? []).map((x) => x.point) : [])) : undefined), [s.transit]);

  if (!s.route || !s.state) {
    return <>{header}<EmptyState icon="map-marker-off-outline" title={t('nav.noRoute')} action={{ label: t('common.close'), onPress: () => router.back() }} /></>;
  }
  const st = s.state;
  const step = st.nextStepIndex !== null ? s.route.steps[st.nextStepIndex] : null;
  const showSpeed = st.speedMs !== null && st.status === 'navigating' && (s.simulated || (s.lastFix?.accuracyM ?? 99) <= 25);
  const exit = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={{ flex: 1, backgroundColor: th.c.background }}>
      {header}
      <NavMap geometry={geometry} traveled={traveled} position={st.lastFixAt !== null ? st.position : null} headingDeg={st.headingDeg} accuracyM={s.lastFix?.accuracyM ?? null}
        view={s.view} onGesture={s.gesture} destination={[dest.lng, dest.lat]} stops={stops} simulated={s.simulated} />

      {/* Top: next manoeuvre */}
      <View style={{ position: 'absolute', top: insets.top + 10, left: 12, right: 12, gap: 8, maxWidth: 560, alignSelf: 'center', width: '100%' }} pointerEvents="box-none">
        {s.simulated ? (
          <View testID="sim-badge" style={{ backgroundColor: th.c.danger, borderRadius: th.radius.md, paddingVertical: 6, paddingHorizontal: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="test-tube" size={18} color="#fff" />
            <Txt v="callout" style={{ color: '#fff', flex: 1 }}>{t('nav.simBadge', { scenario: t(`nav.sim_${sim}`) })}</Txt>
          </View>
        ) : null}
        {st.status !== 'arrived' && step ? (
          <View testID="nav-instruction" style={{ backgroundColor: th.c.primary, borderRadius: th.radius.lg, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', ...th.shadow.floating }}>
            <Icon name={maneuverIcon(step.maneuver?.type, step.maneuver?.modifier)} size={40} color="#fff" />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="title" style={{ color: '#fff' }} testID="nav-next-distance">{fmtDist(st.distanceToNextM ?? 0)}</Txt>
              <Txt v="callout" style={{ color: '#fff' }} numberOfLines={2}>{stepText(step.text)}</Txt>
            </View>
          </View>
        ) : null}
        {st.status === 'off_route' || s.rerouting ? <Banner icon="routes" tone="warning" text={s.rerouteError ? t('nav.rerouteFailed') : t('nav.rerouting')} /> : null}
        {st.status === 'gps_lost' ? <Banner icon="crosshairs-question" tone="warning" text={t('nav.gpsLost')} /> : null}
        {s.permission === 'denied' ? <Banner icon="map-marker-off-outline" tone="warning" text={t('nav.noPermission')} /> : null}
        {st.status === 'stopped' ? <Banner icon="pause-circle-outline" text={t('nav.stopped')} /> : null}
        {s.lastFix && (s.lastFix.accuracyM ?? 0) > 60 && st.status !== 'gps_lost' ? <Banner icon="crosshairs-question" tone="warning" text={t('route.posWeak', { m: Math.round(s.lastFix.accuracyM ?? 0) })} /> : null}
      </View>

      {/* Right: camera controls */}
      <View style={{ position: 'absolute', right: 12, top: insets.top + 190, gap: 10 }}>
        <Tap testID="nav-overview" onPress={s.toggleOverview} accessibilityRole="button" accessibilityLabel={s.camMode === 'overview' ? t('nav.follow') : t('nav.overview')}
          style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: th.c.background, alignItems: 'center', justifyContent: 'center', ...th.shadow.floating }}>
          <Icon name={s.camMode === 'overview' ? 'navigation-variant' : 'map-outline'} size={22} />
        </Tap>
        <Tap testID="nav-rotate" onPress={s.toggleRotate} accessibilityRole="button" accessibilityLabel={s.rotate ? t('nav.northUp') : t('nav.headingUp')}
          style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: th.c.background, alignItems: 'center', justifyContent: 'center', ...th.shadow.floating }}>
          <Icon name={s.rotate ? 'compass-outline' : 'navigation-variant-outline'} size={22} />
        </Tap>
      </View>
      {s.camMode === 'manual' ? (
        <View style={{ position: 'absolute', alignSelf: 'center', bottom: insets.bottom + 200 }}>
          <Button testID="nav-recenter" title={t('nav.recenter')} icon="crosshairs-gps" onPress={s.recenter} />
        </View>
      ) : null}

      {/* Bottom: progress */}
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 12, maxWidth: 560, alignSelf: 'center', width: '100%', padding: 16, borderRadius: th.radius.lg, backgroundColor: th.c.background, gap: 10, ...th.shadow.floating }}>
        {st.status === 'arrived' ? (
          <View style={{ gap: 10 }} testID="nav-arrived">
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Icon name="flag-checkered" size={28} color={th.c.success} />
              <Txt v="title" style={{ flex: 1 }}>{t('nav.arrived', { place: dest.title })}</Txt>
            </View>
            <Button title={t('nav.finish')} icon="check" onPress={exit} />
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Txt v="title" testID="nav-remaining">{fmtMin(st.remainingMin)} · {fmtDist(st.remainingM)}</Txt>
                <Txt v="caption" tone="secondary">{t('nav.arrival', { time: s.arrivalAt ? hhmm(s.arrivalAt) : '—' })}{showSpeed ? ` · ${Math.round((st.speedMs ?? 0) * 3.6)} km/h` : ''}</Txt>
              </View>
              <Button testID="nav-stop" title={t('nav.stop')} kind="danger" compact icon="close" onPress={exit} />
            </View>
            <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(st.progress * 100) }} style={{ height: 6, borderRadius: 3, backgroundColor: th.c.surface, overflow: 'hidden' }}>
              <View testID="nav-progress" style={{ width: `${Math.round(st.progress * 100)}%`, height: 6, backgroundColor: th.c.primary }} />
            </View>
            {s.transit ? <TransitNow o={s.transit} nextText={step?.text ?? null} /> : null}
            {kind === 'drive' ? <Txt v="micro" tone="tertiary">{t('route.carNote')}</Txt> : null}
            {kind === 'scooter' ? <Txt v="micro" tone="tertiary">{t('nav.scooterNote')}</Txt> : null}
            {kind === 'transit' ? <Txt v="micro" tone="tertiary">{t('route.scheduled')}</Txt> : null}
          </>
        )}
      </View>
    </View>
  );
}

/** Transit: the leg in progress with its stops and scheduled times. */
function TransitNow({ o, nextText }: { o: TransitOption; nextText: string | null }) {
  const th = useTheme();
  const { t } = useTranslation();
  const next = nextText?.startsWith('{') ? (JSON.parse(nextText) as { k: string; leg?: number }) : null;
  const leg = next?.leg !== undefined ? o.legs[next.leg] : undefined;
  if (!leg || leg.type !== 'bus') return null;
  return (
    <View style={{ gap: 4 }} testID="nav-transit">
      <Txt v="caption" tone="secondary">
        <Txt v="bodyStrong" style={{ color: leg.color ?? th.c.primaryText }}>{leg.route ?? '—'}</Txt> {leg.headsign ? `→ ${leg.headsign}` : ''} · {leg.operator} · {t('route.stopsCount', { count: leg.stops })}
      </Txt>
      {next?.k === 'board' ? <Txt v="caption">{t('nav.departs', { time: hhmm(leg.departure), stop: leg.from })}</Txt> : null}
      {(leg.stopList ?? []).slice(0, 8).map((x, i) => (
        <Txt key={i} v="micro" tone="tertiary" numberOfLines={1}>{hhmm(x.at)} · {x.name}</Txt>
      ))}
      {(leg.stopList?.length ?? 0) > 8 ? <Txt v="micro" tone="tertiary">… {hhmm(leg.arrival)} · {leg.to}</Txt> : null}
    </View>
  );
}
