import 'maplibre-gl/dist/maplibre-gl.css';
import { useQuery } from '@tanstack/react-query';
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike, type Map as MlMap } from 'maplibre-gl';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { api, type MapMarker } from '@/lib/api';
import { useTheme } from '@/theme';
import { MarkerCard, type MapPanelProps } from './map-shared';

/**
 * Web map: MapLibre GL with OpenFreeMap vector tiles (OpenStreetMap data, no API key; attribution shown on the map).
 * Shows passtra's own markers, a focused object and an in-app route.
 */
const STYLE = { light: 'https://tiles.openfreemap.org/styles/liberty', dark: 'https://tiles.openfreemap.org/styles/dark' };
const EMPTY = { type: 'FeatureCollection' as const, features: [] };

export function MapPanel({ center, filters, focus, route, user, bottomInset = 0 }: MapPanelProps) {
  const th = useTheme();
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<MlMap | null>(null);
  const extras = useRef<maplibregl.Marker[]>([]);
  const [loaded, setLoaded] = useState(0); // bumps when a (re)created style is ready
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const markersRef = useRef<MapMarker[]>([]);

  // Create the map (recreated when switching light/dark so the matching basemap is used).
  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({
      container: box.current,
      style: th.dark ? STYLE.dark : STYLE.light,
      center: [focus?.lng ?? center.lng, focus?.lat ?? center.lat],
      zoom: focus ? 15 : 13,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    // The browser asks for location only when the user presses this button.
    m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false }, trackUserLocation: false }), 'top-right');
    const report = () => {
      const b = m.getBounds();
      setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => Math.round(n * 1000) / 1000) as [number, number, number, number]);
    };
    m.on('load', () => {
      m.addSource('markers', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 40, clusterMaxZoom: 15 });
      m.addLayer({ id: 'clusters', type: 'circle', source: 'markers', filter: ['has', 'point_count'],
        paint: { 'circle-color': '#1769E8', 'circle-opacity': 0.85, 'circle-radius': ['step', ['get', 'point_count'], 16, 20, 20, 100, 26], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
      m.addLayer({ id: 'cluster-count', type: 'symbol', source: 'markers', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': '#fff' } });
      m.addLayer({ id: 'points', type: 'circle', source: 'markers', filter: ['!', ['has', 'point_count']],
        paint: { 'circle-color': ['match', ['get', 'type'], 'event', '#1769E8', '#0D47A1'], 'circle-radius': 7, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
      m.addSource('route', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 8 } }, 'clusters');
      m.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1769E8', 'line-width': 5 } }, 'clusters');
      // Live position: accuracy circle (metres → pixels at the current zoom) and a dot.
      m.addSource('user', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'user-acc', type: 'circle', source: 'user', paint: {
        'circle-color': '#1769E8', 'circle-opacity': 0.12, 'circle-stroke-color': '#1769E8', 'circle-stroke-opacity': 0.3, 'circle-stroke-width': 1,
        'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, 0, 22, ['/', ['*', ['get', 'acc'], 4194304], ['*', 156543.03, ['cos', ['/', ['*', ['get', 'lat'], 3.14159], 180]]]]] } });
      m.addLayer({ id: 'user-dot', type: 'circle', source: 'user', paint: { 'circle-color': '#1769E8', 'circle-radius': 7, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
      m.on('click', 'points', (e) => {
        const id = e.features?.[0]?.properties?.key as string | undefined;
        const hit = markersRef.current.find((x) => `${x.type}:${x.id}` === id);
        if (hit) setSelected(hit);
      });
      m.on('click', 'clusters', async (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const zoom = await (m.getSource('markers') as GeoJSONSource).getClusterExpansionZoom(f.properties!.cluster_id as number);
        m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
      for (const l of ['points', 'clusters']) {
        m.on('mouseenter', l, () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', l, () => { m.getCanvas().style.cursor = ''; });
      }
      report();
      setLoaded((n) => n + 1);
    });
    m.on('moveend', report);
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(box.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [th.dark]);

  // Recentre when the city / GPS centre changes (map tab), unless a specific object is focused.
  useEffect(() => {
    if (!focus) map.current?.jumpTo({ center: [center.lng, center.lat] });
  }, [center.lat, center.lng, focus]);

  const wide = bbox ? bbox[2] - bbox[0] > 3 || bbox[3] - bbox[1] > 3 : true;
  const q = useQuery({ queryKey: ['map', bbox, filters], queryFn: () => api.map(bbox!, filters!), enabled: !!filters && !!bbox && !wide, placeholderData: (prev) => prev });
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    const list = filters ? q.data?.markers ?? [] : [];
    markersRef.current = list;
    (m.getSource('markers') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: list.map((x) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x.lng, x.lat] }, properties: { key: `${x.type}:${x.id}`, type: x.type } })),
    });
  }, [q.data, loaded, filters]);

  // Focused object, route line and start point.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    extras.current.forEach((x) => x.remove());
    extras.current = [];
    if (focus) extras.current.push(new maplibregl.Marker({ color: '#1769E8' }).setLngLat([focus.lng, focus.lat]).setPopup(new maplibregl.Popup({ offset: 24 }).setText(focus.title)).addTo(m));
    (m.getSource('route') as GeoJSONSource | undefined)?.setData(route ? { type: 'Feature', geometry: { type: 'LineString', coordinates: route.geometry }, properties: {} } : EMPTY);
    if (m.getLayer('route')) m.setPaintProperty('route', 'line-dasharray', route?.schematic ? [1.5, 1.5] : [1, 0]);
    if (route) {
      const dot = document.createElement('div');
      dot.style.cssText = 'width:16px;height:16px;border-radius:8px;background:#fff;border:4px solid #0D47A1;box-shadow:0 1px 4px rgba(0,0,0,.3)';
      extras.current.push(new maplibregl.Marker({ element: dot }).setLngLat([route.origin.lng, route.origin.lat]).addTo(m));
      const lngs = route.geometry.map((c) => c[0]);
      const lats = route.geometry.map((c) => c[1]);
      const bounds: LngLatBoundsLike = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
      m.fitBounds(bounds, { padding: { top: 60, left: 40, right: 40, bottom: 40 + bottomInset }, maxZoom: 16, duration: 600 });
    } else if (focus) {
      m.easeTo({ center: [focus.lng, focus.lat], zoom: Math.max(m.getZoom(), 14), offset: [0, -bottomInset / 2] });
    }
  }, [focus?.id, focus?.lat, focus?.lng, route, loaded, bottomInset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    (m.getSource('user') as GeoJSONSource | undefined)?.setData(user
      ? { type: 'Feature', geometry: { type: 'Point', coordinates: [user.lng, user.lat] }, properties: { acc: user.accuracyM ?? 0, lat: user.lat } }
      : EMPTY);
  }, [user?.lat, user?.lng, user?.accuracyM, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useMemo(() => ({ position: 'absolute' as const, inset: 0 }), []);
  return (
    <View style={{ flex: 1 }}>
      {createElement('div', { ref: box, style, 'aria-label': 'Map', role: 'region' })}
      {selected ? <MarkerCard marker={selected} onClose={() => setSelected(null)} /> : null}
    </View>
  );
}
