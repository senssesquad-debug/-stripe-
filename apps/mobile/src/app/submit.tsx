import { confirmAsync, showToast } from '@/lib/feedback';
import { errorText } from '@/lib/errors';
import { CATEGORIES, CITIES, pickText, type Locale } from '@passtra/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Switch, TextInput, View } from 'react-native';
import { Button, Chip, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useTheme } from '@/theme';

export default function SubmitEvent() {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const session = useSession();
  const [f, setF] = useState({ title: '', category: 'concert', venueName: '', city: 'limassol', startDate: '', startTime: '', endTime: '', isFree: false, priceMin: '', ticketUrl: '', organizer: '', contact: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const input = { padding: 14, borderRadius: th.radius.md, backgroundColor: th.c.surface, color: th.c.text, fontFamily: th.font.medium, fontSize: 15 } as const;
  const field = (k: keyof typeof f, label: string, extra: object = {}) => (
    <View style={{ gap: 6 }}>
      <Txt v="caption" tone="secondary">{label}</Txt>
      <TextInput value={String(f[k])} onChangeText={set(k)} style={input} placeholderTextColor={th.c.textTertiary} {...extra} />
    </View>
  );

  if (!session) {
    return (
      <View style={{ flex: 1, padding: 20, gap: 14, backgroundColor: th.c.background }}>
        <Txt v="title">{t('submit.title')}</Txt>
        <Txt v="callout" tone="secondary">{t('submit.signInFirst')}</Txt>
        <Button title={t('profile.signIn')} onPress={() => router.push({ pathname: '/signin', params: { reason: 'submit' } })} />
      </View>
    );
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 48 }}>
      <Txt v="title">{t('submit.title')}</Txt>
      <Txt v="callout" tone="secondary">{t('submit.body')}</Txt>
      {field('title', t('submit.name'))}
      <Txt v="caption" tone="secondary">{t('submit.category')}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {CATEGORIES.filter((c) => c.kind !== 'place').map((c) => <Chip key={c.slug} label={pickText(c.label, locale)} active={f.category === c.slug} onPress={() => set('category')(c.slug)} />)}
      </ScrollView>
      {field('venueName', t('submit.venue'))}
      <Txt v="caption" tone="secondary">{t('submit.city')}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {CITIES.map((c) => <Chip key={c.slug} label={pickText(c.name, locale)} active={f.city === c.slug} onPress={() => set('city')(c.slug)} />)}
      </ScrollView>
      {field('startDate', t('submit.date'), { placeholder: '2026-12-31' })}
      {field('startTime', t('submit.start'), { placeholder: '20:30' })}
      {field('endTime', t('submit.end'), { placeholder: '23:00' })}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="body">{t('submit.free')}</Txt>
        <Switch value={f.isFree} onValueChange={set('isFree')} trackColor={{ true: th.c.primary, false: th.c.border }} />
      </View>
      {!f.isFree ? field('priceMin', t('submit.priceFrom'), { keyboardType: 'decimal-pad' }) : null}
      {field('ticketUrl', t('submit.ticketUrl'), { autoCapitalize: 'none', keyboardType: 'url' })}
      {field('organizer', t('submit.organizer'))}
      {field('contact', t('submit.contact'), { autoCapitalize: 'none', keyboardType: 'email-address' })}
      <Button title={t('submit.send')} loading={busy} disabled={!f.title || !f.venueName || !/^\d{4}-\d{2}-\d{2}$/.test(f.startDate) || !f.organizer || !f.contact}
        onPress={async () => {
          setBusy(true);
          try {
            await api.submitEvent({
              title: f.title, category: f.category, venueName: f.venueName, city: f.city, startDate: f.startDate,
              startTime: f.startTime || undefined, endTime: f.endTime || undefined, isFree: f.isFree, priceMin: f.priceMin ? Number(f.priceMin) : undefined,
              ticketUrl: f.ticketUrl || undefined, organizer: f.organizer, contact: f.contact,
            });
            showToast(t('submit.sent'));
            router.back();
          } catch (e) {
            showToast(errorText(e), 'error');
          } finally {
            setBusy(false);
          }
        }} />
    </ScrollView>
  );
}
