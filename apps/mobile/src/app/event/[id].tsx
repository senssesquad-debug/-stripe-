import type { EventDTO } from '@passtra/core';
import { useQuery } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { Cover, SaveButton } from '@/components/cards';
import { EntityActions } from '@/components/entity-actions';
import { EventSchedule } from '@/components/schedule';
import { headerLeftForDirectOpen } from '@/components/home-button';
import { Badge, Banner, Button, ErrorState, InfoLine, Skeleton, Tap, Txt } from '@/components/ui';
import { VerificationBadge, VerificationBlock } from '@/components/verification';
import { api } from '@/lib/api';
import { distanceLabel } from '@/lib/format';
import { useDiscoveryParams } from '@/lib/location';
import { useTheme } from '@/theme';

export default function EventScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loc = useDiscoveryParams();
  const q = useQuery({ queryKey: ['event', id, loc.lat, loc.lng], queryFn: () => api.event(id, loc.usingGps ? { lat: loc.lat, lng: loc.lng } : {}) });
  useEffect(() => {
    if (q.data) void api.interactions([{ entityType: 'event', entityId: id, kind: 'open' }]).catch(() => undefined);
  }, [q.data, id]);

  if (q.isLoading) return <View style={{ padding: 20, gap: 14, backgroundColor: th.c.background, flex: 1 }}><Skeleton width="100%" height={210} radius={20} /><Skeleton width="70%" height={26} /><Skeleton width="50%" height={16} /></View>;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const e: EventDTO = q.data.event;
  const where = [e.venue.name, e.venue.address, e.city?.name].filter(Boolean).join(', ');
  const priceValue = e.price.label ?? t('common.priceUnknown');

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <SaveButton entity={e} />, headerLeft: headerLeftForDirectOpen() }} />
      <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 48, maxWidth: 820, width: '100%', alignSelf: 'center' }}>
        <Cover entity={e} height={210} radius={th.radius.lg} />
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {e.isDemo ? <Badge label={t('common.demo')} tone="dark" /> : null}
          <Badge label={e.category.label} tone="primary" />
          <VerificationBadge v={e.verification} />
          {e.ageMin ? <Badge label={t('detail.ageLimit', { age: e.ageMin })} tone="neutral" /> : null}
        </View>
        <Txt v="display" accessibilityRole="header" style={{ textDecorationLine: e.status === 'cancelled' ? 'line-through' : 'none' }}>{e.title}</Txt>
        {e.status === 'cancelled' ? <Banner icon="cancel" tone="warning" text={t('card.cancelled')} /> : null}
        {e.status === 'postponed' ? <Banner icon="calendar-clock" tone="warning" text={t('card.postponed')} /> : null}
        {e.time.unconfirmed ? <Banner icon="alert-outline" tone="warning" text={t('verification.conflictHelp')} /> : null}

        <EntityActions entity={e} />
        <EventSchedule event={e} />
        <View style={{ gap: 14 }}>
          <Tap disabled={!e.venue.placeId} onPress={() => e.venue.placeId && router.push({ pathname: '/place/[id]', params: { id: e.venue.placeId } })} accessibilityRole={e.venue.placeId ? 'link' : undefined}>
            <InfoLine icon="map-marker-outline" label={t('card2.venue')} value={where || t('card2.unknown')}
              sub={[e.location?.precision === 'city' ? t('detail.cityOnly') : e.location?.precision === 'approximate' ? t('detail.approxLocation') : null, distanceLabel(e.distanceKm)].filter(Boolean).join(' · ') || null} />
          </Tap>
          <InfoLine icon="ticket-outline" label={t('card2.tickets')} value={priceValue} />
          <InfoLine icon="account-child-outline" label={t('card2.age')} value={e.ageMin ? t('detail.ageLimit', { age: e.ageMin }) : t('card2.ageAll')} />
          <InfoLine icon="account-group-outline" label={t('card2.organizer')} value={e.organizer ?? t('card2.unknown')} />
        </View>

        {e.ticketUrl || e.website ? (
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {e.ticketUrl ? <Button title={t('detail.tickets')} icon="ticket-confirmation-outline" onPress={() => { void api.interactions([{ entityType: 'event', entityId: e.id, kind: 'click_ticket' }]).catch(() => undefined); void WebBrowser.openBrowserAsync(e.ticketUrl!); }} /> : null}
            {e.website ? <Button title={t('detail.website')} icon="web" kind="secondary" onPress={() => void WebBrowser.openBrowserAsync(e.website!)} /> : null}
          </View>
        ) : null}

        {e.description || q.data.summary ? (
          <View style={{ gap: 6 }}>
            <Txt v="headline">{t('card2.about')}</Txt>
            {e.description ? <Txt v="body" tone="secondary">{e.description}</Txt> : null}
            {q.data.summary && (!e.description || e.description.length < 120) ? (
              <>
                <Txt v="body" tone="secondary">{q.data.summary.text}</Txt>
                <Txt v="caption" tone="tertiary">{q.data.summary.engine === 'ai' ? t('card2.summaryAi') : t('card2.summaryFacts')}</Txt>
              </>
            ) : null}
          </View>
        ) : null}
        <VerificationBlock entity={e} />
      </ScrollView>
    </>
  );
}
