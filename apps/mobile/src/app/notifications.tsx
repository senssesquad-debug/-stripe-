import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Linking, Platform, ScrollView, Switch, View } from 'react-native';
import { Card } from '@/components/form';
import { Banner, Button, Chip, Divider, Icon, Row, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { requireAuth, useSession } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { showToast } from '@/lib/feedback';
import { canOpenSettings, disablePush, enablePush, getPushStatus, type PushStatus } from '@/lib/push';
import { useTheme } from '@/theme';

interface Prefs { enabled: boolean; maxPerDay: number; quietStart: string; quietEnd: string; newInCity: boolean; favoritesUpdates: boolean }
const DEFAULT_PREFS: Prefs = { enabled: false, maxPerDay: 1, quietStart: '22:00', quietEnd: '09:00', newInCity: true, favoritesUpdates: true };

/**
 * Notification settings: real device state (permission + subscription), the server's view of where it can deliver,
 * a test that goes through the actual delivery path, and suggestion preferences stored in the account.
 */
export default function NotificationSettings() {
  const th = useTheme();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const session = useSession();
  const [device, setDevice] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState<'on' | 'off' | 'test' | null>(null);
  const [testResult, setTestResult] = useState<{ text: string; tone: 'primary' | 'warning' } | null>(null);
  const server = useQuery({ queryKey: ['notif-status', session?.user.id], queryFn: api.notificationStatus, enabled: !!session });
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => { if (server.data?.prefs) setPrefs((p) => ({ ...p, ...(server.data!.prefs as Partial<Prefs>) })); }, [server.data]);

  const refreshDevice = useCallback(() => { void getPushStatus().then(setDevice).catch(() => setDevice({ permission: 'unsupported', subscribed: false })); }, []);
  useEffect(() => {
    refreshDevice();
    // The user may change the permission in system/browser settings and come back.
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshDevice(); });
    return () => sub.remove();
  }, [refreshDevice]);

  const turnOn = () => requireAuth('notifications', async () => {
    setBusy('on');
    try {
      const s = await enablePush();
      setDevice(s);
      if (s.subscribed) showToast(t('notif.state_granted')); // reminders only; suggestions stay opt-in below
      await qc.invalidateQueries({ queryKey: ['notif-status'] });
    } catch (e) {
      showToast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  });
  const turnOff = async () => {
    setBusy('off');
    try {
      await disablePush();
      refreshDevice();
      await qc.invalidateQueries({ queryKey: ['notif-status'] });
    } finally {
      setBusy(null);
    }
  };
  const test = async () => {
    setBusy('test');
    setTestResult(null);
    try {
      const { result } = await api.testNotification();
      const sent = result.webPush.sent + result.expo.sent;
      const failed = result.webPush.failed + result.expo.failed;
      setTestResult(sent > 0 ? { text: t('notif.testSent', { count: sent }), tone: 'primary' } : { text: failed > 0 ? t('notif.testFailed') : t('notif.testNone'), tone: 'warning' });
      await qc.invalidateQueries({ queryKey: ['notif-status'] });
    } catch (e) {
      setTestResult({ text: errorText(e), tone: 'warning' });
    } finally {
      setBusy(null);
    }
  };
  const savePrefs = async (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (!session) return;
    try {
      await api.updateMe({ notificationPrefs: next });
      showToast(t('notif.saved'));
    } catch (e) {
      showToast(errorText(e), 'error');
    }
  };

  const cityOn = prefs.enabled && prefs.newInCity;
  const favOn = prefs.enabled && prefs.favoritesUpdates;
  const p = device?.permission;
  const on = p === 'granted' && device?.subscribed;
  const stateKey = !device ? null : on ? 'state_granted' : p === 'denied' ? (Platform.OS === 'web' ? 'state_denied' : 'state_denied_native') : p === 'granted' || p === 'default' ? 'state_off' : `state_${p}`;
  const helpKey = p === 'denied' ? (Platform.OS === 'web' ? 'help_denied_web' : 'help_denied_native') : p && ['unsupported', 'ios_needs_install', 'insecure', 'not_configured'].includes(p) ? `help_${p}` : null;
  const canTurnOn = p === 'default' || (p === 'granted' && !device?.subscribed);
  const sw = (v: boolean, onChange: (v: boolean) => void, disabled = false) => <Switch value={v} disabled={disabled} onValueChange={onChange} trackColor={{ true: th.c.primary, false: th.c.border }} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
      <Txt v="title" accessibilityRole="header">{t('notif.title')}</Txt>
      <Txt v="callout" tone="secondary">{t('notif.explain')}</Txt>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name={on ? 'bell-ring-outline' : p === 'denied' ? 'bell-cancel-outline' : 'bell-off-outline'} size={26} color={on ? th.c.success : p === 'denied' ? th.c.danger : th.c.textSecondary} />
          <Txt v="headline" style={{ flex: 1 }} accessibilityLiveRegion="polite">{stateKey ? t(`notif.${stateKey}`) : t('common.loading')}</Txt>
        </View>
        {helpKey ? <Txt v="callout" tone="secondary">{t(`notif.${helpKey}`)}</Txt> : null}
        {p === 'denied' && canOpenSettings ? <Button title={t('notif.title')} kind="secondary" compact icon="cog-outline" onPress={() => void Linking.openSettings()} style={{ alignSelf: 'flex-start' }} /> : null}
        {canTurnOn ? <Button title={t('notif.turnOn')} icon="bell-plus-outline" loading={busy === 'on'} onPress={turnOn} /> : null}
        {on ? (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button title={t('notif.test')} icon="send-outline" compact loading={busy === 'test'} onPress={() => void test()} />
            <Button title={t('notif.turnOff')} kind="ghost" compact loading={busy === 'off'} onPress={() => void turnOff()} />
          </View>
        ) : null}
        {testResult ? <Banner icon={testResult.tone === 'primary' ? 'check-circle-outline' : 'alert-outline'} tone={testResult.tone} text={testResult.text} /> : null}
        {server.data ? <Txt v="caption" tone="tertiary">{t('notif.devices', { web: server.data.channels.webPush, native: server.data.channels.nativePush })}</Txt> : null}
        {Platform.OS === 'web' ? <Txt v="caption" tone="tertiary">{t('notif.webLimits')}</Txt> : null}
      </Card>

      {!session ? (
        <Banner icon="account-lock-outline" text={t('auth.reason_notifications')} action={{ label: t('profile.signIn'), onPress: () => router.push({ pathname: '/signin', params: { reason: 'notifications' } }) }} />
      ) : (
        <View style={{ gap: 4 }}>
          <Txt v="headline">{t('notif.types')}</Txt>
          <Row icon="calendar-clock" title={t('notif.reminders')} subtitle={t('notif.remindersHelp')} onPress={() => router.push('/my-events')} />
          <Divider />
          <Row title={t('notif.newInCity')} right={sw(cityOn, (v) => void savePrefs({ newInCity: v, favoritesUpdates: favOn, enabled: v || favOn }))} />
          <Divider />
          <Row title={t('notif.favorites')} right={sw(favOn, (v) => void savePrefs({ favoritesUpdates: v, newInCity: cityOn, enabled: v || cityOn }))} />
          <Txt v="caption" tone="secondary" style={{ marginTop: 12 }}>{t('notif.maxPerDay')}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>{[1, 2, 3].map((n) => <Chip key={n} label={String(n)} active={prefs.maxPerDay === n} onPress={() => void savePrefs({ maxPerDay: n })} />)}</View>
          <Txt v="caption" tone="secondary" style={{ marginTop: 12 }}>{t('notif.quiet')}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {[['21:00', '08:00'], ['22:00', '09:00'], ['23:00', '09:00']].map(([a, b]) => (
              <Chip key={a} label={`${a}–${b}`} active={prefs.quietStart === a && prefs.quietEnd === b} onPress={() => void savePrefs({ quietStart: a!, quietEnd: b! })} />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
