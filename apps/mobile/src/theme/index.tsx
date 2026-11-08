import { colors, fontFamily, radius, shadow, space, type, type ThemeColors } from '@passtra/brand';
import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useAppState } from '@/lib/store';

export interface Theme {
  dark: boolean;
  c: ThemeColors;
  radius: typeof radius;
  space: typeof space;
  type: typeof type;
  font: typeof fontFamily;
  shadow: typeof shadow;
}

const ThemeCtx = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const pref = useAppState((s) => s.theme);
  const dark = pref === 'system' ? system === 'dark' : pref === 'dark';
  const value: Theme = { dark, c: dark ? colors.dark : colors.light, radius, space, type, font: fontFamily, shadow };
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeCtx);
  if (!t) throw new Error('ThemeProvider missing');
  return t;
}
