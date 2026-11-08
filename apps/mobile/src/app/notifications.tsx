import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Banner, Button, Chip, Row, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { enablePush } from '@/lib/push';
import { useTheme } from '@/theme';

interface Prefs { enabled: boolean; maxPerDay: number; quietStart: string; quietEnd: string; newInCity: boolean; favoritesUpdates: boolean }

export default function NotificationSettings() {
  const th = useTheme();
  const { t } = useTranslation();
  const session = useSession();
  const [prefs, setPrefs] = useState<Prefs>({ enabled: false, maxPerDay: 1, quietStart: '22:00', quietEnd: '09:00', newInCity: true, favoritesUpdates: true });
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (session) void api.me().then((me) => setPrefs((p) => ({ ...p, ...(me.notificationPrefs as Partial<Prefs>) }))).catch(() => undefined);
  }, [session]);

  const update = async (patch: Partial<Prefs>) => {
    if (patch.enabled) {
      const r = await enablePush();
      if (r === 'denied') { setDenied(true); return; }
    }
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await api.updateMe({ notificationPrefs: next }).catch(() => undefined);
  };

  if (!session) {
    return (
      <View style={{ flex: 1, padding: 20, gap: 14, backgroundColor: th.c.background }}>
        <Txt v="title">{t('profile.notifications')}</Txt>
        <Txt v="callout" tone="secondary">{t('notifications.explain')}</Txt>
        <Button title={t('profile.signIn')} onPress={() => router.push('/signin')} />
      </View>
    );
  }
  const sw = (v: boolean, on: (v: boolean) => void) => <Switch value={v} onValueChange={on} trackColor={{ true: th.c.primary, false: th.c.border }} />;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Txt v="title">{t('profile.notifications')}</Txt>
      <Txt v="callout" tone="secondary">{t('notifications.explain')}</Txt>
      {denied ? <Banner icon="bell-off-outline" tone="warning" text={t('notifications.denied')} /> : null}
      <Row title={t('notifications.enabled')} right={sw(prefs.enabled, (v) => void update({ enabled: v }))} />
      <Row title={t('notifications.newInCity')} right={sw(prefs.newInCity, (v) => void update({ newInCity: v }))} />
      <Row title={t('notifications.favorites')} right={sw(prefs.favoritesUpdates, (v) => void update({ favoritesUpdates: v }))} />
      <Txt v="headline">{t('notifications.maxPerDay')}</Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>{[1, 2, 3].map((n) => <Chip key={n} label={String(n)} active={prefs.maxPerDay === n} onPress={() => void update({ maxPerDay: n })} />)}</View>
      <Txt v="headline">{t('notifications.quiet')}</Txt>
      <Txt v="callout" tone="secondary">{prefs.quietStart} – {prefs.quietEnd}</Txt>
    </ScrollView>
  );
}
