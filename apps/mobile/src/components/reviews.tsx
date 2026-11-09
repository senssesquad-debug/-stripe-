import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { api, ApiError, type ReviewItem } from '@/lib/api';
import { requireAuth, useSession } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { confirmAsync, showToast } from '@/lib/feedback';
import { useTheme } from '@/theme';
import { Avatar } from './avatar';
import { Badge, Banner, Button, Chip, Icon, Tap, Txt } from './ui';

export function Stars({ value, size = 16, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', gap: onChange ? 6 : 1 }} accessibilityRole={onChange ? 'adjustable' : 'image'} accessibilityLabel={t('reviews.starsA11y', { n: value })}>
      {[1, 2, 3, 4, 5].map((s) => {
        const icon = value >= s ? 'star' : value >= s - 0.5 ? 'star-half-full' : 'star-outline';
        return onChange
          ? <Tap key={s} onPress={() => onChange(s)} accessibilityRole="button" accessibilityLabel={t('reviews.starsA11y', { n: s })} hitSlop={6}><Icon name={icon} size={size} color="#F5A623" /></Tap>
          : <Icon key={s} name={icon} size={size} color={value ? '#F5A623' : th.c.border} />;
      })}
    </View>
  );
}

function ReviewRow({ r, onChanged }: { r: ReviewItem; onChanged: () => void }) {
  const th = useTheme();
  const { t, i18n } = useTranslation();
  const session = useSession();
  const date = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(r.createdAt));
  return (
    <View style={{ gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderColor: th.c.border }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Avatar name={r.author.name} url={r.author.avatarUrl} preset={r.author.avatarPreset} size={36} />
        <View style={{ flex: 1 }}>
          <Txt v="bodyStrong">{r.author.name}{r.mine ? ` · ${t('reviews.you')}` : ''}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Stars value={r.rating} size={14} />
            <Txt v="caption" tone="tertiary">{date}{r.editedAt ? ` · ${t('reviews.edited')}` : ''}</Txt>
          </View>
        </View>
        {r.status && r.status !== 'published' ? <Badge label={t(`reviews.status_${r.status}`)} tone="warning" /> : null}
      </View>
      {r.body ? <Txt v="body" tone="secondary">{r.body}</Txt> : null}
      <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        {!r.mine ? (
          <Button compact kind="ghost" icon={r.votedHelpful ? 'thumb-up' : 'thumb-up-outline'} title={t('reviews.helpful', { count: r.helpfulCount })}
            onPress={() => requireAuth('sync', async () => { try { await api.helpful(r.id, !r.votedHelpful); onChanged(); } catch (e) { showToast(errorText(e), 'error'); } })} />
        ) : <Txt v="caption" tone="tertiary" style={{ paddingVertical: 10 }}>{t('reviews.helpful', { count: r.helpfulCount })}</Txt>}
        {!r.mine ? (
          <Button compact kind="ghost" icon="flag-outline" title={t('reviews.report')} onPress={async () => {
            if (!(await confirmAsync(t('reviews.reportTitle'), t('reviews.reportBody'), t('reviews.report'), t('common.cancel')))) return;
            try { await api.reportReview(r.id, 'offensive'); showToast(t('reviews.reported')); } catch (e) { showToast(errorText(e), 'error'); }
          }} />
        ) : session ? (
          <Button compact kind="ghost" icon="delete-outline" title={t('reviews.delete')} onPress={async () => {
            if (!(await confirmAsync(t('reviews.delete'), t('reviews.deleteBody'), t('reviews.delete'), t('common.cancel'), true))) return;
            try { await api.deleteReview(r.id); showToast(t('reviews.deleted')); onChanged(); } catch (e) { showToast(errorText(e), 'error'); }
          }} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * passtra ratings and reviews for an event or place (never mixed with Google's rating). Anyone can read;
 * posting needs an account with a confirmed email or phone; events can be rated once they've started.
 */
export function Reviews({ type, id, canRate = true }: { type: 'events' | 'places'; id: string; canRate?: boolean }) {
  const th = useTheme();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const session = useSession();
  const [sort, setSort] = useState<'recent' | 'helpful'>('recent');
  const q = useQuery({ queryKey: ['reviews', type, id, sort, session?.user.id], queryFn: () => api.reviews(type, id, sort) });
  const mine = q.data?.items.find((r) => r.mine) ?? null;
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const verified = !!session && (session.user.emailVerified || session.user.phoneVerified);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['reviews', type, id] }); void qc.invalidateQueries({ queryKey: [type === 'events' ? 'event' : 'place', id] }); };
  const startEdit = () => requireAuth('sync', () => { setRating(mine?.rating ?? 0); setBody(mine?.body ?? ''); setEditing(true); setNotice(null); });
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.postReview(type, id, { rating, body: body.trim() || undefined });
      setEditing(false);
      setNotice(r.status === 'published' ? (r.edited ? t('reviews.publishedMasked') : t('reviews.published')) : r.status === 'pending' ? t('reviews.pending') : t('reviews.rejected'));
      refresh();
    } catch (e) {
      setNotice(e instanceof ApiError && e.code === 'verification_required' ? t('reviews.needVerified') : errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const s = q.data?.summary;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="headline">{t('reviews.title')}</Txt>
        {s && s.count > 1 ? <View style={{ flexDirection: 'row', gap: 6 }}>
          <Chip label={t('reviews.recent')} active={sort === 'recent'} onPress={() => setSort('recent')} />
          <Chip label={t('reviews.mostHelpful')} active={sort === 'helpful'} onPress={() => setSort('helpful')} />
        </View> : null}
      </View>
      {s && s.count > 0 ? (
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <View style={{ alignItems: 'center' }}>
            <Txt v="display">{s.average?.toFixed(1)}</Txt>
            <Stars value={s.average ?? 0} />
            <Txt v="caption" tone="tertiary">{t('reviews.count', { count: s.count })}</Txt>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            {[5, 4, 3, 2, 1].map((n) => (
              <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Txt v="caption" tone="secondary" style={{ width: 10 }}>{n}</Txt>
                <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: th.c.surfaceAlt }}>
                  <View style={{ width: `${(100 * (s.distribution[String(n)] ?? 0)) / s.count}%`, height: 6, borderRadius: 3, backgroundColor: '#F5A623' }} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : <Txt v="callout" tone="secondary">{t('reviews.none')}</Txt>}

      {notice ? <Banner icon="information-outline" text={notice} /> : null}
      {!canRate ? <Txt v="caption" tone="tertiary">{t('reviews.afterStart')}</Txt>
        : editing ? (
          session && !verified ? (
            <Banner icon="shield-alert-outline" tone="warning" text={t('reviews.needVerified')} action={{ label: t('reviews.verifyNow'), onPress: () => router.push('/account') }} />
          ) : (
            <View style={{ gap: 10, padding: 14, borderRadius: th.radius.lg, backgroundColor: th.c.surface }}>
              <Stars value={rating} size={30} onChange={setRating} />
              <TextInput value={body} onChangeText={setBody} multiline maxLength={2000} placeholder={t('reviews.placeholder')} placeholderTextColor={th.c.textTertiary} accessibilityLabel={t('reviews.placeholder')}
                style={{ minHeight: 90, padding: 12, borderRadius: th.radius.md, backgroundColor: th.c.background, color: th.c.text, fontFamily: th.font.medium, fontSize: 15, textAlignVertical: 'top' }} />
              <Txt v="caption" tone="tertiary">{t('reviews.rules')}</Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title={mine ? t('reviews.update') : t('reviews.post')} compact disabled={!rating} loading={busy} onPress={() => void submit()} />
                <Button title={t('common.cancel')} compact kind="ghost" onPress={() => setEditing(false)} />
              </View>
            </View>
          )
        ) : <Button title={mine ? t('reviews.editMine') : t('reviews.write')} icon={mine ? 'pencil-outline' : 'star-outline'} kind="secondary" compact onPress={startEdit} style={{ alignSelf: 'flex-start' }} />}

      {(q.data?.items ?? []).map((r) => <ReviewRow key={r.id} r={r} onChanged={refresh} />)}
    </View>
  );
}
