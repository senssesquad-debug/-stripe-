import { TextInput, View } from 'react-native';
import { useTheme } from '@/theme';
import { Txt } from './ui';

/**
 * Date (YYYY-MM-DD) and time (HH:MM, 24 h) fields. Native: validated text entry with a numeric keyboard;
 * the web variant (datetime-input.web.tsx) uses the browser's own date and time pickers.
 */
export function DateTimeField({ kind, label, value, onChange, error }: { kind: 'date' | 'time'; label: string; value: string; onChange: (v: string) => void; error?: string | null }) {
  const th = useTheme();
  const format = (raw: string) => {
    const d = raw.replace(/\D/g, '');
    if (kind === 'time') return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2, 4)}` : d;
    return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join('-');
  };
  return (
    <View style={{ gap: 6, flex: 1, minWidth: kind === 'date' ? 150 : 96 }}>
      <Txt v="caption" tone="secondary">{label}</Txt>
      <TextInput value={value} onChangeText={(v) => onChange(format(v))} accessibilityLabel={label} keyboardType="number-pad"
        placeholder={kind === 'date' ? 'YYYY-MM-DD' : 'HH:MM'} maxLength={kind === 'date' ? 10 : 5} placeholderTextColor={th.c.textTertiary}
        style={{ padding: 14, borderRadius: th.radius.md, backgroundColor: th.c.surface, color: th.c.text, fontFamily: th.font.medium, fontSize: 16, borderWidth: 1, borderColor: error ? th.c.danger : 'transparent' }} />
      {error ? <Txt v="caption" tone="danger">{error}</Txt> : null}
    </View>
  );
}
