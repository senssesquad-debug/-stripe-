import { cityBySlug, GROUP_LABELS, pickText, type Locale } from '@passtra/core';
import { useMeta } from '@/lib/queries';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPanel } from '@/components/map-view';
import { Chip } from '@/components/ui';
import { useDiscoveryParams } from '@/lib/location';
import { useTheme } from '@/theme';

const GROUPS = ['music', 'nightlife', 'food', 'culture', 'nature', 'family', 'shopping', 'practical'] as const;

export default function MapTab() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useDiscoveryParams();
  const meta = useMeta();
  const [layers, setLayers] = useState<'events,places' | 'events' | 'places'>('events,places');
  const [group, setGroup] = useState<string | null>(null);
  const [openNow, setOpenNow] = useState(false);
  const centerOf = params.usingGps ? { lat: params.lat!, lng: params.lng! } : (() => { const c = cityBySlug(params.city ?? 'limassol')!; return { lat: c.lat, lng: c.lng }; })();
  const category = group ? meta.data?.groups.find((g) => g.key === group)?.categories.join(',') : undefined;
  const filters = useMemo(() => ({ layers, category, open_now: openNow || undefined }), [layers, category, openNow]);
  const center = useMemo(() => centerOf, [centerOf.lat, centerOf.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ flex: 1, backgroundColor: th.c.background, paddingTop: insets.top }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
        <Chip icon="calendar-blank-outline" label={t('explore.events')} active={layers === 'events'} onPress={() => setLayers(layers === 'events' ? 'events,places' : 'events')} />
        <Chip icon="storefront-outline" label={t('explore.places')} active={layers === 'places'} onPress={() => setLayers(layers === 'places' ? 'events,places' : 'places')} />
        <Chip icon="clock-outline" label={t('explore.openNow')} active={openNow} onPress={() => setOpenNow(!openNow)} />
        {GROUPS.map((g) => <Chip key={g} label={pickText(GROUP_LABELS[g], i18n.language as Locale)} active={group === g} onPress={() => setGroup(group === g ? null : g)} />)}
      </ScrollView>
      <MapPanel center={center} filters={filters} />
    </View>
  );
}
