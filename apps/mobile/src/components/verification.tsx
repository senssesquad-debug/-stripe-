import type { EntityDTO, VerificationDTO } from '@passtra/core';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { timeAgo } from '@/lib/format';
import { useTheme } from '@/theme';
import { EntityCard } from './cards';
import { Badge, Icon, Tap, Txt } from './ui';

const STATUS_TONE = { confirmed: 'success', likely: 'primary', unverified: 'neutral', conflicting: 'warning' } as const;
const STATUS_ICON = { confirmed: 'check-decagram', likely: 'check-circle-outline', unverified: 'help-circle-outline', conflicting: 'alert-outline' } as const;

export function VerificationBadge({ v }: { v: VerificationDTO }) {
  const { t } = useTranslation();
  return <Badge label={t(`verification.${v.status}`)} tone={STATUS_TONE[v.status]} icon={STATUS_ICON[v.status]} />;
}

/** "Where this comes from": status, sources with links, last check time and any disagreement between sources. */
export function VerificationBlock({ entity }: { entity: EntityDTO }) {
  const th = useTheme();
  const { t } = useTranslation();
  const v = entity.verification;
  return (
    <View style={{ gap: 12, padding: 16, borderRadius: th.radius.lg, backgroundColor: th.c.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="headline">{t('verification.sourcesTitle')}</Txt>
        <VerificationBadge v={v} />
      </View>
      {v.lastVerifiedAt ? <Txt v="caption" tone="secondary">{t('verification.checked', { ago: timeAgo(v.lastVerifiedAt) })}</Txt> : null}
      {v.conflicts.map((c) => (
        <View key={c.field} style={{ gap: 6, padding: 12, borderRadius: th.radius.md, backgroundColor: th.dark ? '#3A2E10' : '#FFF4DB' }}>
          <Txt v="bodyStrong">{t('verification.conflictTitle', { field: t(`verification.field_${c.field}`, { defaultValue: c.field }) })}</Txt>
          {c.candidates.map((cand, i) => (
            <Txt key={i} v="callout">• {formatCandidate(cand.display, c.field, entity)} — {cand.sources.join(', ')}</Txt>
          ))}
          <Txt v="caption" tone="secondary">{t('verification.conflictHelp')}</Txt>
        </View>
      ))}
      {v.sources.map((s) => (
        <Tap key={s.key} disabled={!s.url} onPress={() => s.url && WebBrowser.openBrowserAsync(s.url)} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name={s.isOfficial ? 'shield-check-outline' : 'link-variant'} size={18} color={th.c.textSecondary} />
          <View style={{ flex: 1 }}>
            <Txt v="callout">{s.name}{s.isOfficial ? ` · ${t('verification.official')}` : ''}</Txt>
            <Txt v="caption" tone="tertiary">{[s.attribution, timeAgo(s.lastSeenAt)].filter(Boolean).join(' · ')}</Txt>
          </View>
          {s.url ? <Icon name="open-in-new" size={16} color={th.c.textTertiary} /> : null}
        </Tap>
      ))}
      <Tap onPress={() => router.push({ pathname: '/report', params: { type: entity.type, id: entity.id } })} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 }}>
        <Icon name="flag-outline" size={16} color={th.c.primaryText} />
        <Txt v="callout" tone="primary">{t('verification.report')}</Txt>
      </Tap>
    </View>
  );
}

/** ISO instants in conflicts are shown as local wall time in the entity's zone. */
function formatCandidate(display: string, field: string, entity: EntityDTO): string {
  if ((field === 'starts_at' || field === 'ends_at') && /^\d{4}-\d{2}-\d{2}T/.test(display) && entity.type === 'event') {
    try {
      return new Intl.DateTimeFormat(undefined, { timeZone: entity.time.timezone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(display));
    } catch {
      return display;
    }
  }
  return display;
}

export function Section({ title, subtitle, items, reasons }: { title: string; subtitle?: string | null; items: EntityDTO[]; reasons?: Record<string, string> }) {
  const th = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <Txt v="title" accessibilityRole="header">{title}</Txt>
        {subtitle ? <Txt v="callout" tone="secondary">{subtitle}</Txt> : null}
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(e) => `${e.type}:${e.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: th.space.lg }}
        renderItem={({ item }) => <EntityCard entity={item} reason={reasons?.[item.id]} />}
      />
    </View>
  );
}
