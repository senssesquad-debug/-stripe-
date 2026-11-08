import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { api } from '@/lib/api';
import { router } from 'expo-router';
import { Banner, Icon, Tap, Txt } from './ui';
import { useTheme } from '@/theme';

/** Web preview: react-native-maps is native-only, so the web build lists the same markers. */
export function MapPanel({ center, filters }: { center: { lat: number; lng: number }; filters: { layers: string; category?: string; open_now?: boolean; free?: boolean } }) {
  const th = useTheme();
  const { t } = useTranslation();
  const d = 0.025;
  const bbox: [number, number, number, number] = [center.lng - d, center.lat - d, center.lng + d, center.lat + d];
  const q = useQuery({ queryKey: ['map-web', bbox, filters], queryFn: () => api.map(bbox, filters) });
  return (
    <FlatList
      data={q.data?.markers ?? []}
      keyExtractor={(m) => `${m.type}:${m.id}`}
      ListHeaderComponent={<View style={{ paddingVertical: 12 }}><Banner icon="map-outline" text={t('map.webNote')} /></View>}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      renderItem={({ item: m }) => (
        <Tap onPress={() => router.push(m.type === 'event' ? { pathname: '/event/[id]', params: { id: m.id } } : { pathname: '/place/[id]', params: { id: m.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
          <Icon name={m.type === 'event' ? 'calendar-star' : 'map-marker-outline'} size={22} color={th.c.primaryText} />
          <View style={{ flex: 1 }}>
            <Txt v="bodyStrong" numberOfLines={1}>{m.title}</Txt>
            {m.subtitle ? <Txt v="caption" tone="secondary" numberOfLines={1}>{m.subtitle}</Txt> : null}
          </View>
        </Tap>
      )}
    />
  );
}
