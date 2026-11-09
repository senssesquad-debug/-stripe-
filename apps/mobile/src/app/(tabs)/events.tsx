import { cityBySlug, pickText, type EventDTO, type Locale } from '@passtra/core';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cover, EntityCard, SaveButton, openEntity } from '@/components/cards';
import { MonthCalendar } from '@/components/month-calendar';
import { Badge, Chip, EmptyState, ErrorState, Icon, Skeleton, Tap, Txt } from '@/components/ui';
import { api, type EventFilters } from '@/lib/api';
import { distanceLabel } from '@/lib/format';
import { useDiscoveryParams } from '@/lib/location';
import { CYPRUS_TZ, todayIn } from '@/lib/my-events';
import { useAppState } from '@/lib/store';
import { useTheme } from '@/theme';

/** Sections of the Events tab → event categories. */
const SECTIONS: Record<string, string[] | null> = {
  all: null,
  concerts: ['concert', 'rock-metal', 'electronic', 'jazz-blues', 'classical'],
  festivals: ['music-festival', 'festival', 'food-festival'],
  markets: ['fair', 'exhibition', 'community-event'],
  nightlife: ['party', 'electronic'],
  sports: ['sports-event', 'motorsport'],
  family: ['kids-event'],
  culture: ['theatre', 'exhibition', 'film-screening', 'dance', 'comedy', 'classical', 'festival'],
};
type When = 'any' | 'today' | 'tomorrow' | 'weekend' | 'this_week';

function EventListCard({ e }: { e: EventDTO }) {
  const th = useTheme();
  const { t } = useTranslation();
  const where = [e.venue.name, e.city?.name].filter(Boolean).join(' · ');
  return (
    <Tap onPress={() => openEntity(e)} accessibilityRole="button" style={{ borderRadius: th.radius.lg, backgroundColor: th.c.surface, overflow: 'hidden', marginBottom: 12 }}>
      <View>
        <Cover entity={e} height={150} radius={0} width={600} />
        <View style={{ position: 'absolute', top: 10, right: 10 }}><SaveButton entity={e} onDark /></View>
      </View>
      <View style={{ padding: 14, gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Badge label={e.category.label} tone="primary" />
          {e.time.happeningNow ? <Badge label={t('card.now')} tone="success" /> : null}
          {e.status === 'cancelled' ? <Badge label={t('card.cancelled')} tone="danger" /> : null}
          {e.ageMin ? <Badge label={t('detail.ageLimit', { age: e.ageMin })} /> : null}
        </View>
        <Txt v="headline" numberOfLines={2}>{e.title}</Txt>
        <Txt v="callout" tone="primary">{e.time.label}</Txt>
        {where ? <Txt v="caption" tone="secondary" numberOfLines={1}>{where}{e.distanceKm !== null ? ` · ${distanceLabel(e.distanceKm)}` : ''}</Txt> : null}
        {e.description ? <Txt v="caption" tone="secondary" numberOfLines={2}>{e.description}</Txt> : null}
        <Txt v="callout" style={{ fontFamily: th.font.semibold }}>{e.price.label ?? t('common.priceUnknown')}</Txt>
      </View>
    </Tap>
  );
}

/** Events: sections, filters (date, city, distance, price, free, age), list or calendar, upcoming near you. */
export default function Events() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const p = useDiscoveryParams();
  const homeCity = useAppState((s) => s.city);
  const [section, setSection] = useState<keyof typeof SECTIONS>('all');
  const [when, setWhen] = useState<When>('any');
  const [day, setDay] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [scope, setScope] = useState<'city' | 'near'>(p.usingGps ? 'near' : 'city');
  const [radius, setRadius] = useState(15);
  const [price, setPrice] = useState<'any' | 'free' | 20 | 50>('any');
  const [age, setAge] = useState<'any' | 'family' | 'adults'>('any');
  const today = todayIn(CYPRUS_TZ);
  const [month, setMonth] = useState(today.slice(0, 7));

  const loc = scope === 'near' && p.usingGps ? { lat: p.lat, lng: p.lng, radius } : { city: p.city ?? homeCity };
  const filters: EventFilters = {
    ...(SECTIONS[section] ? { category: SECTIONS[section]!.join(',') } : {}),
    ...(day ? { from: day, to: day } : when !== 'any' ? { when } : {}),
    ...(price === 'free' ? { free: true } : typeof price === 'number' ? { maxPrice: price } : {}),
    ...(age !== 'any' ? { age } : {}),
  };
  const list = useInfiniteQuery({
    queryKey: ['events-tab', loc, filters],
    queryFn: ({ pageParam }) => api.events({ ...loc, ...filters, limit: 30, offset: pageParam, sort: 'time' }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.items.length === 30 ? all.length * 30 : undefined),
    enabled: view === 'list' || !!day,
  });
  const cal = useQuery({ queryKey: ['events-cal', month, loc, { ...filters, from: undefined, to: undefined, when: undefined }], queryFn: () => api.eventCalendar(month, { ...loc, ...filters, from: undefined, to: undefined, when: undefined }), enabled: view === 'calendar' });
  const near = useQuery({ queryKey: ['events-near', p.lat, p.lng], queryFn: () => api.events({ lat: p.lat, lng: p.lng, radius: 10, sort: 'distance', when: 'next_7_days', limit: 10 }), enabled: p.usingGps && section === 'all' && !day });
  const items = useMemo(() => list.data?.pages.flatMap((pg) => pg.items) ?? [], [list.data]);
  const cityName = pickText(cityBySlug(p.city ?? homeCity)?.name ?? { en: homeCity }, i18n.language as Locale);

  const header = (
    <View style={{ gap: 12, paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="display" accessibilityRole="header">{t('events.title')}</Txt>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Chip icon="format-list-bulleted" label={t('events.list')} active={view === 'list'} onPress={() => { setView('list'); setDay(null); }} />
          <Chip icon="calendar-month-outline" label={t('events.calendar')} active={view === 'calendar'} onPress={() => setView('calendar')} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {Object.keys(SECTIONS).map((k) => <Chip key={k} label={t(`events.s_${k}`)} active={section === k} onPress={() => setSection(k as keyof typeof SECTIONS)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(['any', 'today', 'tomorrow', 'weekend', 'this_week'] as When[]).map((w) => <Chip key={w} label={w === 'any' ? t('explore.any') : t(`time.${w}`)} active={!day && when === w} onPress={() => { setWhen(w); setDay(null); }} />)}
        {day ? <Chip icon="calendar-check" label={new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))} active onPress={() => setDay(null)} /> : null}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip icon="city-variant-outline" label={cityName} active={scope === 'city'} onPress={() => setScope('city')} />
        {p.usingGps ? [5, 15, 50].map((r) => <Chip key={r} icon="crosshairs-gps" label={t('events.within', { km: r })} active={scope === 'near' && radius === r} onPress={() => { setScope('near'); setRadius(r); }} />)
          : <Chip icon="crosshairs-gps" label={t('events.useLocation')} onPress={() => void p.request()} />}
        <Chip icon="swap-horizontal" label={t('events.changeCity')} onPress={() => router.push('/city')} />
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label={t('events.anyPrice')} active={price === 'any'} onPress={() => setPrice('any')} />
        <Chip label={t('common.free')} active={price === 'free'} onPress={() => setPrice('free')} />
        <Chip label="≤ €20" active={price === 20} onPress={() => setPrice(20)} />
        <Chip label="≤ €50" active={price === 50} onPress={() => setPrice(50)} />
        <Chip icon="human-male-child" label={t('events.ageFamily')} active={age === 'family'} onPress={() => setAge(age === 'family' ? 'any' : 'family')} />
        <Chip label="18+" active={age === 'adults'} onPress={() => setAge(age === 'adults' ? 'any' : 'adults')} />
      </ScrollView>
      {view === 'calendar' ? (
        <MonthCalendar month={month} counts={cal.data?.days ?? {}} selected={day} today={today}
          onSelect={(d) => setDay(d)}
          onMonth={(dlt) => { const [y, m] = month.split('-').map(Number) as [number, number]; const nm = new Date(Date.UTC(y, m - 1 + dlt, 1)); setMonth(nm.toISOString().slice(0, 7)); }} />
      ) : null}
      {view === 'list' && near.data && near.data.items.length ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="crosshairs-gps" size={18} color={th.c.primaryText} />
            <Txt v="headline">{t('events.nearYou')}</Txt>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {near.data.items.map((e) => <EntityCard key={e.id} entity={e} width={240} />)}
          </ScrollView>
        </View>
      ) : null}
      {view === 'list' || day ? <Txt v="headline">{day ? t('events.onDay') : t(`events.s_${section}`)}</Txt> : null}
    </View>
  );

  const showList = view === 'list' || !!day;
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: th.c.background }}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: 40, maxWidth: 760, width: '100%', alignSelf: 'center' }}
      data={showList ? items : []}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={header}
      renderItem={({ item }) => <EventListCard e={item} />}
      onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage(); }}
      onEndReachedThreshold={0.5}
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}
      ListEmptyComponent={!showList ? <Txt v="callout" tone="secondary">{t('events.pickDay')}</Txt>
        : list.isLoading ? <View style={{ gap: 12 }}><Skeleton width="100%" height={220} /><Skeleton width="100%" height={220} /></View>
        : list.isError ? <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        : <EmptyState icon="calendar-blank-outline" title={t('events.empty')} />}
    />
  );
}
