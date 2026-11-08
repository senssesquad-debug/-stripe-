import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Platform, ScrollView, TextInput, View } from 'react-native';
import { api } from '@/lib/api';
import { useTheme } from '@/theme';
import type { RouteOverlay } from './map-shared';
import { Banner, Button, Chip, Icon, Tap, Txt } from './ui';

type Origin = { lat: number; lng: number; label: string };

/**
 * Route to a destination, inside the app. The start is the current location (permission is asked only when the
 * user picks it) or a typed address/place. External map apps are offered only as a secondary option.
 */
export function RoutePanel({ dest, nav, onRoute }: { dest: { lat: number; lng: number; title: string }; nav: { google: string; apple: string } | null; onRoute: (r: RouteOverlay | null) => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [mode, setMode] = useState<'walk' | 'drive'>('walk');
  const [locating, setLocating] = useState(false);
  const [manual, setManual] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const id = setTimeout(() => setDebounced(text.trim()), 400); return () => clearTimeout(id); }, [text]);

  // If location access was granted before, use it without asking again; otherwise wait for the user's choice.
  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then((p) => { if (p.granted) void locateMe(false); }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function locateMe(ask = true) {
    setLocating(true);
    setNotice(null);
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && ask && perm.canAskAgain !== false) perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        if (ask) { setNotice(t('route.locationDenied')); setManual(true); }
        return;
      }
      const pos = (await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000 })) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: t('route.myLocation') });
      setManual(false);
    } catch {
      if (ask) { setNotice(t('route.locationFailed')); setManual(true); }
    } finally {
      setLocating(false);
    }
  }

  const suggestions = useQuery({ queryKey: ['geocode', debounced], queryFn: () => api.geocode(debounced), enabled: manual && debounced.length >= 3, staleTime: 5 * 60_000 });
  const route = useQuery({
    queryKey: ['route', origin?.lat, origin?.lng, dest.lat, dest.lng, mode],
    queryFn: () => api.route(origin!, dest, mode),
    enabled: !!origin,
    staleTime: 10 * 60_000,
  });
  useEffect(() => {
    if (route.data && origin) onRoute({ geometry: route.data.geometry, origin });
    else if (!origin) onRoute(null);
  }, [route.data, origin, onRoute]);

  const input = { flex: 1, padding: 12, borderRadius: th.radius.md, backgroundColor: th.c.surface, color: th.c.text, fontFamily: th.font.medium, fontSize: 15 } as const;
  return (
    <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
      <Txt v="headline" numberOfLines={2}>{t('route.title')}: {dest.title}</Txt>

      <View style={{ gap: 8 }}>
        <Txt v="caption" tone="secondary">{t('route.from')}</Txt>
        {origin && !manual ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name={origin.label === t('route.myLocation') ? 'crosshairs-gps' : 'map-marker-outline'} size={20} color={th.c.primaryText} />
            <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{origin.label}</Txt>
            <Button title={t('route.change')} compact kind="ghost" onPress={() => { setManual(true); setText(''); }} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button title={locating ? t('route.locating') : t('route.myLocation')} compact icon="crosshairs-gps" loading={locating} onPress={() => void locateMe(true)} />
            {!manual ? <Button title={t('route.enterStart')} compact kind="secondary" icon="form-textbox" onPress={() => setManual(true)} /> : null}
          </View>
        )}
        {notice ? <Banner icon="map-marker-off-outline" tone="warning" text={notice} /> : null}
        {manual ? (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput value={text} onChangeText={setText} placeholder={t('route.searchPlaceholder')} placeholderTextColor={th.c.textTertiary} style={input}
                autoFocus accessibilityLabel={t('route.enterStart')} returnKeyType="search" />
              {suggestions.isFetching ? <ActivityIndicator color={th.c.primary} /> : null}
            </View>
            {(suggestions.data?.items ?? []).map((s, i) => (
              <Tap key={`${s.lat},${s.lng},${i}`} accessibilityRole="button" style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, alignItems: 'center' }}
                onPress={() => { setOrigin({ lat: s.lat, lng: s.lng, label: s.label }); setManual(false); setNotice(null); }}>
                <Icon name="map-marker-outline" size={18} color={th.c.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Txt v="callout" numberOfLines={1}>{s.label}</Txt>
                  {s.sublabel ? <Txt v="caption" tone="tertiary" numberOfLines={1}>{s.sublabel}</Txt> : null}
                </View>
              </Tap>
            ))}
            {suggestions.data && !suggestions.data.items.length ? <Txt v="caption" tone="tertiary">{t('route.noResults')}</Txt> : null}
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip icon="walk" label={t('route.walk')} active={mode === 'walk'} onPress={() => setMode('walk')} />
        <Chip icon="car" label={t('route.drive')} active={mode === 'drive'} onPress={() => setMode('drive')} />
      </View>

      {route.isFetching ? <Txt v="callout" tone="secondary">{t('route.building')}</Txt> : null}
      {route.data && origin ? (
        <View style={{ gap: 6 }}>
          <Txt v="title">{route.data.durationMin >= 60
            ? t('route.summaryHours', { km: route.data.distanceKm.toLocaleString(), h: Math.floor(route.data.durationMin / 60), m: route.data.durationMin % 60 })
            : t('route.summary', { km: route.data.distanceKm.toLocaleString(), min: route.data.durationMin })}</Txt>
          {route.data.estimate ? <Banner icon="vector-line" tone="warning" text={t('route.estimate')} /> : null}
          {route.data.attribution ? <Txt v="micro" tone="tertiary">{route.data.attribution}</Txt> : null}
        </View>
      ) : null}
      {route.isError ? <Banner icon="alert-outline" tone="warning" text={(route.error as Error).message} /> : null}

      {nav ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <Txt v="caption" tone="tertiary">{t('route.openIn')}</Txt>
          <Button title="Google Maps" kind="ghost" compact onPress={() => void Linking.openURL(nav.google)} />
          {Platform.OS !== 'android' ? <Button title="Apple Maps" kind="ghost" compact onPress={() => void Linking.openURL(nav.apple)} /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
