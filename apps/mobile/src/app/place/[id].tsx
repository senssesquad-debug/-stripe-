import type { PlaceDTO } from '@passtra/core';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, View } from 'react-native';
import { Cover, EntityRow, SaveButton } from '@/components/cards';
import { EntityActions } from '@/components/entity-actions';
import { fromGoogle, PlaceGallery } from '@/components/gallery';
import { PlaceHours } from '@/components/schedule';
import { headerLeftForDirectOpen } from '@/components/home-button';
import { Badge, Button, ErrorState, InfoLine, Skeleton, Tap, Txt } from '@/components/ui';
import { VerificationBadge, VerificationBlock } from '@/components/verification';
import { api, type Summary } from '@/lib/api';
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

/** Longer text about the place with its source and licence (e.g. Wikipedia, CC BY-SA), collapsed after a few lines. */
function About({ p, summary }: { p: PlaceDTO; summary: Summary | null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const text = p.about?.text ?? p.description ?? summary?.text;
  if (!text) return null;
  const long = text.length > 420;
  return (
    <View style={{ gap: 6 }}>
      <Txt v="headline">{t('detail.about')}</Txt>
      <Txt v="body" tone="secondary" numberOfLines={long && !open ? 7 : undefined}>{text}</Txt>
      {long ? <Button title={open ? t('place.readLess') : t('place.readMore')} kind="ghost" compact onPress={() => setOpen(!open)} style={{ alignSelf: 'flex-start' }} /> : null}
      {!p.about && !p.description && summary ? <Txt v="caption" tone="tertiary">{summary.engine === 'ai' ? t('card2.summaryAi') : t('card2.summaryFacts')}</Txt> : null}
      {p.about ? (
        <Tap accessibilityRole={p.about.url ? 'link' : undefined} onPress={() => (p.about?.url ? void WebBrowser.openBrowserAsync(p.about.url) : undefined)}>
          <Txt v="caption" tone="tertiary">{t('place.source', { source: p.about.source })}{p.about.license ? ` · ${t('place.license', { license: p.about.license })}` : ''}{p.about.url ? ' ↗' : ''}</Txt>
        </Tap>
      ) : null}
    </View>
  );
}

export default function PlaceScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loc = useDiscoveryParams();
  const q = useQuery({ queryKey: ['place', id, loc.lat, loc.lng], queryFn: () => api.place(id, loc.usingGps ? { lat: loc.lat, lng: loc.lng } : {}) });
  // Live Google photos (official API; fetched on demand, never stored), shown with their authors.
  const photos = useQuery({ queryKey: ['place-photos', id], queryFn: () => api.placePhotos(id), staleTime: 30 * 60_000, enabled: !!q.data });
  useEffect(() => {
    if (q.data) void api.interactions([{ entityType: 'place', entityId: id, kind: 'open' }]).catch(() => undefined);
  }, [q.data, id]);

  if (q.isLoading) return <View style={{ padding: 20, gap: 14, flex: 1, backgroundColor: th.c.background }}><Skeleton width="100%" height={200} radius={20} /><Skeleton width="60%" height={26} /></View>;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const p: PlaceDTO = q.data.place;
  const where = [p.address, p.city?.name].filter(Boolean).join(', ');
  const googlePhotos = (photos.data?.photos ?? []).map(fromGoogle);
  const ownCover = p.images.find((i) => i.kind !== 'historical') ?? null;
  const coverPhoto = ownCover ? null : googlePhotos[0] ?? null;
  const coverCredit = ownCover ? [ownCover.year ? t('place.photoYear', { year: ownCover.year }) : null, ownCover.attribution].filter(Boolean).join(' · ') : coverPhoto?.credit ?? null;
  const coverCreditUrl = ownCover ? ownCover.source ?? null : coverPhoto?.creditUrl ?? null;
  return (
    <>
      <Stack.Screen options={{ headerRight: () => <SaveButton entity={p} />, headerLeft: headerLeftForDirectOpen() }} />
      <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 48, maxWidth: 820, width: '100%', alignSelf: 'center' }}>
        <Cover entity={p} height={220} radius={th.radius.lg} width={820} photoUrl={coverPhoto?.url ?? null} />
        {coverCredit ? (
          <Tap onPress={() => (coverCreditUrl ? void WebBrowser.openBrowserAsync(coverCreditUrl) : undefined)} style={{ marginTop: -12 }}>
            <Txt v="micro" tone="tertiary">{coverCredit}</Txt>
          </Tap>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {p.isDemo ? <Badge label={t('common.demo')} tone="dark" /> : null}
          <Badge label={p.category.label} tone="primary" />
          <VerificationBadge v={p.verification} />
          {p.free.isFree ? <Badge label={p.free.basis === 'typical' ? t('common.usuallyFree') : t('common.free')} tone="success" /> : null}
          {p.ageMin ? <Badge label={t('detail.ageLimit', { age: p.ageMin })} /> : null}
        </View>
        <Txt v="display" accessibilityRole="header">{p.name}</Txt>
        <EntityActions entity={p} />
        <About p={p} summary={q.data.summary} />
        <PlaceGallery images={p.images} google={googlePhotos} skipFirst />

        <PlaceHours place={p} week={q.data.schedule?.week ?? null} holidayRule={q.data.schedule?.holidayRule ?? null} />
        <View style={{ gap: 14 }}>
          <Txt v="headline">{t('place.practical')}</Txt>
          <InfoLine icon="map-marker-outline" label={t('detail.where')} value={where || p.category.label}
            sub={[p.location.precision === 'approximate' ? t('detail.approxLocation') : null, distanceLabel(p.distanceKm)].filter(Boolean).join(' · ') || null} />
          {p.free.isFree !== null || p.priceLevel !== null ? <InfoLine icon="ticket-outline" label={t('detail.price')} value={p.free.isFree ? (p.free.basis === 'typical' ? t('common.usuallyFree') : t('common.free')) : p.priceLevel ? '€'.repeat(p.priceLevel) : t('common.priceUnknown')} /> : null}
          {p.phone ? <InfoLine icon="phone-outline" label={t('place.phone')} value={p.phone} /> : null}
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {p.phone ? <Button title={t('detail.call')} icon="phone-outline" kind="secondary" compact onPress={() => void Linking.openURL(`tel:${p.phone!.replace(/\s/g, '')}`)} /> : null}
            {p.website ? <Button title={t('detail.website')} icon="web" kind="secondary" compact onPress={() => void WebBrowser.openBrowserAsync(p.website!)} /> : null}
          </View>
        </View>
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
