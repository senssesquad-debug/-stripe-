import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { Badge, EmptyState, ErrorState, Icon, Skeleton, Tap, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuthReady, useSession } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { confirmAsync, showToast } from '@/lib/feedback';
import { useTheme } from '@/theme';

/** Saved day plans: open to edit, delete. */
export default function MyPlans() {
  const th = useTheme();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const session = useSession();
  const ready = useAuthReady();
  const q = useQuery({ queryKey: ['my-plans', session?.user.id], queryFn: api.myPlans, enabled: !!session });
  if (ready && !session) return <Redirect href={{ pathname: '/signin', params: { reason: 'myEvents' } }} />;
  return (
    <>
      <Stack.Screen options={{ title: t('plan.myPlans') }} />
      <FlatList style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 8, maxWidth: 720, width: '100%', alignSelf: 'center' }}
        data={q.data?.items ?? []} keyExtractor={(x) => x.id}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: th.radius.lg, backgroundColor: th.c.surface }}>
            <Tap style={{ flex: 1, gap: 4 }} onPress={() => router.push({ pathname: '/plan', params: { planId: item.id } })} accessibilityRole="button">
              <Txt v="bodyStrong">{item.title}</Txt>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Badge label={item.date} />
                <Badge label={t('plan.stopsCount', { count: item.stops })} />
                {item.shared ? <Badge label={t('plan.sharedBadge')} tone="primary" icon="link-variant" /> : null}
              </View>
            </Tap>
            <Tap accessibilityLabel={t('plan.remove')} onPress={async () => {
              if (!(await confirmAsync(t('plan.deleteTitle'), t('plan.deleteBody'), t('plan.remove'), t('common.cancel'), true))) return;
              try { await api.deletePlan(item.id); await qc.invalidateQueries({ queryKey: ['my-plans'] }); } catch (e) { showToast(errorText(e), 'error'); }
            }}><Icon name="delete-outline" size={22} color={th.c.textTertiary} /></Tap>
          </View>
        )}
        ListEmptyComponent={q.isLoading ? <Skeleton width="100%" height={64} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : <EmptyState icon="map-marker-path" title={t('plan.noPlans')} action={{ label: t('plan.title'), onPress: () => router.push('/plan') }} />}
      />
    </>
  );
}
