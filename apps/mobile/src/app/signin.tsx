import { validateDisplayName } from '@passtra/core';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Field } from '@/components/form';
import { Banner, Button, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { applyAuth, cancelSignIn, finishSignIn, type AuthReason } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { showToast } from '@/lib/feedback';
import { useTheme } from '@/theme';

type Mode = 'signin' | 'register' | 'reset';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Sign in / create account / reset password (email + password).
 * Opened with ?reason=… when an action needs an account; after success the user returns to where they were
 * and the interrupted action continues (see requireAuth).
 */
export default function SignIn() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const { reason, mode: initialMode } = useLocalSearchParams<{ reason?: AuthReason; mode?: Mode }>();
  const [mode, setMode] = useState<Mode>(initialMode === 'register' ? 'register' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [resetSent, setResetSent] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => { cancelSignIn(); if (router.canGoBack()) router.back(); else router.replace('/'); };

  const emailOk = EMAIL.test(email.trim());
  const nameCheck = mode === 'register' && name.trim() ? validateDisplayName(name) : null;
  const nameError = nameCheck && !nameCheck.ok ? t(`auth.name_${nameCheck.error}`) : null;
  const pwOk = password.length >= 8;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  const submit = () => run(async () => {
    if (mode === 'signin') {
      await applyAuth(await api.login({ email: email.trim(), password }));
      finishSignIn();
    } else if (mode === 'register') {
      const r = await api.register({ email: email.trim(), password, name: name.trim() || undefined, locale: i18n.language });
      await applyAuth(r);
      showToast(t('auth.created'));
      finishSignIn();
    } else if (!resetSent) {
      const r = await api.resetStart(email.trim());
      setResetSent(email.trim());
      setDevCode(r.devCode ?? null);
    } else {
      await applyAuth(await api.resetConfirm({ email: resetSent, code, password }));
      showToast(t('account.passwordChanged'));
      finishSignIn();
    }
  });

  const title = mode === 'signin' ? t('auth.signInTitle') : mode === 'register' ? t('auth.registerTitle') : t('auth.resetTitle');
  const action = mode === 'signin' ? t('auth.signIn') : mode === 'register' ? t('auth.register') : resetSent ? t('auth.setPassword') : t('auth.sendResetCode');
  const disabled = !!nameError || !emailOk || (mode !== 'reset' && !pwOk) || (mode === 'reset' && !!resetSent && (!/^\d{6}$/.test(code) || !pwOk));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerLeft: () => <Button title={t('common.close')} kind="ghost" compact onPress={close} /> }} />
      <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 14, maxWidth: 520, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Txt v="title" accessibilityRole="header">{title}</Txt>
        {reason ? <Banner icon="account-lock-outline" text={t(`auth.reason_${reason}`)} /> : <Txt v="callout" tone="secondary">{t('auth.browseFree')}</Txt>}

        {mode === 'register' ? <Field label={t('auth.name')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" maxLength={40}
          error={nameError} hint={t('auth.nameRules')} /> : null}
        <Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          autoComplete="email" textContentType="username" editable={!(mode === 'reset' && resetSent)} />
        {mode === 'reset' && resetSent ? (
          <>
            <Txt v="callout" tone="secondary">{t('auth.resetCodeSent', { email: resetSent })}</Txt>
            {devCode ? <Banner icon="flask-outline" tone="warning" text={t('auth.devCode', { code: devCode })} /> : null}
            <Field label={t('auth.code')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} />
          </>
        ) : null}
        {mode !== 'reset' || resetSent ? (
          <Field label={mode === 'reset' ? t('auth.newPassword') : t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} textContentType={mode === 'signin' ? 'password' : 'newPassword'}
            hint={mode === 'signin' ? null : t('auth.passwordHint')} onSubmitEditing={() => { if (!disabled) void submit(); }} />
        ) : null}

        {error ? <Banner icon="alert-circle-outline" tone="warning" text={error} /> : null}
        <Button title={action} loading={busy} disabled={disabled} onPress={() => void submit()} />

        <View style={{ gap: 4, alignItems: 'center' }}>
          {mode === 'signin' ? (
            <>
              <Button title={t('auth.noAccount')} kind="ghost" compact onPress={() => { setMode('register'); setError(null); }} />
              <Button title={t('auth.forgot')} kind="ghost" compact onPress={() => { setMode('reset'); setError(null); setResetSent(null); }} />
            </>
          ) : (
            <Button title={t('auth.haveAccount')} kind="ghost" compact onPress={() => { setMode('signin'); setError(null); }} />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
