import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { EntityRow } from '@/components/cards';
import { headerLeftForDirectOpen } from '@/components/home-button';
import { Badge, ErrorState, Skeleton, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useTheme } from '@/theme';

/** A day plan someone shared — read-only, opens without signing in, re-checked against current data. */
export default function SharedPlan() {
  const th = useTheme();
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const q = useQuery({ queryKey: ['shared-plan', token], queryFn: () => api.sharedPlan(token) });
  const header = <Stack.Screen options={{ title: q.data?.title ?? '', headerLeft: headerLeftForDirectOpen() }} />;
  if (q.isLoading) return <>{header}<View style={{ padding: 20 }}><Skeleton width="100%" height={120} /></View></>;
  if (q.isError || !q.data) return <>{header}<ErrorState error={q.error} onRetry={() => void q.refetch()} /></>;
  const plan = q.data.plan;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      {header}
      <Txt v="title" accessibilityRole="header">{q.data.title}</Txt>
      <Txt v="callout" tone="secondary">{q.data.date} · {q.data.params.start}–{q.data.params.end}{q.data.params.participants && q.data.params.participants > 1 ? ` · ${t('plan.forPeople', { count: q.data.params.participants })}` : ''}</Txt>
      {(plan?.stops ?? []).map((st, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 52 }}><Txt v="bodyStrong">{st.arriveLabel}</Txt><Txt v="caption" tone="tertiary">{st.departLabel}</Txt></View>
          <View style={{ flex: 1, gap: 4 }}>
            {st.entity ? <EntityRow entity={st.entity} /> : <Txt v="bodyStrong" style={{ paddingVertical: 10 }}>{st.custom?.title}</Txt>}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {(st.issues ?? []).filter((x) => x !== 'hours_unknown').map((x) => <Badge key={x} label={t(`plan.issue_${x}`)} tone="danger" />)}
            </View>
            {st.travelToNextMin !== null && st.distanceToNextKm !== null ? <Txt v="caption" tone="tertiary">{t('plan.toNext', { km: st.distanceToNextKm, min: st.travelToNextMin })}</Txt> : null}
          </View>
        </View>
      ))}
      {plan ? <Txt v="caption" tone="secondary">{plan.disclaimer}</Txt> : null}
    </ScrollView>
  );
}
