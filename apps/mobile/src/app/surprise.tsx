import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { EntityCard } from '@/components/cards';
import { Button, EmptyState, ErrorState, Skeleton, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useDiscoveryParams } from '@/lib/location';
import { useAppState } from '@/lib/store';
import { useTheme } from '@/theme';

export default function Surprise() {
  const th = useTheme();
  const { t } = useTranslation();
  const p = useDiscoveryParams();
  const interests = useAppState((s) => s.interests);
  const q = useQuery({ queryKey: ['surprise', p.lat, p.lng, p.city, interests], queryFn: () => api.surprise({ lat: p.lat, lng: p.lng, city: p.city, radius: p.radius, interests }), gcTime: 0 });
  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}>
      <Txt v="display" accessibilityRole="header">{t('surprise.title')}</Txt>
      {q.isLoading ? [0, 1].map((i) => <Skeleton key={i} width="100%" height={260} radius={20} />) : null}
      {q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}
      {q.data?.items.length === 0 ? <EmptyState icon="dice-multiple-outline" title={t('surprise.empty')} /> : null}
      {q.data?.items.map((r) => <View key={r.entity.id}><EntityCard entity={r.entity} width={340} reason={r.reason} /></View>)}
      <Button title={t('surprise.again')} icon="shuffle-variant" kind="secondary" loading={q.isFetching} onPress={() => void q.refetch()} />
    </ScrollView>
  );
}
