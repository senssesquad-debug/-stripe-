import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { DateTimeField } from '@/components/datetime-input';
import { Card, Field } from '@/components/form';
import { headerLeftForDirectOpen } from '@/components/home-button';
import { Banner, Button, Chip, ErrorState, Skeleton, Txt } from '@/components/ui';
import { api, ApiError, type MyEvent, type MyEventInput } from '@/lib/api';
import { useAuthReady, useSession } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { confirmAsync, showToast } from '@/lib/feedback';
import { CYPRUS_TZ, REMINDERS, deviceTz, inDeviceTime, reminderLabel, reminderStatusText, todayIn } from '@/lib/my-events';
import { useTheme } from '@/theme';

type Params = { id: string; title?: string; date?: string; startTime?: string; endTime?: string; endDate?: string; tz?: string;
  locName?: string; address?: string; lat?: string; lng?: string; entityType?: 'event' | 'place'; entityId?: string };

interface Form {
  title: string; description: string; date: string; startTime: string; endTime: string; endDate: string; multiDay: boolean; timezone: string;
  locName: string; address: string; lat: number | null; lng: number | null; entityType: 'event' | 'place' | null; entityId: string | null; reminder: number | null;
}

const fromEvent = (e: MyEvent): Form => ({
  title: e.title, description: e.description ?? '', date: e.date, startTime: e.startTime, endTime: e.endTime, endDate: e.endDate, multiDay: e.endDate !== e.date && !(e.endTime <= e.startTime && daysBetween(e.date, e.endDate) === 1),
  timezone: e.timezone, locName: e.location?.name ?? '', address: e.location?.address ?? '', lat: e.location?.lat ?? null, lng: e.location?.lng ?? null,
  entityType: e.entity?.type ?? null, entityId: e.entity?.id ?? null, reminder: e.reminder?.minutes ?? null,
});
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function fromParams(p: Params): Form {
  const tz = p.tz || CYPRUS_TZ;
  return {
    title: p.title ?? '', description: '', date: p.date || todayIn(tz), startTime: p.startTime ?? '', endTime: p.endTime ?? '', endDate: p.endDate ?? '', multiDay: !!p.endDate,
    timezone: tz, locName: p.locName ?? '', address: p.address ?? '', lat: p.lat ? Number(p.lat) : null, lng: p.lng ? Number(p.lng) : null,
    entityType: p.entityType ?? null, entityId: p.entityId ?? null, reminder: p.entityType === 'event' ? 60 : 30,
  };
}

/** Create or edit a personal event. Times are wall-clock times in the chosen zone (Cyprus by default); the server converts them. */
export default function MyEventEditor() {
  const th = useTheme();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const params = useLocalSearchParams<Params>();
  const isNew = params.id === 'new';
  const session = useSession();
  const ready = useAuthReady();
  const existing = useQuery({ queryKey: ['my-event', params.id], queryFn: () => api.myEvent(params.id), enabled: !!session && !isNew });
  const [form, setForm] = useState<Form | null>(isNew ? fromParams(params) : null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  useEffect(() => { if (existing.data && !form) setForm(fromEvent(existing.data.event)); }, [existing.data, form]);

  if (ready && !session) return <Redirect href={{ pathname: '/signin', params: { reason: 'myEvents' } }} />;
  const header = <Stack.Screen options={{ title: isNew ? t('myEvents.create') : t('myEvents.edit'), headerLeft: headerLeftForDirectOpen() }} />;
  if (!isNew && existing.isError) return <>{header}<ErrorState error={existing.error} onRetry={() => void existing.refetch()} /></>;
  if (!form) return <>{header}<View style={{ padding: 20, gap: 12, flex: 1, backgroundColor: th.c.background }}><Skeleton width="100%" height={48} /><Skeleton width="100%" height={48} /></View></>;

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const dev = deviceTz();
  const overnight = !form.multiDay && /^\d\d:\d\d$/.test(form.startTime) && /^\d\d:\d\d$/.test(form.endTime) && form.endTime <= form.startTime;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = t('myEvents.err_title');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) e.date = t('myEvents.err_date');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.startTime)) e.startTime = t('myEvents.err_time');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.endTime)) e.endTime = t('myEvents.err_time');
    if (form.multiDay && !/^\d{4}-\d{2}-\d{2}$/.test(form.endDate)) e.endDate = t('myEvents.err_date');
    if (form.multiDay && !e.endDate && !e.date && (form.endDate < form.date || (form.endDate === form.date && form.endTime <= form.startTime))) e.endTime = t('myEvents.err_end_before_start');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setBusy(true);
    setServerError(null);
    const body: MyEventInput = {
      title: form.title.trim(), description: form.description.trim() || null, date: form.date, startTime: form.startTime, endTime: form.endTime,
      endDate: form.multiDay ? form.endDate : null, timezone: form.timezone,
      location: form.locName.trim() || form.address.trim() || form.lat !== null ? { name: form.locName.trim() || null, address: form.address.trim() || null, lat: form.lat, lng: form.lng } : null,
      entityType: form.entityType, entityId: form.entityId, reminderMinutes: form.reminder,
    };
    try {
      const r = isNew ? await api.createMyEvent(body) : await api.updateMyEvent(params.id, body);
      await qc.invalidateQueries({ queryKey: ['my-events'] });
      qc.setQueryData(['my-event', r.event.id], { event: r.event });
      showToast(t(isNew ? 'myEvents.added' : 'myEvents.savedOk'));
      if (r.timeAdjusted) showToast(t('myEvents.timeAdjusted'));
      if (r.event.reminder?.at && Date.parse(r.event.reminder.at) < Date.now() && !r.event.past) showToast(t('myEvents.reminderInPast'));
      if (isNew) router.replace({ pathname: '/my-events/[id]', params: { id: r.event.id } });
      else setForm(fromEvent(r.event));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'end_before_start') setErrors({ endTime: t('myEvents.err_end_before_start') });
      else setServerError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const ev = existing.data?.event;
  const status = ev ? reminderStatusText(ev) : null;
  const local = ev ? inDeviceTime(ev.startsAt, ev.timezone) : null;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Field label={t('myEvents.titleLabel')} value={form.title} onChangeText={(v) => set({ title: v })} placeholder={t('myEvents.titlePlaceholder')} maxLength={160} error={errors.title} />

        {form.entityType && form.entityId ? (
          <Banner icon="link-variant" text={t('myEvents.linked', { name: form.locName || form.title })}
            action={{ label: t('myEvents.openLinked'), onPress: () => router.push(form.entityType === 'event' ? { pathname: '/event/[id]', params: { id: form.entityId! } } : { pathname: '/place/[id]', params: { id: form.entityId! } }) }} />
        ) : null}

        <Card>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip label={t('myEvents.today')} active={form.date === todayIn(form.timezone)} onPress={() => set({ date: todayIn(form.timezone) })} />
            <Chip label={t('myEvents.tomorrow')} active={form.date === todayIn(form.timezone, 1)} onPress={() => set({ date: todayIn(form.timezone, 1) })} />
          </View>
          <DateTimeField kind="date" label={t('myEvents.date')} value={form.date} onChange={(v) => set({ date: v })} error={errors.date} />
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <DateTimeField kind="time" label={t('myEvents.start')} value={form.startTime} onChange={(v) => set({ startTime: v })} error={errors.startTime} />
            <DateTimeField kind="time" label={t('myEvents.end')} value={form.endTime} onChange={(v) => set({ endTime: v })} error={errors.endTime} />
          </View>
          {overnight ? <Txt v="caption" tone="secondary">{t('myEvents.endsNextDay', { time: form.endTime })}</Txt> : null}
          <Chip icon="calendar-range" label={t('myEvents.endDate')} active={form.multiDay} onPress={() => set({ multiDay: !form.multiDay, endDate: form.endDate || form.date })} />
          {form.multiDay ? <DateTimeField kind="date" label={t('myEvents.endDate')} value={form.endDate} onChange={(v) => set({ endDate: v })} error={errors.endDate} /> : null}

          <Txt v="caption" tone="secondary">{t('myEvents.timezone')}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip label={t('myEvents.cyprusTime')} active={form.timezone === CYPRUS_TZ} onPress={() => set({ timezone: CYPRUS_TZ })} />
            {dev !== CYPRUS_TZ ? <Chip label={t('myEvents.deviceTime', { tz: dev })} active={form.timezone === dev} onPress={() => set({ timezone: dev })} /> : null}
            {form.timezone !== CYPRUS_TZ && form.timezone !== dev ? <Chip label={form.timezone} active /> : null}
          </View>
          <Txt v="caption" tone="tertiary">{t('myEvents.tzNote', { tz: form.timezone === CYPRUS_TZ ? t('myEvents.cyprusTime') : form.timezone })}</Txt>
          {local ? <Txt v="caption" tone="secondary">{t('myEvents.inYourTime', { time: local })}</Txt> : null}
        </Card>

        <Card>
          <Txt v="headline">{t('myEvents.reminder')}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {REMINDERS.map((m) => <Chip key={String(m)} label={reminderLabel(m)} active={form.reminder === m} onPress={() => set({ reminder: m })} />)}
          </View>
          {status ? <Txt v="caption" tone="secondary">{status}</Txt> : null}
        </Card>

        <Card>
          <Txt v="headline">{t('myEvents.location')}</Txt>
          <Field label={t('myEvents.locationName')} value={form.locName} onChangeText={(v) => set({ locName: v })} maxLength={200} />
          <Field label={t('myEvents.address')} value={form.address} onChangeText={(v) => set({ address: v, ...(form.entityId ? {} : { lat: null, lng: null }) })} maxLength={300} />
        </Card>

        <Field label={t('myEvents.description')} value={form.description} onChangeText={(v) => set({ description: v })} multiline maxLength={2000} style={{ minHeight: 96, textAlignVertical: 'top' }} />

        {serverError ? <Banner icon="alert-circle-outline" tone="warning" text={serverError} /> : null}
        <Button title={t('myEvents.save')} icon="check" loading={busy} onPress={() => void save()} />
        {!isNew ? (
          <Button title={t('myEvents.delete')} kind="ghost" icon="delete-outline" onPress={async () => {
            if (!(await confirmAsync(t('myEvents.delete'), t('myEvents.deleteConfirm'), t('myEvents.delete'), t('common.cancel'), true))) return;
            try {
              await api.deleteMyEvent(params.id);
              await qc.invalidateQueries({ queryKey: ['my-events'] });
              showToast(t('myEvents.deleted'));
              if (router.canGoBack()) router.back(); else router.replace('/my-events');
            } catch (e) {
              showToast(errorText(e), 'error');
            }
          }} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
