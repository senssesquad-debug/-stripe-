import { useQuery } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { headerLeftForDirectOpen } from '@/components/home-button';
import { MapPanel } from '@/components/map-view';
import { DirectionsPanel } from '@/components/directions-panel';
import { openDetails, type FocusPoint, type RouteOverlay, type UserFix } from '@/components/map-shared';
import { Button, EmptyState, ErrorState, Skeleton, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useTheme } from '@/theme';

/** One object on the in-app map ("On map"), optionally with a route to it ("Route"). Works as a direct link too. */
export default function Locate() {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { type, id, mode, from } = useLocalSearchParams<{ type: 'event' | 'place'; id: string; mode?: 'route'; from?: 'detail' }>();
  const details = () => (from === 'detail' && router.canGoBack() ? router.back() : openDetails({ type, id }));
  const [routing, setRouting] = useState(mode === 'route');
  const [route, setRoute] = useState<RouteOverlay | null>(null);
  const [user, setUser] = useState<UserFix | null>(null);
  const [panelH, setPanelH] = useState(0);
  const q = useQuery({
    queryKey: ['locate', type, id],
    queryFn: async () => {
      if (type === 'event') {
        const r = await api.event(id);
        const e = r.event;
        return { focus: e.location ? { type, id, lat: e.location.lat, lng: e.location.lng, title: e.title, subtitle: [e.venue.name, e.time.label].filter(Boolean).join(' · ') } : null, nav: r.navigation, approx: e.location?.precision !== 'exact' };
      }
      const r = await api.place(id);
      const p = r.place;
      return { focus: { type, id, lat: p.location.lat, lng: p.location.lng, title: p.name, subtitle: [p.category.label, p.address].filter(Boolean).join(' · ') }, nav: r.navigation, approx: p.location.precision !== 'exact' };
    },
  });
  const onRoute = useCallback((r: RouteOverlay | null) => setRoute(r), []);
  const onUser = useCallback((u: UserFix | null) => setUser(u), []);
  const focus = q.data?.focus as FocusPoint | null | undefined;
  const center = useMemo(() => (focus ? { lat: focus.lat, lng: focus.lng } : { lat: 34.68, lng: 33.04 }), [focus]);

  const header = <Stack.Screen options={{ title: focus?.title ?? '', headerLeft: headerLeftForDirectOpen() }} />;
  if (q.isLoading) return <>{header}<View style={{ flex: 1, padding: 20, backgroundColor: th.c.background }}><Skeleton width="100%" height={300} /></View></>;
  if (q.isError) return <>{header}<ErrorState error={q.error} onRetry={() => void q.refetch()} /></>;
  if (!focus) return <>{header}<EmptyState icon="map-marker-off-outline" title={t('route.noLocation')} action={{ label: t('route.details'), onPress: () => openDetails({ type, id }) }} /></>;

  return (
    <View style={{ flex: 1, backgroundColor: th.c.background }}>
      {header}
      <MapPanel center={center} filters={null} focus={focus} route={routing ? route : null} user={routing ? user : null} bottomInset={panelH} />
      <View onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}
        style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 12, maxWidth: 520, padding: 16, borderRadius: th.radius.lg, backgroundColor: th.c.background, gap: 10, ...th.shadow.floating }}>
        {routing ? (
          <>
            <DirectionsPanel dest={{ lat: focus.lat, lng: focus.lng, title: focus.title }} nav={q.data?.nav ?? null} onRoute={onRoute} onUser={onUser} />
            <Button title={t('common.close')} kind="ghost" compact onPress={() => { setRouting(false); setRoute(null); setUser(null); }} style={{ alignSelf: 'flex-start' }} />
          </>
        ) : (
          <>
            <Txt v="headline" numberOfLines={2}>{focus.title}</Txt>
            {focus.subtitle ? <Txt v="caption" tone="secondary" numberOfLines={2}>{focus.subtitle}</Txt> : null}
            {q.data?.approx ? <Txt v="caption" tone="warning">{t('detail.approxLocation')}</Txt> : null}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button title={t('route.route')} icon="directions" compact onPress={() => setRouting(true)} />
              <Button title={t('route.details')} kind="secondary" icon="information-outline" compact onPress={details} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}
