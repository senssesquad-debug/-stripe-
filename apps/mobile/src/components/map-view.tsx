import { groupAccent } from '@passtra/brand';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import MapView, { Circle, Marker, Polyline, type Region } from 'react-native-maps';
import { api, type MapMarker } from '@/lib/api';
import { useTheme } from '@/theme';
import { MarkerCard, type MapPanelProps } from './map-shared';
import { Button } from './ui';

/**
 * Native map (Apple Maps on iOS, Google Maps SDK on Android) showing passtra's own markers
 * (OpenStreetMap places + events), a focused object and an in-app route. No Google Places content is placed on the map (EEA terms).
 */
export function MapPanel({ center, filters, focus, route, user, bottomInset = 0 }: MapPanelProps) {
  const th = useTheme();
  const { t } = useTranslation();
  const start = focus ?? center;
  const initial: Region = { latitude: start.lat, longitude: start.lng, latitudeDelta: focus ? 0.012 : 0.05, longitudeDelta: focus ? 0.012 : 0.05 };
  const [region, setRegion] = useState<Region>(initial);
  const [query, setQuery] = useState<Region>(initial);
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const moved = useRef(false);
  const ref = useRef<MapView>(null);
  const bbox = useMemo(() => [query.longitude - query.longitudeDelta / 2, query.latitude - query.latitudeDelta / 2, query.longitude + query.longitudeDelta / 2, query.latitude + query.latitudeDelta / 2] as [number, number, number, number], [query]);
  const markers = useQuery({ queryKey: ['map', bbox, filters], queryFn: () => api.map(bbox, filters!), enabled: !!filters && query.latitudeDelta < 3 });

  useEffect(() => {
    if (!focus) { const r = { ...initial, latitude: center.lat, longitude: center.lng }; ref.current?.animateToRegion(r, 300); setQuery(r); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);
  useEffect(() => {
    if (route) ref.current?.fitToCoordinates(route.geometry.map(([lng, lat]) => ({ latitude: lat, longitude: lng })), { edgePadding: { top: 60, left: 40, right: 40, bottom: 40 + bottomInset }, animated: true });
  }, [route, bottomInset]);

  return (
    <View style={{ flex: 1 }}>
      <MapView ref={ref} style={{ flex: 1 }} initialRegion={initial} showsUserLocation showsMyLocationButton mapPadding={{ top: 0, left: 0, right: 0, bottom: bottomInset }}
        onRegionChangeComplete={(r) => { moved.current = true; setRegion(r); }} onPress={() => setSelected(null)}>
        {(filters ? markers.data?.markers ?? [] : []).map((m) => (
          <Marker key={`${m.type}:${m.id}`} coordinate={{ latitude: m.lat, longitude: m.lng }} onPress={() => setSelected(m)} tracksViewChanges={false}
            pinColor={m.type === 'event' ? th.c.primary : groupAccent.practical} accessibilityLabel={m.title} />
        ))}
        {focus ? <Marker coordinate={{ latitude: focus.lat, longitude: focus.lng }} title={focus.title} description={focus.subtitle ?? undefined} pinColor={th.c.primary} /> : null}
        {route ? <Polyline coordinates={route.geometry.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))} strokeColor={th.c.primary} strokeWidth={5} lineDashPattern={route.schematic ? [8, 8] : undefined} /> : null}
        {user?.accuracyM ? <Circle center={{ latitude: user.lat, longitude: user.lng }} radius={user.accuracyM} fillColor="rgba(23,105,232,0.12)" strokeColor="rgba(23,105,232,0.35)" /> : null}
        {route ? <Marker coordinate={{ latitude: route.origin.lat, longitude: route.origin.lng }} pinColor="#0D47A1" /> : null}
      </MapView>
      {filters && moved.current && Math.abs(region.latitude - query.latitude) + Math.abs(region.longitude - query.longitude) > region.latitudeDelta * 0.25 ? (
        <View style={{ position: 'absolute', top: 12, alignSelf: 'center' }}>
          <Button title={t('map.searchArea')} icon="refresh" compact onPress={() => setQuery(region)} />
        </View>
      ) : null}
      {selected ? <MarkerCard marker={selected} onClose={() => setSelected(null)} /> : null}
    </View>
  );
}
