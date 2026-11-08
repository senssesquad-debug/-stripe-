import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { MapMarker } from '@/lib/api';
import { useTheme } from '@/theme';
import { Button, Icon, Tap, Txt } from './ui';

export interface MapFilters { layers: string; category?: string; open_now?: boolean; free?: boolean }
export interface FocusPoint { type: 'event' | 'place'; id: string; lat: number; lng: number; title: string; subtitle?: string | null }
export interface RouteOverlay { geometry: Array<[number, number]>; origin: { lat: number; lng: number } }

export interface MapPanelProps {
  center: { lat: number; lng: number };
  /** Marker layer from /v1/map; null = no marker layer (e.g. a single focused object). */
  filters: MapFilters | null;
  focus?: FocusPoint | null;
  route?: RouteOverlay | null;
  /** Space kept free at the bottom for an overlay panel (route sheet). */
  bottomInset?: number;
}

export const openDetails = (m: { type: 'event' | 'place'; id: string }) =>
  router.push(m.type === 'event' ? { pathname: '/event/[id]', params: { id: m.id } } : { pathname: '/place/[id]', params: { id: m.id } });

export const openOnMap = (m: { type: 'event' | 'place'; id: string }, route = false, fromDetail = false) =>
  router.push({ pathname: '/locate', params: { type: m.type, id: m.id, ...(route ? { mode: 'route' } : {}), ...(fromDetail ? { from: 'detail' } : {}) } });

/** Card for a tapped marker: opens the object's card, or a route to it — all inside the app. */
export function MarkerCard({ marker, onClose }: { marker: MapMarker; onClose: () => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16, maxWidth: 520, padding: 14, borderRadius: th.radius.lg, backgroundColor: th.c.background, gap: 10, ...th.shadow.floating }}>
      <Tap onPress={() => openDetails(marker)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name={marker.type === 'event' ? 'calendar-star' : 'map-marker'} size={26} color={th.c.primaryText} />
        <View style={{ flex: 1 }}>
          <Txt v="bodyStrong" numberOfLines={2}>{marker.title}</Txt>
          {marker.subtitle ? <Txt v="caption" tone="secondary" numberOfLines={1}>{marker.subtitle}</Txt> : null}
        </View>
        <Tap onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={10}><Icon name="close" size={20} color={th.c.textTertiary} /></Tap>
      </Tap>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title={t('route.details')} compact kind="secondary" icon="information-outline" onPress={() => openDetails(marker)} />
        <Button title={t('route.route')} compact kind="ghost" icon="directions" onPress={() => openOnMap(marker, true)} />
      </View>
    </View>
  );
}
