import { GROUP_LABELS, LOCALES, ONBOARDING_INTERESTS, interestToGroups, pickText, type Locale } from '@passtra/core';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Divider, Row, Txt } from '@/components/ui';
import { LANGUAGE_NAMES } from '@/i18n';
import { api } from '@/lib/api';
import { authAvailable, signOut, useSession } from '@/lib/auth';
import { store, useAppState } from '@/lib/store';
import { useTheme } from '@/theme';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ gap: 10 }}><Txt v="headline">{title}</Txt>{children}</View>;
}

export default function Profile() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const s = useAppState((x) => x);
  const locale = (s.locale ?? i18n.language) as Locale;
  const syncProfile = (patch: Record<string, unknown>) => { if (session) void api.updateMe(patch).catch(() => undefined); };

  const toggleInterest = (i: (typeof ONBOARDING_INTERESTS)[number]) => {
    const groups = interestToGroups(i);
    const has = groups.every((g) => s.interests.includes(g));
    const interests = has ? s.interests.filter((g) => !groups.includes(g)) : [...new Set([...s.interests, ...groups])];
    store.set({ interests });
    syncProfile({ interests });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, gap: 24, paddingBottom: 48 }}>
      <Txt v="display" accessibilityRole="header">{t('profile.title')}</Txt>

      <View style={{ padding: 16, borderRadius: th.radius.lg, backgroundColor: th.c.surface, gap: 10 }}>
        {session ? (
          <>
            <Txt v="bodyStrong">{session.user.email}</Txt>
            <Button title={t('profile.signOut')} kind="secondary" compact onPress={() => void signOut()} />
          </>
        ) : authAvailable ? (
          <>
            <Txt v="callout" tone="secondary">{t('profile.signInBody')}</Txt>
            <Button title={t('profile.signIn')} icon="email-outline" onPress={() => router.push('/signin')} />
          </>
        ) : (
          <Txt v="callout" tone="secondary">{t('profile.authUnavailable')}</Txt>
        )}
      </View>

      <Group title={t('profile.language')}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {LOCALES.map((l) => <Chip key={l} label={LANGUAGE_NAMES[l]} active={locale === l} onPress={() => { store.set({ locale: l }); syncProfile({ locale: l }); }} />)}
        </View>
      </Group>

      <Group title={t('profile.interests')}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {ONBOARDING_INTERESTS.map((i) => <Chip key={i} label={pickText(GROUP_LABELS[i], locale)} active={interestToGroups(i).every((g) => s.interests.includes(g))} onPress={() => toggleInterest(i)} />)}
        </View>
      </Group>

      <Group title={t('profile.budget')}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(['free', 'low', 'medium', 'high'] as const).map((b) => <Chip key={b} label={t(`profile.budget_${b}`)} active={s.budget === b} onPress={() => { const budget = s.budget === b ? null : b; store.set({ budget }); syncProfile({ budget }); }} />)}
        </View>
      </Group>

      <Group title={t('profile.age')}>
        <Txt v="caption" tone="secondary">{t('profile.age_hint')}</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(['under_18', '18_24', '25_34', '35_44', '45_54', '55_plus'] as const).map((a) => (
            <Chip key={a} label={a === 'under_18' ? '<18' : a === '55_plus' ? '55+' : a.replace('_', '–')} active={s.ageRange === a} onPress={() => { const ageRange = s.ageRange === a ? null : a; store.set({ ageRange }); syncProfile({ ageRange }); }} />
          ))}
        </View>
      </Group>

      <Group title={t('profile.appearance')}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['system', 'light', 'dark'] as const).map((m) => <Chip key={m} label={t(`profile.${m}`)} active={s.theme === m} onPress={() => store.set({ theme: m })} />)}
        </View>
      </Group>

      <View>
        <Row icon="bell-outline" title={t('profile.notifications')} onPress={() => router.push('/notifications')} />
        <Divider />
        <Row icon="shield-lock-outline" title={t('profile.privacy')} onPress={() => router.push('/privacy')} />
        <Divider />
        <Row icon="database-check-outline" title={t('profile.aboutData')} onPress={() => router.push('/about')} />
        <Divider />
        <Row icon="calendar-plus" title={t('profile.addEvent')} subtitle={t('profile.forOrganisers')} onPress={() => router.push('/submit')} />
      </View>
      <Txt v="caption" tone="tertiary" style={{ textAlign: 'center' }}>passtra · {t('profile.version', { v: Constants.expoConfig?.version ?? '1.0.0' })}</Txt>
    </ScrollView>
  );
}
