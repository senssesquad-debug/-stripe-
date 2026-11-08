import type { ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme';
import { Txt } from './ui';

/** Labelled text field with an optional hint / error line. */
export function Field({ label, hint, error, right, style, ...rest }: TextInputProps & { label: string; hint?: string | null; error?: string | null; right?: ReactNode }) {
  {
    const th = useTheme();
    return (
      <View style={{ gap: 6 }}>
        <Txt v="caption" tone="secondary" nativeID={`${label}-label`}>{label}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput accessibilityLabel={label} placeholderTextColor={th.c.textTertiary} {...rest}
            style={[{ flex: 1, padding: 14, borderRadius: th.radius.md, backgroundColor: th.c.surface, color: th.c.text, fontFamily: th.font.medium, fontSize: 16, borderWidth: 1, borderColor: error ? th.c.danger : 'transparent' }, style]} />
          {right}
        </View>
        {error ? <Txt v="caption" tone="danger">{error}</Txt> : hint ? <Txt v="caption" tone="tertiary">{hint}</Txt> : null}
      </View>
    );
  }
}

export function Card({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  const th = useTheme();
  return <View style={{ padding: 16, borderRadius: th.radius.lg, backgroundColor: th.c.surface, gap }}>{children}</View>;
}
