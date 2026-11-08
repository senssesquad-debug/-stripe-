import type { SearchResponse } from '@passtra/core';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EntityRow } from '@/components/cards';
import { Badge, EmptyState, ErrorState, Icon, Skeleton, Tap, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useDiscoveryParams } from '@/lib/location';
import { useAppState } from '@/lib/store';
import { useTheme } from '@/theme';

export default function Search() {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useDiscoveryParams();
  const interests = useAppState((s) => s.interests);
  const [q, setQ] = useState('');
  const m = useMutation<SearchResponse, Error, string>({ mutationFn: (query) => api.search(query, { lat: params.lat, lng: params.lng, city: params.city, radius: params.radius, interests }) });
  const run = (query: string) => { setQ(query); if (query.trim()) m.mutate(query.trim()); };
  const examples = ['ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6'] as const;

  return (
    <View style={{ flex: 1, backgroundColor: th.c.background, paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 48, borderRadius: th.radius.pill, backgroundColor: th.c.surface, borderWidth: 1, borderColor: th.c.border }}>
          <Icon name="magnify" size={20} color={th.c.textSecondary} />
          <TextInput autoFocus value={q} onChangeText={setQ} onSubmitEditing={() => run(q)} returnKeyType="search" placeholder={t('search.placeholder')} placeholderTextColor={th.c.textTertiary}
            style={{ flex: 1, color: th.c.text, fontFamily: th.font.medium, fontSize: 15 }} accessibilityLabel={t('search.placeholder')} />
          {q ? <Tap onPress={() => setQ('')} accessibilityLabel={t('common.clear')}><Icon name="close-circle" size={18} color={th.c.textTertiary} /></Tap> : null}
        </View>
        <Tap onPress={() => router.back()} accessibilityRole="button"><Txt v="bodyStrong" tone="primary">{t('common.cancel')}</Txt></Tap>
      </View>
      <FlatList
        data={m.data?.results ?? []}
        keyExtractor={(e) => `${e.type}:${e.id}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        ListHeaderComponent={m.data ? (
          <View style={{ gap: 8, paddingVertical: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Txt v="caption" tone="secondary">{t('search.understood')}</Txt>
              {m.data.interpretation.engine === 'ai' ? <Badge label={t('search.ai')} tone="primary" icon="creation" /> : null}
            </View>
            {m.data.interpretation.summary ? <Txt v="bodyStrong">{m.data.interpretation.summary}</Txt> : null}
            <Txt v="caption" tone="tertiary">{t('search.results', { count: m.data.total })}</Txt>
          </View>
        ) : undefined}
        renderItem={({ item }) => <EntityRow entity={item} />}
        ListEmptyComponent={
          m.isPending ? <View style={{ gap: 14, paddingTop: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={72} />)}</View>
            : m.isError ? <ErrorState error={m.error} onRetry={() => run(q)} />
            : m.data ? <EmptyState icon="magnify-close" title={t('search.noResults')} />
            : (
              <View style={{ gap: 8, paddingTop: 8 }}>
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
    </View>
  );
}
