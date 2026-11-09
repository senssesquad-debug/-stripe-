import { validateDisplayName } from '@passtra/core';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { AvatarEditor } from '@/components/avatar-editor';
import { Card, Field } from '@/components/form';
import { Badge, Banner, Button, Txt } from '@/components/ui';
import { api, type Profile } from '@/lib/api';
import { devCodes, setProfile, signOut, useAuthReady, useSession } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { confirmAsync, showToast } from '@/lib/feedback';
import { useTheme } from '@/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const normalizePhone = (s: string) => s.replace(/[\s()-]/g, '');

/**
 * One contact (email or phone). It becomes "linked" only after the user enters the code the server sent —
 * until then it's shown as pending, and if the server has no email/SMS service the reason is shown instead.
 */
function Contact({ channel, user }: { channel: 'email' | 'phone'; user: Profile }) {
  const { t } = useTranslation();
  const value = channel === 'email' ? user.email : user.phone;
  const verified = channel === 'email' ? user.emailVerified : user.phoneVerified;
  const pending = channel === 'email' ? user.pendingEmail : user.pendingPhone;
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(pending ? devCodes.get(pending) ?? null : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const start = (target: string) => run(async () => {
    const r = await api.contactStart(channel === 'email' ? { channel, email: target } : { channel, phone: target });
    setDevCode(r.devCode ?? null);
    setEditing(false);
    setInput('');
    await setProfile(await api.me());
    showToast(t('account.codeSent', { target }));
  });
  const confirm = () => run(async () => {
    await setProfile(await api.contactConfirm(channel, code));
    setCode('');
    setDevCode(null);
    showToast(channel === 'email' ? t('account.emailConfirmed') : t('account.phoneConfirmed'));
  });

  const valid = channel === 'email' ? EMAIL.test(input.trim()) : /^\+[1-9]\d{6,14}$/.test(normalizePhone(input));
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Txt v="headline">{channel === 'email' ? t('account.email') : t('account.phone')}</Txt>
        {value ? <Badge label={verified ? t('account.confirmed') : t('account.notConfirmed')} tone={verified ? 'success' : 'warning'} icon={verified ? 'check-decagram' : 'alert-outline'} />
          : <Badge label={t('account.notLinked')} />}
      </View>
      {value ? <Txt v="bodyStrong" selectable>{value}</Txt> : null}

      {pending ? (
        <View style={{ gap: 10 }}>
          <Txt v="callout" tone="secondary">{channel === 'email' ? t('account.pendingEmail', { target: pending }) : t('account.pendingPhone', { target: pending })}</Txt>
          {devCode ? <Banner icon="flask-outline" tone="warning" text={t('auth.devCode', { code: devCode })} /> : null}
          <Field label={t('account.code')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button title={t('account.confirm')} compact loading={busy} disabled={code.length !== 6} onPress={() => void confirm()} />
            <Button title={t('account.resend')} compact kind="ghost" disabled={busy} onPress={() => void start(pending)} />
          </View>
        </View>
      ) : null}

      {!pending && value && !verified ? (
        <Button title={t('account.sendCode')} compact kind="secondary" loading={busy} onPress={() => void start(value)} />
      ) : null}

      {editing ? (
        <View style={{ gap: 10 }}>
          <Field label={channel === 'email' ? t('account.newEmail') : t('account.phone')} value={input} onChangeText={setInput}
            keyboardType={channel === 'email' ? 'email-address' : 'phone-pad'} autoCapitalize="none" autoCorrect={false}
            autoComplete={channel === 'email' ? 'email' : 'tel'} placeholder={channel === 'phone' ? t('account.phonePlaceholder') : undefined}
            hint={channel === 'phone' ? t('account.phoneHint') : null} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button title={t('account.sendCode')} compact loading={busy} disabled={!valid} onPress={() => void start(channel === 'email' ? input.trim().toLowerCase() : normalizePhone(input))} />
            <Button title={t('account.cancel')} compact kind="ghost" onPress={() => { setEditing(false); setError(null); }} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button compact kind="ghost" icon={channel === 'email' ? 'email-edit-outline' : 'phone-plus-outline'}
            title={channel === 'email' ? t('account.changeEmail') : value ? t('account.changePhone') : t('account.addPhone')} onPress={() => setEditing(true)} />
          {channel === 'phone' && value ? (
            <Button compact kind="ghost" icon="phone-remove-outline" title={t('account.removePhone')}
              onPress={() => void run(async () => { await setProfile(await api.removePhone()); showToast(t('account.phoneRemoved')); })} />
          ) : null}
        </View>
      )}
      {error ? <Banner icon="alert-circle-outline" tone="warning" text={error} /> : null}
    </Card>
  );
}

function NameCard({ user }: { user: Profile }) {
  const { t } = useTranslation();
  const [name, setName] = useState(user.name ?? '');
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== (user.name ?? '');
  const check = name.trim() ? validateDisplayName(name) : null;
  const nameError = dirty && check && !check.ok ? t(`auth.name_${check.error}`) : null;
  return (
    <Card>
      <Field label={t('account.name')} value={name} onChangeText={setName} placeholder={t('account.namePlaceholder')} autoComplete="name" maxLength={40} error={nameError} hint={t('auth.nameRules')} />
      <Button title={t('account.saveName')} compact disabled={!dirty || !!nameError} loading={busy} style={{ alignSelf: 'flex-start' }} onPress={async () => {
        setBusy(true);
        try {
          await setProfile(await api.updateMe({ name: name.trim() || null }));
          showToast(t('account.nameSaved'));
        } catch (e) {
          showToast(errorText(e), 'error');
        } finally {
          setBusy(false);
        }
      }} />
    </Card>
  );
}

function PasswordCard({ user }: { user: Profile }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return <Button title={t('account.changePassword')} kind="secondary" icon="lock-reset" onPress={() => setOpen(true)} />;
  return (
    <Card>
      <Txt v="headline">{t('account.password')}</Txt>
      {user.hasPassword ? <Field label={t('account.currentPassword')} value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" /> : null}
      <Field label={t('account.newPassword')} value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" hint={t('auth.passwordHint')} />
      {error ? <Banner icon="alert-circle-outline" tone="warning" text={error} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title={t('account.changePassword')} compact loading={busy} disabled={next.length < 8 || (user.hasPassword && !current)} onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await api.changePassword({ current: user.hasPassword ? current : '', password: next });
            showToast(t('account.passwordChanged'));
            setOpen(false);
            setCurrent('');
            setNext('');
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }} />
        <Button title={t('account.cancel')} compact kind="ghost" onPress={() => setOpen(false)} />
      </View>
    </Card>
  );
}

export default function Account() {
  const th = useTheme();
  const { t } = useTranslation();
  const session = useSession();
  const ready = useAuthReady();
  if (ready && !session) return <Redirect href={{ pathname: '/signin', params: { reason: 'account' } }} />;
  if (!session) return null;
  const user = session.user;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <Txt v="title" accessibilityRole="header">{t('account.title')}</Txt>
      <AvatarEditor />
      <NameCard key={user.id} user={user} />
      <Contact channel="email" user={user} />
      <Contact channel="phone" user={user} />
      <PasswordCard user={user} />
      <Button title={t('account.signOut')} kind="ghost" icon="logout" onPress={async () => {
        if (!(await confirmAsync(t('account.signOut'), t('account.signOutConfirm'), t('account.signOut'), t('common.cancel')))) return;
        await signOut();
        showToast(t('account.signedOut'));
        router.replace('/profile');
      }} />
      <Button title={t('account.deleteAccount')} kind="ghost" compact onPress={() => router.push('/privacy')} />
    </ScrollView>
  );
}
