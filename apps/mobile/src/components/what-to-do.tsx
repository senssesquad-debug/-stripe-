import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import i18n from '@/i18n';
import { api, type ActivityGroup, type ActivityWhen, type Availability } from '@/lib/api';
import { iconFor } from '@/lib/icons';
import { useDiscoveryParams } from '@/lib/location';
import { useAppState } from '@/lib/store';
import { useTheme } from '@/theme';
import { Chip, Icon, Tap, Txt } from './ui';

export const WHENS: ActivityWhen[] = ['now', 'today', 'evening', 'tomorrow', 'weekend'];
export const VIBE_KEYS = ['indoor', 'outdoor', 'extreme', 'relaxing', 'sports', 'adventure', 'social', 'family'] as const;
const VIBE_ICON: Record<(typeof VIBE_KEYS)[number], Parameters<typeof Icon>[0]['name']> = {
  indoor: 'home-outline', outdoor: 'pine-tree', extreme: 'lightning-bolt-outline', relaxing: 'weather-sunset', sports: 'run', adventure: 'compass-outline', social: 'account-group-outline', family: 'human-male-female-child',
};

/** "3 open now", "hours not confirmed", "usually seasonal" — never "available" without confirmed hours or a dated event. */
export function availabilityText(when: ActivityWhen, a: Availability, count?: number): string {
  if (a === 'open' || a === 'on') return count !== undefined ? i18n.t(`todo.available_${when}`, { count }) : i18n.t(a === 'on' ? 'todo.eventOn' : `todo.open_${when}`);
  return a === 'seasonal' ? i18n.t('todo.seasonal') : i18n.t('todo.unconfirmed');
}

function IdeaCard({ g, when, onPress }: { g: ActivityGroup; when: ActivityWhen; onPress: () => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  const first = g.options[0];
  const state: Availability = g.available ? 'open' : first?.availability === 'seasonal' && g.options.every((o) => o.availability === 'seasonal') ? 'seasonal' : 'unconfirmed';
  return (
    <Tap onPress={onPress} accessibilityRole="button" testID={`idea-${g.key}`}
      style={{ width: 220, padding: 14, gap: 8, borderRadius: th.radius.lg, backgroundColor: th.c.surface, borderWidth: 1, borderColor: th.c.border }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: th.c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={iconFor(g.icon)} size={22} color={th.c.primaryText} />
      </View>
      <Txt v="bodyStrong" numberOfLines={2} style={{ minHeight: 42 }}>{g.label}</Txt>
      <Txt v="caption" tone="secondary" numberOfLines={1}>
        {t('todo.options', { count: g.total })}{g.nearestKm !== null ? ` · ${t('todo.nearest', { km: g.nearestKm })}` : ''}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: state === 'open' ? th.c.success : state === 'seasonal' ? th.c.danger : th.c.warning }} />
        <Txt v="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>{state === 'open' ? availabilityText(when, 'open', g.available) : availabilityText(when, state)}</Txt>
      </View>
      {first ? <Txt v="micro" tone="tertiary" numberOfLines={1}>{'name' in first.entity ? first.entity.name : first.entity.title}</Txt> : null}
    </Tap>
  );
}

/** Home block: concrete things to do with real options nearby, filtered by time and kind of outing. */
export function WhatToDo() {
  const th = useTheme();
  const { t } = useTranslation();
  const p = useDiscoveryParams();
  const interests = useAppState((s) => s.interests);
  const [when, setWhen] = useState<ActivityWhen>('today');
  const [vibes, setVibes] = useState<string[]>([]);
  const [cost, setCost] = useState<'any' | 'free' | 'paid'>('any');
  const q = useQuery({
    queryKey: ['activities', p.lat, p.lng, p.city, p.radius, when, vibes, cost, interests],
    queryFn: () => api.activities({ lat: p.lat, lng: p.lng, city: p.city, radius: p.radius, when, vibes, cost, interests }),
    placeholderData: keepPreviousData, staleTime: 5 * 60_000,
  });
  const toggle = (v: string) => setVibes((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  const open = (g: ActivityGroup) => router.push({ pathname: '/activity/[key]', params: { key: g.key, when, vibes: vibes.join(','), cost } });

  return (
    <View style={{ gap: 12 }} testID="what-to-do">
      <View style={{ paddingHorizontal: 20, gap: 2 }}>
        <Txt v="title" accessibilityRole="header">{t('todo.title').toUpperCase()}</Txt>
        <Txt v="callout" tone="secondary">{t('todo.subtitle')}</Txt>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {WHENS.map((w) => <Chip key={w} label={t(`todo.when_${w}`)} active={when === w} onPress={() => setWhen(w)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {VIBE_KEYS.map((v) => <Chip key={v} icon={VIBE_ICON[v]} label={t(`todo.vibe_${v}`)} active={vibes.includes(v)} onPress={() => toggle(v)} />)}
        <Chip icon="tag-outline" label={t('todo.free')} active={cost === 'free'} onPress={() => setCost(cost === 'free' ? 'any' : 'free')} />
        <Chip icon="cash" label={t('todo.paid')} active={cost === 'paid'} onPress={() => setCost(cost === 'paid' ? 'any' : 'paid')} />
      </ScrollView>
      {q.isLoading ? <ActivityIndicator color={th.c.primary} style={{ alignSelf: 'flex-start', marginLeft: 20 }} /> : null}
      {q.data && !q.data.ideas.length ? <Txt v="callout" tone="secondary" style={{ paddingHorizontal: 20 }}>{t('todo.nothing')}</Txt> : null}
      {q.data?.ideas.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }} style={{ opacity: q.isFetching ? 0.6 : 1 }}>
          {q.data.ideas.slice(0, 16).map((g) => <IdeaCard key={g.key} g={g} when={when} onPress={() => open(g)} />)}
        </ScrollView>
      ) : null}
    </View>
  );
}
