import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { EntityRow } from '@/components/cards';
import { openOnMap } from '@/components/map-shared';
import { Button, EmptyState, ErrorState, Skeleton, Txt } from '@/components/ui';
import { availabilityText } from '@/components/what-to-do';
import { api, type ActivityWhen, type Availability } from '@/lib/api';
import { useDiscoveryParams } from '@/lib/location';
import { useAppState } from '@/lib/store';
import { useTheme } from '@/theme';

/** Every real option nearby for one activity, available ones first, each with its availability and a route. */
export default function ActivityScreen() {
  const th = useTheme();
  const { t } = useTranslation();
  const a = useLocalSearchParams<{ key: string; when?: ActivityWhen; vibes?: string; cost?: 'any' | 'free' | 'paid' }>();
  const p = useDiscoveryParams();
  const interests = useAppState((s) => s.interests);
  const when = a.when ?? 'today';
  const q = useQuery({
    queryKey: ['activity', a.key, when, a.cost, p.lat, p.lng, p.city, p.radius],
    queryFn: () => api.activities({ lat: p.lat, lng: p.lng, city: p.city, radius: p.radius, when, cost: a.cost ?? 'any', idea: a.key, interests }),
  });
  const g = q.data?.ideas[0];
  const tone: Record<Availability, string> = { open: th.c.success, on: th.c.success, unconfirmed: th.c.warning, seasonal: th.c.danger };

  return (
    <View style={{ flex: 1, backgroundColor: th.c.background }}>
      <Stack.Screen options={{ title: g?.label ?? '' }} />
      {q.isLoading ? <View style={{ padding: 20, gap: 12 }}><Skeleton width="70%" height={24} /><Skeleton width="100%" height={80} /><Skeleton width="100%" height={80} /></View> : null}
      {q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}
      {q.data && !g ? <EmptyState icon="map-search-outline" title={t('todo.nothing')} /> : null}
      {g ? (
        <FlatList
          data={g.options}
          keyExtractor={(o) => `${o.entity.type}:${o.entity.id}`}
          contentContainerStyle={{ padding: 20, gap: 14, maxWidth: 820, width: '100%', alignSelf: 'center' }}
          ListHeaderComponent={(
            <View style={{ gap: 4, marginBottom: 6 }}>
              <Txt v="display" accessibilityRole="header">{g.label}</Txt>
              <Txt v="callout" tone="secondary">{t(`todo.when_${when}`)} · {t('todo.options', { count: g.total })} · {availabilityText(when, 'open', g.available)}</Txt>
              <Txt v="caption" tone="tertiary">{t('todo.honesty')}</Txt>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={{ gap: 6 }} testID="activity-option">
              <EntityRow entity={item.entity} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone[item.availability] }} />
                <Txt v="caption" tone="secondary" style={{ flex: 1 }}>{availabilityText(when, item.availability)}</Txt>
                <Button title={t('route.route')} compact kind="ghost" icon="directions" onPress={() => openOnMap({ type: item.entity.type, id: item.entity.id }, true)} />
              </View>
            </View>
          )}
        />
      ) : null}
    </View>
  );
}
