import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import type { IconName } from '@/lib/icons';
import { useTheme } from '@/theme';

type Variant = 'display' | 'title' | 'headline' | 'body' | 'bodyStrong' | 'callout' | 'caption' | 'micro';
type Tone = 'text' | 'secondary' | 'tertiary' | 'primary' | 'onPrimary' | 'danger' | 'success' | 'warning';

export function Txt({ v = 'body', tone = 'text', style, ...rest }: TextProps & { v?: Variant; tone?: Tone; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  const color = { text: t.c.text, secondary: t.c.textSecondary, tertiary: t.c.textTertiary, primary: t.c.primaryText, onPrimary: t.c.onPrimary, danger: t.c.danger, success: t.c.success, warning: t.c.warning }[tone];
  return <Text {...rest} style={[t.type[v], { color }, style]} />;
}

export function Icon({ name, size = 20, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? t.c.text} style={style} />;
}

/** Pressable with a subtle press scale. */
export function Tap({ children, style, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <Pressable {...rest} style={({ pressed }) => [style, pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 }]}>
      {children}
    </Pressable>
  );
}

export function Button({ title, onPress, kind = 'primary', icon, loading, disabled, style, compact }: { title: string; onPress?: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; compact?: boolean }) {
  const t = useTheme();
  const bg = { primary: t.c.primary, secondary: t.c.primarySoft, ghost: 'transparent', danger: t.c.danger }[kind];
  const fg = { primary: t.c.onPrimary, secondary: t.c.primaryText, ghost: t.c.primaryText, danger: '#fff' }[kind];
  return (
    <Tap accessibilityRole="button" accessibilityLabel={title} onPress={onPress} disabled={disabled || loading}
      style={[{ backgroundColor: bg, borderRadius: t.radius.pill, paddingVertical: compact ? 9 : 14, paddingHorizontal: compact ? 14 : 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.5 : 1, minHeight: 44 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Txt v="bodyStrong" style={{ color: fg }}>{title}</Txt>
    </Tap>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  const t = useTheme();
  return (
    <Tap accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, minHeight: 36, borderRadius: t.radius.pill, backgroundColor: active ? t.c.primary : t.c.surface, borderWidth: 1, borderColor: active ? t.c.primary : t.c.border }}>
      {icon ? <Icon name={icon} size={16} color={active ? t.c.onPrimary : t.c.textSecondary} /> : null}
      <Txt v="callout" style={{ color: active ? t.c.onPrimary : t.c.text }}>{label}</Txt>
    </Tap>
  );
}

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'dark'; icon?: IconName }) {
  const t = useTheme();
  const map = {
    neutral: [t.c.surfaceAlt, t.c.textSecondary], primary: [t.c.primarySoft, t.c.primaryText], success: [t.dark ? '#123524' : '#E6F6EC', t.c.success],
    warning: [t.dark ? '#3A2E10' : '#FFF4DB', t.c.warning], danger: [t.dark ? '#3A1515' : '#FDECEC', t.c.danger], dark: ['rgba(11,21,38,0.72)', '#fff'],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: t.radius.pill, backgroundColor: bg }}>
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Txt v="micro" style={{ color: fg, textTransform: 'uppercase' }}>{label}</Txt>
    </View>
  );
}

export function Skeleton({ width, height, radius = 12, style }: { width: number | `${number}%`; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(o, { toValue: 0.5, duration: 700, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [o]);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: t.c.skeleton, opacity: o }, style]} />;
}

export function EmptyState({ icon = 'map-search-outline', title, body, action }: { icon?: IconName; title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 28, gap: 10 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={30} color={t.c.primaryText} />
      </View>
      <Txt v="headline" style={{ textAlign: 'center' }}>{title}</Txt>
      {body ? <Txt v="callout" tone="secondary" style={{ textAlign: 'center' }}>{body}</Txt> : null}
      {action ? <Button title={action.label} kind="secondary" onPress={action.onPress} compact style={{ marginTop: 6 }} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const status = (error as { status?: number })?.status;
  const msg = status === 0 ? t('errors.network') : status === 404 ? t('errors.notFound') : t('errors.server');
  return <EmptyState icon={status === 0 ? 'wifi-off' : 'alert-circle-outline'} title={msg} action={onRetry ? { label: t('common.retry'), onPress: onRetry } : undefined} />;
}

export function Banner({ icon, text, action, tone = 'primary' }: { icon: IconName; text: string; action?: { label: string; onPress: () => void }; tone?: 'primary' | 'warning' }) {
  const t = useTheme();
  const bg = tone === 'warning' ? (t.dark ? '#3A2E10' : '#FFF4DB') : t.c.primarySoft;
  const fg = tone === 'warning' ? t.c.warning : t.c.primaryText;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: t.radius.md, backgroundColor: bg }}>
      <Icon name={icon} size={18} color={fg} />
      <Txt v="callout" style={{ flex: 1, color: t.c.text }}>{text}</Txt>
      {action ? <Tap onPress={action.onPress} accessibilityRole="button"><Txt v="bodyStrong" style={{ color: fg }}>{action.label}</Txt></Tap> : null}
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.c.border, marginVertical: 4 }} />;
}

export function Row({ icon, title, subtitle, right, onPress }: { icon?: IconName; title: string; subtitle?: string | null; right?: ReactNode; onPress?: () => void }) {
  const t = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 48 }}>
      {icon ? <Icon name={icon} size={22} color={t.c.textSecondary} /> : null}
      <View style={{ flex: 1 }}>
        <Txt v="body">{title}</Txt>
        {subtitle ? <Txt v="caption" tone="secondary">{subtitle}</Txt> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={20} color={t.c.textTertiary} /> : null)}
    </View>
  );
  return onPress ? <Tap onPress={onPress} accessibilityRole="button">{body}</Tap> : body;
}

export function InfoLine({ icon, label, value, sub }: { icon: Parameters<typeof Icon>[0]['name']; label: string; value: string; sub?: string | null }) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: th.c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={th.c.primaryText} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="caption" tone="secondary">{label}</Txt>
        <Txt v="bodyStrong">{value}</Txt>
        {sub ? <Txt v="caption" tone="tertiary">{sub}</Txt> : null}
      </View>
    </View>
  );
}
