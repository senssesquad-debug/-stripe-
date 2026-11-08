import { CITIES, GROUP_LABELS, INTEREST_GROUPS, RADIUS_OPTIONS_KM, pickText, type EntityDTO, type InterestGroup, type Locale } from '@passtra/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EntityRow } from '@/components/cards';
import { Chip, EmptyState, ErrorState, Skeleton, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useDiscoveryParams } from '@/lib/location';
import { store, useAppState } from '@/lib/store';
import { useTheme } from '@/theme';

const WHEN = ['today', 'tonight', 'tomorrow', 'weekend', 'next_7_days'] as const;

export default function Explore() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const locale = i18n.language as Locale;
  const params = useDiscoveryParams();
  const city = useAppState((s) => s.city);
  const [nearMe, setNearMe] = useState(false);
  const [group, setGroup] = useState<InterestGroup | null>(null);
  const [kind, setKind] = useState<'events' | 'places' | 'all'>('all');
  const [when, setWhen] = useState<(typeof WHEN)[number] | null>(null);
  const [radius, setRadius] = useState<number | null>(null);
  const [openNow, setOpenNow] = useState(false);
  const [free, setFree] = useState(false);

  const loc = nearMe && params.usingGps ? { lat: params.lat, lng: params.lng, radius: radius ?? 10 } : { city, radius: radius ?? undefined };
  const q = useQuery({
    queryKey: ['explore', loc, group, kind, when, openNow, free, locale],
    queryFn: async () => {
      const [ev, pl] = await Promise.all([
        kind !== 'places' && !openNow ? api.events({ ...loc, group: group ?? undefined, when: when ?? undefined, free: free || undefined, limit: 40 }) : Promise.resolve({ items: [] }),
        kind !== 'events' && !when ? api.places({ ...loc, group: group ?? undefined, open_now: openNow || undefined, free: free || undefined, limit: 40 }) : Promise.resolve({ items: [] }),
      ]);
      return [...ev.items, ...pl.items] as EntityDTO[];
    },
  });

  const header = (
    <View style={{ gap: 14, paddingTop: insets.top + 12, paddingBottom: 8 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <Txt v="display" accessibilityRole="header">{t('explore.title')}</Txt>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {params.usingGps ? <Chip icon="crosshairs-gps" label={t('today.nearYou')} active={nearMe} onPress={() => setNearMe(true)} /> : null}
        {CITIES.filter((c) => c.featured).map((c) => (
          <Chip key={c.slug} label={pickText(c.name, locale)} active={!nearMe && city === c.slug} onPress={() => { setNearMe(false); store.set({ city: c.slug }); }} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        <Chip label={t('explore.all')} active={!group} onPress={() => setGroup(null)} />
        {INTEREST_GROUPS.map((g) => <Chip key={g} label={pickText(GROUP_LABELS[g], locale)} active={group === g} onPress={() => setGroup(group === g ? null : g)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        <Chip icon="calendar-blank-outline" label={t('explore.events')} active={kind === 'events'} onPress={() => setKind(kind === 'events' ? 'all' : 'events')} />
        <Chip icon="storefront-outline" label={t('explore.places')} active={kind === 'places'} onPress={() => setKind(kind === 'places' ? 'all' : 'places')} />
        <Chip icon="clock-outline" label={t('explore.openNow')} active={openNow} onPress={() => { setOpenNow(!openNow); setWhen(null); }} />
        <Chip icon="tag-outline" label={t('explore.freeOnly')} active={free} onPress={() => setFree(!free)} />
        {WHEN.map((w) => <Chip key={w} label={t(`time.${w}`)} active={when === w} onPress={() => { setWhen(when === w ? null : w); setOpenNow(false); }} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, alignItems: 'center' }}>
        <Txt v="caption" tone="secondary">{t('explore.radius')}</Txt>
        {RADIUS_OPTIONS_KM.map((r) => <Chip key={r} label={`${r} ${t('common.km')}`} active={radius === r} onPress={() => setRadius(radius === r ? null : r)} />)}
      </ScrollView>
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: th.c.background }}
      data={q.data ?? []}
      keyExtractor={(e) => `${e.type}:${e.id}`}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingBottom: 40 }}
      renderItem={({ item }) => <View style={{ paddingHorizontal: 20 }}><EntityRow entity={item} /></View>}
      ListEmptyComponent={
        q.isLoading ? (
          <View style={{ padding: 20, gap: 16 }}>{[0, 1, 2, 3].map((i) => <View key={i} style={{ flexDirection: 'row', gap: 12 }}><Skeleton width={72} height={72} /><View style={{ flex: 1, gap: 8 }}><Skeleton width="60%" height={14} /><Skeleton width="90%" height={18} /></View></View>)}</View>
        ) : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : <EmptyState icon="filter-off-outline" title={t('explore.noResults')} />
      }
    />
  );
}
