import type { PlaceDTO } from '@passtra/core';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, ScrollView, Share, View } from 'react-native';
import { Cover, EntityRow, SaveButton } from '@/components/cards';
import { Badge, Button, ErrorState, InfoLine, Skeleton, Txt } from '@/components/ui';
import { VerificationBadge, VerificationBlock } from '@/components/verification';
import { api } from '@/lib/api';
import { distanceLabel, timeAgo } from '@/lib/format';
import { useDiscoveryParams } from '@/lib/location';
import { useTheme } from '@/theme';

/** Google rating/hours are fetched live and never stored (Google Maps Platform terms); shown without a map (EEA terms). */
function GoogleLive({ id }: { id: string }) {
  const th = useTheme();
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['live', id], queryFn: () => api.placeLive(id), staleTime: 10 * 60_000 });
  const g = q.data?.google;
  if (!g || (g.rating === null && !g.weekdayText)) return null;
  return (
    <View style={{ gap: 6, padding: 16, borderRadius: th.radius.lg, borderWidth: 1, borderColor: th.c.border }}>
      <Txt v="headline">{t('detail.googleTitle')}</Txt>
      {g.rating !== null ? <Txt v="bodyStrong">{t('detail.googleRating', { rating: g.rating.toFixed(1), count: g.ratingCount ?? 0 })}</Txt> : null}
      {g.weekdayText?.map((l) => <Txt key={l} v="caption" tone="secondary">{l}</Txt>)}
      <Txt v="caption" tone="tertiary">Google · {timeAgo(g.fetchedAt)}</Txt>
      {g.mapsUrl ? <Button title={t('detail.googleMaps')} kind="ghost" compact icon="google-maps" onPress={() => void Linking.openURL(g.mapsUrl!)} /> : null}
    </View>
  );
}

export default function PlaceScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loc = useDiscoveryParams();
  const q = useQuery({ queryKey: ['place', id, loc.lat, loc.lng], queryFn: () => api.place(id, loc.usingGps ? { lat: loc.lat, lng: loc.lng } : {}) });
  useEffect(() => {
    if (q.data) void api.interactions([{ entityType: 'place', entityId: id, kind: 'open' }]).catch(() => undefined);
  }, [q.data, id]);

  if (q.isLoading) return <View style={{ padding: 20, gap: 14, flex: 1, backgroundColor: th.c.background }}><Skeleton width="100%" height={200} radius={20} /><Skeleton width="60%" height={26} /></View>;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const p: PlaceDTO = q.data.place;
  const nav = q.data.navigation;
  return (
    <>
      <Stack.Screen options={{ headerRight: () => <SaveButton entity={p} /> }} />
      <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 48 }}>
        <Cover entity={p} height={200} radius={th.radius.lg} />
        {p.images[0]?.attribution ? <Txt v="caption" tone="tertiary" style={{ marginTop: -12 }}>{p.images[0].attribution}</Txt> : null}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {p.isDemo ? <Badge label={t('common.demo')} tone="dark" /> : null}
          <Badge label={p.category.label} tone="primary" />
          <VerificationBadge v={p.verification} />
          {p.free.isFree ? <Badge label={p.free.basis === 'typical' ? t('common.usuallyFree') : t('common.free')} tone="success" /> : null}
          {p.ageMin ? <Badge label={t('detail.ageLimit', { age: p.ageMin })} /> : null}
        </View>
        <Txt v="display" accessibilityRole="header">{p.name}</Txt>
        <View style={{ gap: 14 }}>
          {p.hours.label || p.hours.raw ? <InfoLine icon="clock-outline" label={t('detail.hours')} value={p.hours.label ?? p.hours.raw!} sub={p.hours.label && p.hours.raw ? p.hours.raw : null} /> : null}
          <InfoLine icon="map-marker-outline" label={t('detail.where')} value={[p.address, p.city?.name].filter(Boolean).join(', ') || p.category.label} sub={distanceLabel(p.distanceKm)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Button title={t('detail.directions')} icon="directions" onPress={() => { void api.interactions([{ entityType: 'place', entityId: p.id, kind: 'navigate' }]).catch(() => undefined); void Linking.openURL(Platform.OS === 'ios' ? nav.apple : nav.google); }} />
          {p.phone ? <Button title={t('detail.call')} icon="phone-outline" kind="secondary" onPress={() => void Linking.openURL(`tel:${p.phone!.replace(/\s/g, '')}`)} /> : null}
          {p.website ? <Button title={t('detail.website')} icon="web" kind="secondary" onPress={() => void WebBrowser.openBrowserAsync(p.website!)} /> : null}
          <Button title={t('common.share')} icon="share-variant-outline" kind="ghost" onPress={() => void Share.share({ message: `${p.name}\n${nav.google}` })} />
        </View>
        {p.description ? <Txt v="body" tone="secondary">{p.description}</Txt> : null}
        <GoogleLive id={p.id} />
        {q.data.upcomingEvents.length ? (
          <View style={{ gap: 4 }}>
            <Txt v="headline">{t('detail.upcomingHere')}</Txt>
            {q.data.upcomingEvents.map((e) => <EntityRow key={e.id} entity={e} />)}
          </View>
        ) : null}
        <VerificationBlock entity={p} />
      </ScrollView>
    </>
  );
}
