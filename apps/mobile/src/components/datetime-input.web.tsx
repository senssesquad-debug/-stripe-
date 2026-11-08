import { createElement } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Txt } from './ui';

/** Web: the browser's native date/time pickers (values are always YYYY-MM-DD / HH:MM). */
export function DateTimeField({ kind, label, value, onChange, error }: { kind: 'date' | 'time'; label: string; value: string; onChange: (v: string) => void; error?: string | null }) {
  const th = useTheme();
  return (
    <View style={{ gap: 6, flex: 1, minWidth: kind === 'date' ? 150 : 110 }}>
      <Txt v="caption" tone="secondary">{label}</Txt>
      {createElement('input', {
        type: kind, value, 'aria-label': label, step: kind === 'time' ? 300 : undefined,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        style: {
          padding: 13, borderRadius: th.radius.md, background: th.c.surface, color: th.c.text, fontFamily: th.font.medium, fontSize: 16,
          border: `1px solid ${error ? th.c.danger : 'transparent'}`, colorScheme: th.dark ? 'dark' : 'light', outline: 'none', minHeight: 48, boxSizing: 'border-box', width: '100%',
        },
      })}
      {error ? <Txt v="caption" tone="danger">{error}</Txt> : null}
    </View>
  );
}
