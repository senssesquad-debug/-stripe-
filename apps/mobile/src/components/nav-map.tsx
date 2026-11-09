import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { useTheme } from '@/theme';
import type { NavMapProps } from './nav-map-shared';

/** Apple Maps uses camera altitude instead of zoom: metres of height that show about the same area. */
function altitudeFor(zoom: number, lat: number, heightPx: number): number {
  const metresPerPx = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  return (metresPerPx * heightPx) / (2 * Math.tan((30 * Math.PI) / 180 / 2));
}

/**
 * Navigation map (iOS / Android): the camera follows the `view` prop only. The user is kept below the centre with
 * top map padding; a pan or pinch by the user is reported through onGesture.
 */
export function NavMap({ geometry, traveled, position, headingDeg, accuracyM, view, onGesture, destination, stops }: NavMapProps) {
  const th = useTheme();
  const ref = useRef<MapView>(null);
  const [height, setHeight] = useState(800);

  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    if (view.kind === 'follow') {
      const c = view.cam;
      m.animateCamera({
        center: { latitude: c.center.lat, longitude: c.center.lng }, zoom: c.zoom, heading: c.bearing, pitch: c.pitch,
        ...(Platform.OS === 'ios' ? { altitude: altitudeFor(c.zoom, c.center.lat, height) } : {}),
      }, { duration: 900 });
    } else if (view.kind === 'overview') {
      const b = view.bounds;
      m.fitToCoordinates([{ latitude: b.south, longitude: b.west }, { latitude: b.north, longitude: b.east }], { edgePadding: { top: 160, bottom: 260, left: 40, right: 40 }, animated: true });
    }
  }, [view, height]);

  const follow = view.kind === 'follow';
  return (
    <View style={{ flex: 1 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      <MapView ref={ref} style={{ flex: 1 }} initialCamera={{ center: { latitude: destination[1], longitude: destination[0] }, zoom: 14, heading: 0, pitch: 0, altitude: 5000 }}
        // The user sits lower on the screen while following, so more of the road ahead is visible.
        mapPadding={{ top: follow ? Math.round(height * (view.kind === 'follow' ? view.cam.offsetY * 2 : 0)) : 0, left: 0, right: 0, bottom: 0 }}
        onPanDrag={onGesture}
        onRegionChangeComplete={(_r, details) => { if ((details as { isGesture?: boolean } | undefined)?.isGesture) onGesture(); }}
        pitchEnabled rotateEnabled showsCompass={!follow} toolbarEnabled={false}>
        {traveled.length > 1 ? <Polyline coordinates={traveled.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))} strokeColor="#9AA4B2" strokeWidth={6} /> : null}
        <Polyline coordinates={geometry.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))} strokeColor={th.c.primary} strokeWidth={6} />
        {(stops ?? []).map(([lng, lat], i) => <Circle key={i} center={{ latitude: lat, longitude: lng }} radius={6} fillColor="#fff" strokeColor={th.c.primary} strokeWidth={2} />)}
        <Marker coordinate={{ latitude: destination[1], longitude: destination[0] }} pinColor="#0D47A1" />
        {position && accuracyM ? <Circle center={{ latitude: position.lat, longitude: position.lng }} radius={accuracyM} fillColor="rgba(23,105,232,0.1)" strokeColor="rgba(23,105,232,0.3)" /> : null}
        {position ? (
          <Marker coordinate={{ latitude: position.lat, longitude: position.lng }} anchor={{ x: 0.5, y: 0.5 }} flat rotation={headingDeg} tracksViewChanges={false}>
            <View style={{ width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 22, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: th.c.primary }} />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}
