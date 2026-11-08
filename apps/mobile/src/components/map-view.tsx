import { groupAccent } from '@passtra/brand';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { api, type MapMarker } from '@/lib/api';
import { useTheme } from '@/theme';
import { Button, Icon, Tap, Txt } from './ui';

/**
 * Native map (Apple Maps on iOS, Google Maps SDK on Android) showing passtra's own markers
 * (OpenStreetMap places + events). No Google Places content is placed on the map (EEA terms).
 */
export function MapPanel({ center, filters }: { center: { lat: number; lng: number }; filters: { layers: string; category?: string; open_now?: boolean; free?: boolean } }) {
  const th = useTheme();
  const { t } = useTranslation();
  const initial: Region = { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  const [region, setRegion] = useState<Region>(initial);
  const [query, setQuery] = useState<Region>(initial);
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const moved = useRef(false);
  const bbox = useMemo(() => [query.longitude - query.longitudeDelta / 2, query.latitude - query.latitudeDelta / 2, query.longitude + query.longitudeDelta / 2, query.latitude + query.latitudeDelta / 2] as [number, number, number, number], [query]);
  const markers = useQuery({ queryKey: ['map', bbox, filters], queryFn: () => api.map(bbox, filters), enabled: query.latitudeDelta < 3 });

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} initialRegion={initial} showsUserLocation showsMyLocationButton onRegionChangeComplete={(r) => { moved.current = true; setRegion(r); }} onPress={() => setSelected(null)}>
        {(markers.data?.markers ?? []).map((m) => (
          <Marker key={`${m.type}:${m.id}`} coordinate={{ latitude: m.lat, longitude: m.lng }} onPress={() => setSelected(m)} tracksViewChanges={false}
            pinColor={m.type === 'event' ? th.c.primary : groupAccent.practical} accessibilityLabel={m.title} />
        ))}
      </MapView>
      {moved.current && Math.abs(region.latitude - query.latitude) + Math.abs(region.longitude - query.longitude) > region.latitudeDelta * 0.25 ? (
        <View style={{ position: 'absolute', top: 12, alignSelf: 'center' }}>
          <Button title={t('map.searchArea')} icon="refresh" compact onPress={() => setQuery(region)} />
        </View>
      ) : null}
      {selected ? (
        <Tap onPress={() => router.push(selected.type === 'event' ? { pathname: '/event/[id]', params: { id: selected.id } } : { pathname: '/place/[id]', params: { id: selected.id } })}
          style={{ position: 'absolute', left: 16, right: 16, bottom: 16, padding: 16, borderRadius: th.radius.lg, backgroundColor: th.c.background, flexDirection: 'row', alignItems: 'center', gap: 12, ...th.shadow.floating }}>
          <Icon name={selected.type === 'event' ? 'calendar-star' : 'map-marker'} size={26} color={th.c.primaryText} />
          <View style={{ flex: 1 }}>
            <Txt v="bodyStrong" numberOfLines={1}>{selected.title}</Txt>
            {selected.subtitle ? <Txt v="caption" tone="secondary" numberOfLines={1}>{selected.subtitle}</Txt> : null}
          </View>
          <Icon name="chevron-right" size={22} color={th.c.textTertiary} />
        </Tap>
      ) : null}
    </View>
  );
}
