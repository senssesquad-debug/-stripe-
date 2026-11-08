import { cityBySlug, pickText, type Locale, type SearchResponse } from '@passtra/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EntityRow } from '@/components/cards';
import { Badge, Banner, Chip, EmptyState, ErrorState, Icon, Skeleton, Tap, Txt } from '@/components/ui';
import { api, type Suggestion } from '@/lib/api';
import { iconFor } from '@/lib/icons';
import { useDiscoveryParams } from '@/lib/location';
import { addRecent, clearRecent, loadRecent } from '@/lib/recent-searches';
import { useAppState } from '@/lib/store';
import { useTheme } from '@/theme';

type Scope = 'near' | 'city';

/**
 * Search: autocomplete (categories, cities, real places/events), recent searches, typo correction ("showing results
 * for …"), near-me or whole-city scope, and an offer to widen the radius when little is found nearby.
 * Results always come from passtra's database; AI only interprets the query.
 */
export default function Search() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useDiscoveryParams();
  const interests = useAppState((s) => s.interests);
  const homeCity = useAppState((s) => s.city);
  const [q, setQ] = useState('');
  const [typing, setTyping] = useState('');
  const [scope, setScope] = useState<Scope>(params.usingGps ? 'near' : 'city');
  const [radius, setRadius] = useState<number | undefined>(undefined);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { void loadRecent().then(setRecent); }, []);
  useEffect(() => { const id = setTimeout(() => setTyping(q.trim()), 220); return () => clearTimeout(id); }, [q]);

  const m = useMutation<SearchResponse, Error, { query: string; radius?: number; scope: Scope }>({
    mutationFn: ({ query, radius: r, scope: sc }) => api.search(query, sc === 'near' && params.usingGps
      ? { lat: params.lat, lng: params.lng, radius: r ?? params.radius, interests }
      : { city: params.city ?? homeCity, radius: r, interests }),
  });
  const searched = m.variables?.query ?? null;
  const showSuggest = typing.length >= 2 && typing !== searched;
  const suggest = useQuery({ queryKey: ['suggest', typing], queryFn: () => api.suggest(typing, params.usingGps ? { lat: params.lat, lng: params.lng } : {}), enabled: showSuggest, staleTime: 60_000 });

  const run = (query: string, opts: { radius?: number; scope?: Scope } = {}) => {
    const qq = query.trim();
    if (!qq) return;
    setQ(qq);
    setTyping(qq);
    setRadius(opts.radius);
    m.mutate({ query: qq, radius: opts.radius, scope: opts.scope ?? scope });
    void addRecent(qq).then(setRecent);
  };
  const pick = (s: Suggestion) => {
    if (s.type === 'event' || s.type === 'place') {
      void addRecent(s.label).then(setRecent);
      router.push(s.type === 'event' ? { pathname: '/event/[id]', params: { id: s.id } } : { pathname: '/place/[id]', params: { id: s.id } });
    } else run(s.label);
  };
  const cityName = cityBySlug(params.city ?? homeCity)?.name;
  const examples = ['ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6'] as const;
  const data = m.data;

  return (
    <View style={{ flex: 1, backgroundColor: th.c.background, paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 48, borderRadius: th.radius.pill, backgroundColor: th.c.surface, borderWidth: 1, borderColor: th.c.border }}>
          <Icon name="magnify" size={20} color={th.c.textSecondary} />
          <TextInput autoFocus value={q} onChangeText={setQ} onSubmitEditing={() => run(q)} returnKeyType="search" placeholder={t('search.placeholder')} placeholderTextColor={th.c.textTertiary}
            style={{ flex: 1, color: th.c.text, fontFamily: th.font.medium, fontSize: 15 }} accessibilityLabel={t('search.placeholder')} autoCorrect={false} />
          {q ? <Tap onPress={() => { setQ(''); m.reset(); }} accessibilityLabel={t('common.clear')}><Icon name="close-circle" size={18} color={th.c.textTertiary} /></Tap> : null}
        </View>
        <Tap onPress={() => router.back()} accessibilityRole="button"><Txt v="bodyStrong" tone="primary">{t('common.cancel')}</Txt></Tap>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        {params.usingGps ? <Chip icon="crosshairs-gps" label={t('search.nearMe')} active={scope === 'near'} onPress={() => { setScope('near'); if (searched) m.mutate({ query: searched, scope: 'near' }); }} /> : null}
        <Chip icon="city-variant-outline" label={t('search.wholeCity', { city: cityName ? pickText(cityName, i18n.language as Locale) : '' })} active={scope === 'city'} onPress={() => { setScope('city'); if (searched) m.mutate({ query: searched, scope: 'city' }); }} />
      </View>

      {showSuggest ? (
        <FlatList
          data={suggest.data?.suggestions ?? []}
          keyExtractor={(s, i) => `${s.type}:${'id' in s ? s.id : s.slug}:${i}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListHeaderComponent={(
            <Tap onPress={() => run(q)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
              <Icon name="magnify" size={20} color={th.c.primaryText} />
              <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{t('search.searchFor', { q: q.trim() })}</Txt>
            </Tap>
          )}
          renderItem={({ item: s }) => (
            <Tap onPress={() => pick(s)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
              <Icon name={s.type === 'category' ? iconFor(s.icon) : s.type === 'city' ? 'city-variant-outline' : s.type === 'event' ? 'calendar-star' : 'map-marker-outline'} size={20} color={th.c.textSecondary} />
              <View style={{ flex: 1 }}>
                <Txt v="body" numberOfLines={1}>{s.label}</Txt>
                {'sublabel' in s && s.sublabel ? <Txt v="caption" tone="tertiary" numberOfLines={1}>{s.sublabel}</Txt> : null}
              </View>
              <Txt v="micro" tone="tertiary">{t(`search.kind_${s.type}`)}</Txt>
            </Tap>
          )}
          ListFooterComponent={suggest.data?.didYouMean ? <Txt v="caption" tone="secondary" style={{ paddingTop: 6 }}>{t('search.didYouMean', { q: suggest.data.didYouMean })}</Txt> : undefined}
        />
      ) : (
        <FlatList
          data={data?.results ?? []}
          keyExtractor={(e) => `${e.type}:${e.id}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListHeaderComponent={data ? (
            <View style={{ gap: 8, paddingVertical: 8 }}>
              {data.didYouMean ? <Banner icon="spellcheck" text={t('search.showingFor', { q: data.didYouMean, original: searched })} /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {data.interpretation.summary ? <Txt v="bodyStrong">{data.interpretation.summary}</Txt> : null}
                {data.interpretation.engine === 'ai' ? <Badge label={t('search.ai')} tone="primary" icon="creation" /> : null}
              </View>
              <Txt v="caption" tone="tertiary">{t('search.resultsWithin', { count: data.total, km: data.radiusKm })}</Txt>
              {data.total > 0 && data.widen.length ? (
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {data.widen.map((w) => <Chip key={w.radiusKm} icon="arrow-expand-all" label={t('search.widenTo', { km: w.radiusKm, count: w.count })} onPress={() => run(searched ?? q, { radius: w.radiusKm })} />)}
                </View>
              ) : null}
            </View>
          ) : undefined}
          renderItem={({ item }) => <EntityRow entity={item} />}
          ListEmptyComponent={
            m.isPending ? <View style={{ gap: 14, paddingTop: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={72} />)}</View>
              : m.isError ? <ErrorState error={m.error} onRetry={() => run(q, { radius })} />
              : data ? (
                <View style={{ gap: 14, paddingTop: 12 }}>
                  <EmptyState icon="magnify-close" title={data.widen.length ? t('search.nothingWithin', { km: data.radiusKm }) : t('search.noResults')} />
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {data.widen.map((w) => <Chip key={w.radiusKm} icon="arrow-expand-all" label={t('search.widenTo', { km: w.radiusKm, count: w.count })} onPress={() => run(searched ?? q, { radius: w.radiusKm })} />)}
                  </View>
                </View>
              )
              : (
                <View style={{ gap: 8, paddingTop: 8 }}>
                  {recent.length ? (
                    <View style={{ gap: 2, marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Txt v="headline">{t('search.recent')}</Txt>
                        <Tap onPress={() => { void clearRecent(); setRecent([]); }} accessibilityRole="button"><Txt v="callout" tone="primary">{t('common.clear')}</Txt></Tap>
                      </View>
                      {recent.map((r) => (
                        <Tap key={r} onPress={() => run(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
                          <Icon name="history" size={18} color={th.c.textTertiary} />
                          <Txt v="body" numberOfLines={1}>{r}</Txt>
                        </Tap>
                      ))}
                    </View>
                  ) : null}
                  <Txt v="headline">{t('search.examples')}</Txt>
                  {examples.map((k) => (
                    <Tap key={k} onPress={() => run(t(`search.${k}`))} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
                      <Icon name="creation-outline" size={18} color={th.c.primaryText} />
                      <Txt v="body">{t(`search.${k}`)}</Txt>
                    </Tap>
                  ))}
                </View>
              )
          }
        />
      )}
    </View>
  );
}
