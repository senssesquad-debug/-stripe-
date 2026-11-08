import { CITIES, GROUP_LABELS, LOCALES, ONBOARDING_INTERESTS, interestToGroups, pickText, type Locale, type OnboardingInterest } from '@passtra/core';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, Icon, Txt } from '@/components/ui';
import i18n, { LANGUAGE_NAMES } from '@/i18n';
import { useUserLocation } from '@/lib/location';
import { store, useAppState } from '@/lib/store';
import { useTheme } from '@/theme';

const INTEREST_ICON: Record<OnboardingInterest, Parameters<typeof Icon>[0]['name']> = {
  music: 'music-note', nightlife: 'glass-cocktail', food: 'silverware-fork-knife', shopping: 'shopping-outline', sports: 'run', nature: 'pine-tree',
  culture: 'bank-outline', family: 'human-male-female-child', adventure: 'compass-outline', technology: 'chip', art: 'palette-outline', other: 'dots-horizontal',
};

/** Background of the logo tile — the deep blue of the passtra logo (same as the app icon). */
const LOGO_BLUE = '#0009A9';

export default function Onboarding() {
  const th = useTheme();
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<OnboardingInterest[]>([]);
  const locale = useAppState((s) => s.locale) ?? (i18n.language as Locale);
  const city = useAppState((s) => s.city);
  const loc = useUserLocation();

  const finish = () => {
    store.set({ onboarded: true, interests: [...new Set(picked.flatMap(interestToGroups))] });
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: th.c.background }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[0, 1, 2].map((i) => <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? th.c.primary : th.c.border }} />)}
        </View>
        {step < 2 ? <Button title={t('common.skip')} kind="ghost" compact onPress={() => (step === 1 ? setStep(2) : setStep(step + 1))} /> : <View />}
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 20, flexGrow: 1 }}>
        {step === 0 && (
          <>
            <View style={{ alignItems: 'flex-start', gap: 18, marginTop: 24 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, overflow: 'hidden', backgroundColor: LOGO_BLUE, alignItems: 'center', justifyContent: 'center' }}>
                <Image source={require('@/assets/images/splash-icon.png')} style={{ width: 72, height: 72 }} />
              </View>
              <Image source={require('@/assets/brand/wordmark-blue.png')} style={{ width: 160, height: 48, marginLeft: -26 }} contentFit="contain" tintColor={th.dark ? '#FFFFFF' : undefined} />
              <Txt v="display">{t('onboarding.welcomeTitle')}</Txt>
              <Txt v="body" tone="secondary">{t('onboarding.welcomeBody')}</Txt>
            </View>
            <View style={{ gap: 10 }}>
              <Txt v="headline">{t('onboarding.language')}</Txt>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {LOCALES.map((l) => <Chip key={l} label={LANGUAGE_NAMES[l]} active={locale === l} onPress={() => store.set({ locale: l })} />)}
              </View>
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <Txt v="display" style={{ marginTop: 16 }}>{t('onboarding.interestsTitle')}</Txt>
            <Txt v="body" tone="secondary">{t('onboarding.interestsBody')}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {ONBOARDING_INTERESTS.map((i) => (
                <Chip key={i} icon={INTEREST_ICON[i]} label={pickText(GROUP_LABELS[i], locale)} active={picked.includes(i)}
                  onPress={() => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))} />
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: th.c.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 24 }}>
              <Icon name="crosshairs-gps" size={30} color={th.c.primaryText} />
            </View>
            <Txt v="display">{t('onboarding.locationTitle')}</Txt>
            <Txt v="body" tone="secondary">{t('onboarding.locationBody')}</Txt>
            {loc.status === 'denied' ? <Txt v="callout" tone="warning">{t('errors.locationDenied')}</Txt> : null}
            {loc.status === 'outside' ? <Txt v="callout" tone="warning">{t('errors.locationOutside')}</Txt> : null}
            <View style={{ gap: 10 }}>
              <Txt v="headline">{t('onboarding.chooseCity')}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CITIES.filter((c) => c.featured).map((c) => <Chip key={c.slug} label={pickText(c.name, locale)} active={city === c.slug} onPress={() => store.set({ city: c.slug })} />)}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ padding: 20, gap: 10 }}>
        {step < 2 ? (
          <Button title={t('common.continue')} onPress={() => setStep(step + 1)} />
        ) : (
          <>
            <Button title={t('onboarding.allowLocation')} icon="crosshairs-gps" onPress={async () => { await loc.request(); finish(); }} />
            <Button title={t('onboarding.start')} kind="secondary" onPress={() => { store.set({ useLocation: false }); finish(); }} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
