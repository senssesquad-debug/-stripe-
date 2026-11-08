import { GROUP_LABELS, pickText, type InterestGroup, type Locale, type PlanDayResponse } from '@passtra/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { EntityRow } from '@/components/cards';
import { Badge, Button, Chip, EmptyState, ErrorState, Icon, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useDiscoveryParams } from '@/lib/location';
import { useAppState } from '@/lib/store';
import { useTheme } from '@/theme';

const HOURS = ['08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '23:30'];
const GROUPS: InterestGroup[] = ['food', 'culture', 'nature', 'music', 'nightlife', 'family', 'shopping', 'art', 'adventure', 'sports'];

export default function Plan() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const p = useDiscoveryParams();
  const saved = useAppState((s) => s.interests);
  const now = new Date();
  const [start, setStart] = useState(HOURS.find((h) => Number(h.slice(0, 2)) > now.getHours()) ?? '10:00');
  const [end, setEnd] = useState('22:00');
  const [budget, setBudget] = useState<number | null>(null);
  const [mode, setMode] = useState<'walk' | 'drive' | 'auto'>('auto');
  const [interests, setInterests] = useState<InterestGroup[]>(saved.filter((g) => GROUPS.includes(g)).slice(0, 3));
  const m = useMutation<PlanDayResponse, Error>({ mutationFn: () => api.planDay({ lat: p.lat, lng: p.lng, city: p.city, start, end, budget, interests, mode }) });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 48 }}>
      <Txt v="display" accessibilityRole="header">{t('plan.title')}</Txt>
      <View style={{ gap: 8 }}>
        <Txt v="headline">{t('plan.from')}</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{HOURS.slice(0, -2).map((h) => <Chip key={h} label={h} active={start === h} onPress={() => setStart(h)} />)}</ScrollView>
        <Txt v="headline">{t('plan.to')}</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{HOURS.slice(3).map((h) => <Chip key={h} label={h} active={end === h} onPress={() => setEnd(h)} />)}</ScrollView>
      </View>
      <View style={{ gap: 8 }}>
        <Txt v="headline">{t('plan.budget')}</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[null, 0, 20, 50, 100].map((b) => <Chip key={String(b)} label={b === null ? t('plan.noLimit') : b === 0 ? t('common.free') : `€${b}`} active={budget === b} onPress={() => setBudget(b)} />)}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Txt v="headline">{t('plan.interests')}</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {GROUPS.map((g) => <Chip key={g} label={pickText(GROUP_LABELS[g], locale)} active={interests.includes(g)} onPress={() => setInterests((x) => (x.includes(g) ? x.filter((y) => y !== g) : [...x, g]))} />)}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Txt v="headline">{t('plan.transport')}</Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>{(['auto', 'walk', 'drive'] as const).map((x) => <Chip key={x} label={t(`plan.${x}`)} active={mode === x} onPress={() => setMode(x)} />)}</View>
      </View>
      <Button title={t('plan.build')} icon="map-marker-path" loading={m.isPending} onPress={() => m.mutate()} />

      {m.isError ? <ErrorState error={m.error} onRetry={() => m.mutate()} /> : null}
      {m.data && m.data.stops.length === 0 ? <EmptyState icon="calendar-remove-outline" title={t('plan.empty')} /> : null}
      {m.data && m.data.stops.length > 0 ? (
        <View style={{ gap: 4 }}>
          {m.data.stops.map((s, i) => (
            <View key={`${s.entity.id}-${i}`} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 54, alignItems: 'center' }}>
                <Txt v="bodyStrong">{s.arriveLabel}</Txt>
                <Txt v="caption" tone="tertiary">{s.departLabel}</Txt>
                {i < m.data!.stops.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: th.c.border, marginVertical: 4 }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: 12 }}>
                {i > 0 && s.travelMinFromPrev > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name={s.travelMode === 'walk' ? 'walk' : 'car'} size={14} color={th.c.textTertiary} />
                    <Txt v="caption" tone="tertiary">{t('plan.travel', { min: s.travelMinFromPrev, mode: t(s.travelMode === 'walk' ? 'plan.walking' : 'plan.driving') })}</Txt>
                  </View>
                ) : null}
                <EntityRow entity={s.entity} />
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {s.notes.includes('meal') ? <Badge label={t('plan.meal')} tone="primary" /> : null}
                  {s.notes.includes('fixed_time') ? <Badge label={t('plan.fixedTime')} /> : null}
                  {s.notes.includes('hours_unknown') ? <Badge label={t('plan.hoursUnknown')} tone="warning" /> : null}
                  {s.notes.includes('price_unknown') ? <Badge label={t('common.priceUnknown')} tone="warning" /> : null}
                </View>
              </View>
            </View>
          ))}
          <View style={{ padding: 14, borderRadius: th.radius.md, backgroundColor: th.c.surface, gap: 4 }}>
            <Txt v="bodyStrong">{t('plan.total', { amount: `€${m.data.totalKnownCost}` })}{m.data.stopsWithUnknownPrice ? ` · ${t('plan.unknownPrices', { count: m.data.stopsWithUnknownPrice })}` : ''}</Txt>
            <Txt v="caption" tone="secondary">{m.data.disclaimer}</Txt>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}
