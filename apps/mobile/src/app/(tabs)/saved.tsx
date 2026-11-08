import type { EntityDTO, EventDTO } from '@passtra/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EntityRow } from '@/components/cards';
import { Banner, Chip, EmptyState, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useAppState } from '@/lib/store';
import { useTheme } from '@/theme';

const isPast = (e: EntityDTO) => {
  if (e.type !== 'event') return false;
  const ev = e as EventDTO;
  const end = ev.time.precision === 'date_only' ? Date.parse(`${ev.time.localEndDate ?? ev.time.localStartDate}T23:59:59`) : Date.parse(ev.time.endsAt ?? ev.time.startsAt) + (ev.time.endsAt ? 0 : 3 * 3600_000);
  return end < Date.now() || ev.status === 'completed';
};

export default function Saved() {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const local = useAppState((s) => s.saved);
  const [filter, setFilter] = useState<'all' | 'event' | 'place' | 'past'>('all');
  // Signed in: the server copy is fresher (live status, cancellations); local snapshots are the offline fallback.
  const remote = useQuery({ queryKey: ['saved', session?.user.id], queryFn: api.saved, enabled: !!session });
  const items = useMemo(() => {
    const map = new Map<string, EntityDTO>(Object.values(local).map((x) => [x.entity.id, x.entity]));
    for (const r of remote.data?.items ?? []) map.set(r.entity.id, r.entity);
    return [...map.values()];
  }, [local, remote.data]);
  const shown = items.filter((e) => (filter === 'past' ? isPast(e) : !isPast(e) && (filter === 'all' || e.type === filter)));

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: th.c.background }}
      data={shown}
      keyExtractor={(e) => `${e.type}:${e.id}`}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 8 }}>
          <Txt v="display" accessibilityRole="header">{t('saved.title')}</Txt>
          {!session ? <Banner icon="cellphone-lock" text={t('saved.localNote')} /> : null}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip label={t('explore.all')} active={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label={t('saved.events')} active={filter === 'event'} onPress={() => setFilter('event')} />
            <Chip label={t('saved.places')} active={filter === 'place'} onPress={() => setFilter('place')} />
            <Chip label={t('saved.past')} active={filter === 'past'} onPress={() => setFilter('past')} />
          </View>
        </View>
      }
      renderItem={({ item }) => <EntityRow entity={item} />}
      ListEmptyComponent={<EmptyState icon="bookmark-outline" title={t('saved.empty')} />}
    />
  );
}
