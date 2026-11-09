import { Image } from 'expo-image';
import { View } from 'react-native';
import { API_URL } from '@/lib/api';
import { useTheme } from '@/theme';
import { Icon, Txt } from './ui';

/** Built-in avatars: an icon on a brand-coloured background (no external images). */
export const AVATAR_PRESETS: Record<string, { icon: 'emoticon-happy-outline' | 'palm-tree' | 'waves' | 'weather-sunny' | 'music' | 'silverware-fork-knife' | 'hiking' | 'camera-outline' | 'bike' | 'cat' | 'dog' | 'star-four-points-outline'; bg: string }> = {
  smile: { icon: 'emoticon-happy-outline', bg: '#1769E8' }, palm: { icon: 'palm-tree', bg: '#0F9D7A' }, sea: { icon: 'waves', bg: '#0D47A1' },
  sun: { icon: 'weather-sunny', bg: '#E8A317' }, music: { icon: 'music', bg: '#7B3FE4' }, food: { icon: 'silverware-fork-knife', bg: '#E8590C' },
  hiking: { icon: 'hiking', bg: '#2F9E44' }, camera: { icon: 'camera-outline', bg: '#495057' }, bike: { icon: 'bike', bg: '#1098AD' },
  cat: { icon: 'cat', bg: '#C2255C' }, dog: { icon: 'dog', bg: '#A0522D' }, star: { icon: 'star-four-points-outline', bg: '#0009A9' },
};

/** A user's avatar: uploaded photo, chosen preset, or initials. */
export function Avatar({ name, url, preset, size = 36 }: { name: string; url?: string | null; preset?: string | null; size?: number }) {
  const th = useTheme();
  const p = preset ? AVATAR_PRESETS[preset] : null;
  const src = url ? (url.startsWith('http') ? url : `${API_URL}${url}`) : null;
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: th.c.surfaceAlt }} contentFit="cover" accessibilityIgnoresInvertColors />;
  if (p) return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={p.icon} size={size * 0.55} color="#fff" /></View>;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: th.c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Txt v="callout" tone="primary" style={{ fontSize: size * 0.4 }}>{initials}</Txt></View>;
}
