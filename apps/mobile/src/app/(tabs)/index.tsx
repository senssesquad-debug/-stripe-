import { cityBySlug, pickText, type Locale } from '@passtra/core';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Section } from '@/components/verification';
import { Banner, Button, EmptyState, ErrorState, Icon, Skeleton, Tap, Txt } from '@/components/ui';
import { useDiscoveryParams } from '@/lib/location';
import { useFeed } from '@/lib/queries';
import { useTheme } from '@/theme';

const WEATHER_ICON: Record<string, Parameters<typeof Icon>[0]['name']> = {
  clearsky: 'weather-sunny', fair: 'weather-partly-cloudy', partlycloudy: 'weather-partly-cloudy', cloudy: 'weather-cloudy', fog: 'weather-fog',
  rain: 'weather-rainy', lightrain: 'weather-rainy', heavyrain: 'weather-pouring', rainshowers: 'weather-rainy', thunder: 'weather-lightning-rainy', snow: 'weather-snowy',
};

function HeaderButton({ icon, label, onPress }: { icon: Parameters<typeof Icon>[0]['name']; label: string; onPress: () => void }) {
  const th = useTheme();
  return (
    <Tap onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: th.c.surface, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} />
    </Tap>
  );
}

function FeedSkeleton() {
  return (
    <View style={{ gap: 28, paddingTop: 8 }}>
      {[0, 1].map((s) => (
        <View key={s} style={{ gap: 12, paddingHorizontal: 20 }}>
          <Skeleton width={180} height={22} />
          <View style={{ flexDirection: 'row', gap: 16 }}>
            {[0, 1].map((i) => <View key={i} style={{ gap: 8 }}><Skeleton width={248} height={154} radius={20} /><Skeleton width={200} height={16} /><Skeleton width={140} height={12} /></View>)}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function Today() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useDiscoveryParams();
  const { lat, lng, city, radius } = params;
  const feed = useFeed({ lat, lng, city, radius });
  const locale = i18n.language as Locale;
  const cityName = feed.data?.context.city?.name ?? (params.city ? pickText(cityBySlug(params.city)?.name ?? { en: params.city }, locale) : '');
  const w = feed.data?.weather;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: th.c.background }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 40, gap: 24 }}
      refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()} tintColor={th.c.primary} />}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Tap onPress={() => router.push('/city')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
            <Icon name={params.usingGps ? 'crosshairs-gps' : 'map-marker-outline'} size={18} color={th.c.primaryText} />
            <Txt v="bodyStrong" numberOfLines={1}>{params.usingGps ? (cityName || t('today.nearYou')) : cityName}</Txt>
            <Icon name="chevron-down" size={18} color={th.c.textSecondary} />
          </Tap>
          {w ? (
            <View accessibilityLabel={`${w.temperatureC}°, ${w.summary}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 40, borderRadius: 20, backgroundColor: th.c.surface }}>
              <Icon name={WEATHER_ICON[w.symbol.replace(/_(day|night|polartwilight)$/, '').replace(/^light|^heavy/, '').replace(/showers$/, '')] ?? 'weather-partly-cloudy'} size={18} color={th.c.primaryText} />
              <Txt v="bodyStrong">{w.temperatureC}°</Txt>
            </View>
          ) : null}
          <HeaderButton icon="magnify" label="Search" onPress={() => router.push('/search')} />
          <HeaderButton icon="bell-outline" label={t('profile.notifications')} onPress={() => router.push('/notifications')} />
          <HeaderButton icon="account-circle-outline" label={t('tabs.profile')} onPress={() => router.push('/profile')} />
        </View>
        <View>
          <Txt v="display" accessibilityRole="header">{t('today.title')}</Txt>
          <Txt v="body" tone="secondary">{t('today.subtitle')}</Txt>
        </View>
        <Tap onPress={() => router.push('/search')} accessibilityRole="search" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 50, borderRadius: th.radius.pill, backgroundColor: th.c.surface, borderWidth: 1, borderColor: th.c.border }}>
          <Icon name="magnify" size={20} color={th.c.textSecondary} />
          <Txt v="callout" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>{t('search.placeholder')}</Txt>
        </Tap>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title={t('today.surprise')} icon="dice-multiple-outline" kind="primary" compact style={{ flex: 1 }} onPress={() => router.push('/surprise')} />
          <Button title={t('today.plan')} icon="map-marker-path" kind="secondary" compact style={{ flex: 1 }} onPress={() => router.push('/plan')} />
        </View>
        {!params.usingGps && (params.status === 'denied' || params.status === 'unknown') ? (
          <Banner icon="crosshairs-off" text={t('today.locationOff', { city: cityName })} action={{ label: t('today.enableLocation'), onPress: () => void params.request() }} />
        ) : null}
        {params.status === 'outside' ? <Banner icon="earth" tone="warning" text={t('errors.locationOutside')} /> : null}
        {feed.data?.fromCache ? <Banner icon="wifi-off" tone="warning" text={t('common.offlineCached', { time: new Date(feed.data.generatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })} action={{ label: t('common.retry'), onPress: () => void feed.refetch() }} /> : null}
      </View>

      {feed.isLoading ? <FeedSkeleton /> : null}
      {feed.isError && !feed.data ? <ErrorState error={feed.error} onRetry={() => void feed.refetch()} /> : null}
      {feed.data ? (
        <>
          {feed.data.dataNotice ? <View style={{ paddingHorizontal: 20 }}><Banner icon="information-outline" text={feed.data.dataNotice} action={{ label: t('profile.addEvent'), onPress: () => router.push('/submit') }} /></View> : null}
          {feed.data.sections.map((s) => <Section key={s.key} title={s.title} subtitle={s.subtitle} items={s.items} />)}
          {feed.data.sections.length === 0 ? <EmptyState title={t('today.empty')} action={{ label: t('today.changeCity'), onPress: () => router.push('/city') }} /> : null}
          {w ? <Txt v="caption" tone="tertiary" style={{ paddingHorizontal: 20 }}>{w.attribution}</Txt> : null}
        </>
      ) : null}
    </ScrollView>
  );
}
