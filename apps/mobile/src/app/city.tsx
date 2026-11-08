import { CITIES, pickText, type Locale } from '@passtra/core';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Divider, Icon, Row, Txt } from '@/components/ui';
import { useDiscoveryParams } from '@/lib/location';
import { store, useAppState } from '@/lib/store';
import { useTheme } from '@/theme';

/** "Explore the City": pick any city regardless of where you are. */
export default function CityPicker() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const city = useAppState((s) => s.city);
  const useLoc = useAppState((s) => s.useLocation);
  const p = useDiscoveryParams();
  const locale = i18n.language as Locale;
  const sorted = [...CITIES].sort((a, b) => Number(b.featured) - Number(a.featured) || pickText(a.name, locale).localeCompare(pickText(b.name, locale), locale));
  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Txt v="title" style={{ marginBottom: 8 }}>{t('explore.title')}</Txt>
      <Row icon="crosshairs-gps" title={t('today.nearYou')} subtitle={p.status === 'denied' ? t('errors.locationDenied') : null}
        right={useLoc && p.usingGps ? <Icon name="check" color={th.c.primary} /> : undefined}
        onPress={async () => { await p.request(); router.back(); }} />
      <Divider />
      {sorted.map((c) => (
        <Row key={c.slug} icon="city-variant-outline" title={pickText(c.name, locale)}
          right={(!useLoc || !p.usingGps) && city === c.slug ? <Icon name="check" color={th.c.primary} /> : undefined}
          onPress={() => { store.set({ city: c.slug, useLocation: false }); router.back(); }} />
      ))}
    </ScrollView>
  );
}
