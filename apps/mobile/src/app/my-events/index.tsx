import { useQuery } from '@tanstack/react-query';
import { Redirect, Stack, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { headerLeftForDirectOpen } from '@/components/home-button';
import { Badge, Banner, Button, Chip, EmptyState, ErrorState, Icon, Skeleton, Tap, Txt } from '@/components/ui';
import { api, type MyEvent } from '@/lib/api';
import { useAuthReady, useSession } from '@/lib/auth';
import { inDeviceTime, reminderStatusText } from '@/lib/my-events';
import { useTheme } from '@/theme';

function Item({ ev }: { ev: MyEvent }) {
  const th = useTheme();
  const reminder = reminderStatusText(ev);
  const local = inDeviceTime(ev.startsAt, ev.timezone);
  const bad = ev.reminder && (ev.reminder.status === 'failed' || ev.reminder.status === 'no_channel');
  return (
    <Tap onPress={() => router.push({ pathname: '/my-events/[id]', params: { id: ev.id } })} accessibilityRole="button"
      style={{ flexDirection: 'row', gap: 14, paddingVertical: 14, alignItems: 'flex-start' }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: th.c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={ev.entity?.type === 'place' ? 'map-marker-outline' : 'calendar-star'} size={22} color={th.c.primaryText} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Txt v="bodyStrong" numberOfLines={2}>{ev.title}</Txt>
        <Txt v="callout" tone="secondary">{ev.label}</Txt>
        {local ? <Txt v="caption" tone="tertiary">{local}</Txt> : null}
        {ev.location?.name || ev.location?.address ? <Txt v="caption" tone="secondary" numberOfLines={1}>{[ev.location.name, ev.location.address].filter(Boolean).join(' · ')}</Txt> : null}
        {reminder ? <View style={{ flexDirection: 'row', marginTop: 4 }}><Badge label={reminder} icon={bad ? 'bell-alert-outline' : 'bell-outline'} tone={bad ? 'warning' : 'neutral'} /></View> : null}
      </View>
      <Icon name="chevron-right" size={22} color={th.c.textTertiary} />
    </Tap>
  );
}

export default function MyEvents() {
  const th = useTheme();
  const { t } = useTranslation();
  const session = useSession();
  const ready = useAuthReady();
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const q = useQuery({ queryKey: ['my-events', scope, session?.user.id], queryFn: () => api.myEvents(scope), enabled: !!session });
  const channels = useQuery({ queryKey: ['notif-status', session?.user.id], queryFn: api.notificationStatus, enabled: !!session });
  if (ready && !session) return <Redirect href={{ pathname: '/signin', params: { reason: 'myEvents' } }} />;

  const items = q.data?.items ?? [];
  const needsChannel = scope === 'upcoming' && items.some((e) => e.reminder && e.reminder.status === 'scheduled')
    && channels.data && channels.data.channels.webPush + channels.data.channels.nativePush === 0;
  return (
    <>
      <Stack.Screen options={{ title: t('myEvents.title'), headerLeft: headerLeftForDirectOpen() }} />
      <FlatList
        style={{ flex: 1, backgroundColor: th.c.background }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' }}
        data={items}
        keyExtractor={(e) => e.id}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip label={t('myEvents.upcoming')} active={scope === 'upcoming'} onPress={() => setScope('upcoming')} />
              <Chip label={t('myEvents.past')} active={scope === 'past'} onPress={() => setScope('past')} />
              <View style={{ flex: 1 }} />
              <Button title={t('myEvents.new')} icon="plus" compact onPress={() => router.push({ pathname: '/my-events/[id]', params: { id: 'new' } })} />
            </View>
            {needsChannel ? <Banner icon="bell-off-outline" tone="warning" text={t('myEvents.noChannel')} action={{ label: t('myEvents.turnOn'), onPress: () => router.push('/notifications') }} /> : null}
          </View>
        }
        renderItem={({ item }) => <Item ev={item} />}
        ListEmptyComponent={q.isLoading ? <View style={{ gap: 12, paddingTop: 12 }}><Skeleton width="100%" height={64} /><Skeleton width="100%" height={64} /></View>
          : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          : <EmptyState icon="calendar-blank-outline" title={scope === 'upcoming' ? t('myEvents.empty') : t('myEvents.emptyPast')} />}
      />
    </>
  );
}
