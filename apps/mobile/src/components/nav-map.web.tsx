import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl, { type GeoJSONSource, type Map as MlMap } from 'maplibre-gl';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import type { NavMapProps } from './nav-map-shared';

const STYLE = { light: 'https://tiles.openfreemap.org/styles/liberty', dark: 'https://tiles.openfreemap.org/styles/dark' };
const EMPTY = { type: 'FeatureCollection' as const, features: [] };

declare global {
  interface Window { __passtraNav?: { camera: Array<{ zoom: number; bearing: number; lat: number; lng: number; mode: string }>; targets: Array<{ zoom: number; bearing: number; mode: string }>; gestures: number } }
}

/**
 * Navigation map (web): the camera is driven only by the `view` prop. "follow" eases to the user with a fixed zoom
 * and the user below the centre; "overview" fits the rest of the route; "manual" never moves the map. A drag, zoom
 * or rotation made by the user (not by the camera itself) is reported through onGesture.
 */
export function NavMap({ geometry, traveled, position, headingDeg, accuracyM, view, onGesture, destination, stops, simulated }: NavMapProps) {
  const th = useTheme();
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<MlMap | null>(null);
  const puck = useRef<maplibregl.Marker | null>(null);
  const arrow = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const gestureRef = useRef(onGesture);
  gestureRef.current = onGesture;

  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({
      container: box.current, style: th.dark ? STYLE.dark : STYLE.light, center: destination, zoom: 14, attributionControl: { compact: true }, maxPitch: 60,
    });
    map.current = m;
    if (simulated) window.__passtraNav = { camera: [], targets: [], gestures: 0 };
    // Only events caused by the user carry the original DOM event.
    const user = (e: { originalEvent?: unknown }) => {
      if (!e.originalEvent) return;
      if (window.__passtraNav) window.__passtraNav.gestures++;
      gestureRef.current();
    };
    // MapLibre may swallow the start of a drag while a camera animation runs, so raw pointer input counts too:
    // a press that moves more than a few pixels, a wheel turn, or a two-finger touch.
    const canvas = m.getCanvasContainer();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onMove = (e: PointerEvent) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; user({ originalEvent: e }); } };
    const onUp = () => { down = null; };
    const onWheel = (e: WheelEvent) => user({ originalEvent: e });
    const onTouch = (e: TouchEvent) => { if (e.touches.length > 1) user({ originalEvent: e }); };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: true });
    canvas.addEventListener('touchstart', onTouch, { passive: true });
    m.on('dragstart', user);
    m.on('zoomstart', user);
    m.on('rotatestart', user);
    m.on('pitchstart', user);
    if (simulated) m.on('moveend', () => {
      const c = m.getCenter();
      window.__passtraNav?.camera.push({ zoom: Math.round(m.getZoom() * 100) / 100, bearing: Math.round(m.getBearing()), lat: c.lat, lng: c.lng, mode: m.getContainer().dataset.view ?? '' });
    });
    m.on('load', () => {
      m.addSource('traveled', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'traveled', type: 'line', source: 'traveled', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#9AA4B2', 'line-width': 6 } });
      m.addSource('route', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 10 } });
      m.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1769E8', 'line-width': 6 } });
      m.addSource('stops', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'stops', type: 'circle', source: 'stops', paint: { 'circle-color': '#fff', 'circle-radius': 4, 'circle-stroke-color': '#1769E8', 'circle-stroke-width': 2 } });
      m.addSource('acc', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'acc', type: 'circle', source: 'acc', paint: {
        'circle-color': '#1769E8', 'circle-opacity': 0.1,
        'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, 0, 22, ['/', ['*', ['get', 'acc'], 4194304], ['*', 156543.03, ['cos', ['/', ['*', ['get', 'lat'], 3.14159], 180]]]]] } });
      const dest = document.createElement('div');
      dest.style.cssText = 'width:22px;height:22px;border-radius:11px;background:#0D47A1;border:4px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)';
      new maplibregl.Marker({ element: dest }).setLngLat(destination).addTo(m);
      // User puck: a dot with a direction arrow; rotated with the heading, and kept upright relative to the map.
      const el = document.createElement('div');
      el.setAttribute('data-testid', 'nav-puck');
      el.style.cssText = 'width:34px;height:34px;display:flex;align-items:center;justify-content:center';
      const a = document.createElement('div');
      a.style.cssText = 'width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:22px solid #1769E8;filter:drop-shadow(0 0 2px #fff) drop-shadow(0 1px 3px rgba(0,0,0,.4));transition:transform .4s linear';
      el.appendChild(a);
      arrow.current = a;
      puck.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(destination).addTo(m);
      setLoaded(true);
    });
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(box.current);
    return () => {
      ro.disconnect(); window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('touchstart', onTouch);
      m.remove(); map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [th.dark]);

  // Route (still ahead) and the part already travelled.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    (m.getSource('route') as GeoJSONSource).setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: geometry }, properties: {} });
    (m.getSource('traveled') as GeoJSONSource).setData(traveled.length > 1 ? { type: 'Feature', geometry: { type: 'LineString', coordinates: traveled }, properties: {} } : EMPTY);
    (m.getSource('stops') as GeoJSONSource).setData({ type: 'FeatureCollection', features: (stops ?? []).map((s) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: s }, properties: {} })) });
  }, [geometry, traveled, stops, loaded]);

  // The user's position and heading.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded || !position) return;
    puck.current?.setLngLat([position.lng, position.lat]);
    if (arrow.current) arrow.current.style.transform = `rotate(${headingDeg}deg)`;
    (m.getSource('acc') as GeoJSONSource).setData({ type: 'Feature', geometry: { type: 'Point', coordinates: [position.lng, position.lat] }, properties: { acc: accuracyM ?? 0, lat: position.lat } });
  }, [position?.lat, position?.lng, headingDeg, accuracyM, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Camera. Following eases over the time since the previous update, so each move finishes just as the next fix
  // arrives (no pile-up of interrupted animations, no creeping zoom); entering a mode gets a short transition.
  const lastMove = useRef<{ at: number; kind: string }>({ at: 0, kind: '' });
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    m.getContainer().dataset.view = view.kind;
    const now = Date.now();
    const entering = lastMove.current.kind !== view.kind;
    const duration = entering ? 600 : Math.max(150, Math.min(1000, now - lastMove.current.at));
    lastMove.current = { at: now, kind: view.kind };
    if (view.kind === 'follow') {
      const c = view.cam;
      window.__passtraNav?.targets.push({ zoom: c.zoom, bearing: Math.round(c.bearing), mode: 'follow' });
      m.easeTo({ center: [c.center.lng, c.center.lat], zoom: c.zoom, bearing: c.bearing, pitch: c.pitch, offset: [0, m.getContainer().clientHeight * c.offsetY], duration, easing: (t) => t });
    } else if (view.kind === 'overview') {
      const b = view.bounds;
      window.__passtraNav?.targets.push({ zoom: -1, bearing: 0, mode: 'overview' });
      m.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: { top: 140, bottom: 220, left: 40, right: 40 }, bearing: 0, pitch: 0, maxZoom: 17, duration: 600 });
    } else {
      m.stop();
    }
  }, [view, loaded]);

  const style = useMemo(() => ({ position: 'absolute' as const, inset: 0 }), []);
  return <View style={{ flex: 1 }}>{createElement('div', { ref: box, style, 'aria-label': 'Navigation map', role: 'region', 'data-testid': 'nav-map' })}</View>;
}
