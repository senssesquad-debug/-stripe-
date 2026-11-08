import { groupAccent } from '@passtra/brand';
import type { EntityDTO, EventDTO, PlaceDTO } from '@passtra/core';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { distanceLabel } from '@/lib/format';
import { iconFor } from '@/lib/icons';
import { toggleSaved, useAppState } from '@/lib/store';
import { useTheme } from '@/theme';
import { Badge, Icon, Tap, Txt } from './ui';

export function openEntity(e: EntityDTO) {
  if (e.type === 'event') router.push({ pathname: '/event/[id]', params: { id: e.id } });
  else router.push({ pathname: '/place/[id]', params: { id: e.id } });
}

export function SaveButton({ entity, size = 20, onDark }: { entity: EntityDTO; size?: number; onDark?: boolean }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const saved = useAppState((s) => !!s.saved[entity.id]);
  return (
    <Tap onPress={() => toggleSaved(entity)} accessibilityRole="button" accessibilityLabel={saved ? tr('common.saved') : tr('common.save')} hitSlop={10}
      style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: onDark ? 'rgba(255,255,255,0.92)' : t.c.surface }}>
      <Icon name={saved ? 'bookmark' : 'bookmark-outline'} size={size} color={saved ? t.c.primary : t.dark && !onDark ? t.c.text : '#0B1526'} />
    </Tap>
  );
}

/** Image if the source licence allows one; otherwise a calm branded tile with the category icon. */
export function Cover({ entity, height, radius }: { entity: EntityDTO; height: number; radius: number }) {
  const t = useTheme();
  const img = entity.images[0];
  const accent = groupAccent[entity.category.group] ?? t.c.primary;
  return (
    <View style={{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: t.dark ? t.c.surfaceAlt : `${accent}14` }}>
      {img ? (
        <Image source={{ uri: img.url }} style={{ flex: 1 }} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.c.background, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={iconFor(entity.category.icon)} size={28} color={accent} />
          </View>
        </View>
      )}
    </View>
  );
}

function eventBadges(e: EventDTO, tr: (k: string) => string) {
  const out: Array<{ label: string; tone: 'primary' | 'success' | 'warning' | 'danger' | 'dark' }> = [];
  if (e.status === 'cancelled') out.push({ label: tr('card.cancelled'), tone: 'danger' });
  else if (e.status === 'postponed') out.push({ label: tr('card.postponed'), tone: 'warning' });
  else if (e.time.happeningNow) out.push({ label: tr('card.now'), tone: 'success' });
  if (e.time.unconfirmed) out.push({ label: tr('card.unconfirmedTime'), tone: 'warning' });
  if (e.price.isFree) out.push({ label: tr('common.free'), tone: 'primary' });
  return out;
}

export function EntityCard({ entity, width = 248, reason }: { entity: EntityDTO; width?: number; reason?: string }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const isEvent = entity.type === 'event';
  const e = entity as EventDTO;
  const p = entity as PlaceDTO;
  const dist = distanceLabel(entity.distanceKm);
  const meta = isEvent ? [e.venue.name, dist].filter(Boolean).join(' · ') : [p.hours.label, dist].filter(Boolean).join(' · ');
  const badges = isEvent ? eventBadges(e, tr) : p.free.isFree ? [{ label: p.free.basis === 'typical' ? tr('common.usuallyFree') : tr('common.free'), tone: 'primary' as const }] : [];
  const title = isEvent ? e.title : p.name;
  return (
    <Tap onPress={() => openEntity(entity)} accessibilityRole="button" accessibilityLabel={`${title}. ${isEvent ? e.time.label : p.category.label}`} style={{ width }}>
      <View>
        <Cover entity={entity} height={Math.round(width * 0.62)} radius={t.radius.lg} />
        <View style={{ position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 4, flexShrink: 1 }}>
            {entity.isDemo ? <Badge label={tr('common.demo')} tone="dark" /> : null}
            {badges.slice(0, 2).map((b) => <Badge key={b.label} label={b.label} tone={b.tone} />)}
          </View>
          <SaveButton entity={entity} onDark />
        </View>
      </View>
      <View style={{ paddingTop: 10, gap: 2 }}>
        <Txt v="caption" tone="primary" numberOfLines={1}>{isEvent ? e.time.label : entity.category.label}</Txt>
        <Txt v="headline" numberOfLines={2} style={{ textDecorationLine: isEvent && e.status === 'cancelled' ? 'line-through' : 'none' }}>{title}</Txt>
        {meta ? <Txt v="caption" tone="secondary" numberOfLines={1}>{meta}</Txt> : null}
        {reason ? <Txt v="caption" tone="tertiary" numberOfLines={2} style={{ marginTop: 2 }}>{reason}</Txt> : null}
      </View>
    </Tap>
  );
}

/** Compact list row (search results, Explore, Saved). */
export function EntityRow({ entity, reason }: { entity: EntityDTO; reason?: string }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const isEvent = entity.type === 'event';
  const e = entity as EventDTO;
  const p = entity as PlaceDTO;
  const line1 = isEvent ? e.time.label : p.category.label;
  const line2 = [isEvent ? e.venue.name ?? e.city?.name : p.hours.label, distanceLabel(entity.distanceKm)].filter(Boolean).join(' · ');
  const badges = isEvent ? eventBadges(e, tr) : [];
  return (
    <Tap onPress={() => openEntity(entity)} accessibilityRole="button" style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, alignItems: 'center' }}>
      <View style={{ width: 72 }}><Cover entity={entity} height={72} radius={t.radius.md} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="caption" tone="primary" numberOfLines={1}>{line1}</Txt>
        <Txt v="bodyStrong" numberOfLines={2}>{isEvent ? e.title : p.name}</Txt>
        {line2 ? <Txt v="caption" tone="secondary" numberOfLines={1}>{line2}</Txt> : null}
        {reason ? <Txt v="caption" tone="tertiary" numberOfLines={1}>{reason}</Txt> : null}
        {badges.length || entity.isDemo ? (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            {entity.isDemo ? <Badge label={tr('common.demo')} tone="dark" /> : null}
            {badges.map((b) => <Badge key={b.label} label={b.label} tone={b.tone} />)}
          </View>
        ) : null}
      </View>
      <SaveButton entity={entity} size={18} />
    </Tap>
  );
}
