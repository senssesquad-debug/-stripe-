import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/lib/feedback';
import { useTheme } from '@/theme';
import { Icon, Txt } from './ui';

/** App-wide toast (confirmations like "Link copied", "Saved"); announced to screen readers. */
export function ToastHost() {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 84, alignItems: 'center' }}>
      <View accessibilityLiveRegion="polite" accessibilityRole="alert"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 520, paddingVertical: 12, paddingHorizontal: 16, borderRadius: th.radius.lg, backgroundColor: toast.tone === 'error' ? th.c.danger : th.dark ? '#E8EEF8' : '#0B1526', ...th.shadow.floating }}>
        <Icon name={toast.tone === 'error' ? 'alert-circle-outline' : 'check-circle-outline'} size={18} color={toast.tone === 'error' || !th.dark ? '#fff' : '#0B1526'} />
        <Txt v="callout" style={{ color: toast.tone === 'error' || !th.dark ? '#fff' : '#0B1526', flexShrink: 1 }}>{toast.text}</Txt>
      </View>
    </View>
  );
}
