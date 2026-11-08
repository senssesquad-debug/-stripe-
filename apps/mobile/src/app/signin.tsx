import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, TextInput } from 'react-native';
import { Button, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { authAvailable, sendCode, verifyCode } from '@/lib/auth';
import { store } from '@/lib/store';
import { useTheme } from '@/theme';

/** Passwordless sign-in. After sign-in, device-local saves and preferences are uploaded. */
export default function SignIn() {
  const th = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = { padding: 14, borderRadius: th.radius.md, backgroundColor: th.c.surface, color: th.c.text, fontFamily: th.font.medium, fontSize: 16 } as const;

  const syncLocal = async () => {
    const s = store.get();
    await api.updateMe({ locale: s.locale ?? undefined, interests: s.interests, budget: s.budget, ageRange: s.ageRange }).catch(() => undefined);
    await Promise.all(Object.values(s.saved).map((x) => api.save(x.type, x.entity.id).catch(() => undefined)));
  };

  if (!authAvailable) return <Txt v="body" style={{ padding: 20 }}>{t('profile.authUnavailable')}</Txt>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Txt v="title">{t('profile.signIn')}</Txt>
      <Txt v="callout" tone="secondary">{t('profile.signInBody')}</Txt>
      <TextInput value={email} onChangeText={setEmail} placeholder={t('profile.email')} placeholderTextColor={th.c.textTertiary} keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={input} />
      {sent ? <TextInput value={code} onChangeText={setCode} placeholder={t('profile.code')} placeholderTextColor={th.c.textTertiary} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" style={input} /> : null}
      <Button
        title={sent ? t('profile.verify') : t('profile.sendCode')}
        loading={busy}
        disabled={!/.+@.+\..+/.test(email) || (sent && code.length !== 6)}
        onPress={async () => {
          setBusy(true);
          try {
            if (!sent) {
              await sendCode(email.trim());
              setSent(true);
            } else {
              await verifyCode(email.trim(), code);
              await syncLocal();
              router.back();
            }
          } catch (e) {
            Alert.alert((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </ScrollView>
  );
}
