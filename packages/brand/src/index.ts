/**
 * passtra design tokens — the single source of truth for the mobile app, admin panel and web assets.
 * Brand: primary blue #1769E8, dark blue #0D47A1, white, light blue #EAF2FF, subtle neutral greys.
 */
export const palette = {
  blue: '#1769E8',
  blueDark: '#0D47A1',
  blueLight: '#EAF2FF',
  white: '#FFFFFF',
  blue300: '#6EA3FF', // readable blue on dark surfaces (AA on #0A1020)
  blue900: '#0A2B66',
  grey50: '#F7F9FC',
  grey100: '#F1F4F9',
  grey200: '#E3E8F0',
  grey400: '#A9B3C4',
  grey500: '#8A93A3',
  grey600: '#5B6576',
  ink: '#0B1526',
  night: '#0A1020',
  night2: '#121A2B',
  night3: '#1A2438',
  night4: '#263248',
  green: '#12A150',
  amber: '#C98A0B',
  red: '#D93A3A',
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string; // filled buttons, active states (white text on top)
  primaryText: string; // links / blue text on this background
  primarySoft: string; // chips, highlights
  onPrimary: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
  skeleton: string;
}

export const colors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    background: palette.white,
    surface: palette.grey50,
    surfaceAlt: palette.grey100,
    border: palette.grey200,
    text: palette.ink,
    textSecondary: palette.grey600,
    textTertiary: palette.grey500,
    primary: palette.blue,
    primaryText: palette.blue,
    primarySoft: palette.blueLight,
    onPrimary: palette.white,
    success: palette.green,
    warning: palette.amber,
    danger: palette.red,
    overlay: 'rgba(11,21,38,0.45)',
    skeleton: palette.grey100,
  },
  dark: {
    background: palette.night,
    surface: palette.night2,
    surfaceAlt: palette.night3,
    border: palette.night4,
    text: '#F2F5FA',
    textSecondary: palette.grey400,
    textTertiary: palette.grey500,
    primary: palette.blue,
    primaryText: palette.blue300,
    primarySoft: '#13254A',
    onPrimary: palette.white,
    success: '#3CC77A',
    warning: '#E8B34A',
    danger: '#F06A6A',
    overlay: 'rgba(0,0,0,0.6)',
    skeleton: palette.night3,
  },
};

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;

/**
 * UI typeface: Manrope (OFL) — covers Latin, Greek and Cyrillic, required for en/el/ru.
 * The "passtra" wordmark is set in Plus Jakarta Sans ExtraBold and used as an image only
 * (Plus Jakarta Sans has no Greek/Cyrillic glyphs, so it must not be used for UI text).
 */
export const fontFamily = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export const type = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  title: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  headline: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  callout: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 19, letterSpacing: 0 },
  caption: { fontFamily: fontFamily.medium, fontSize: 12.5, lineHeight: 16, letterSpacing: 0.1 },
  micro: { fontFamily: fontFamily.bold, fontSize: 11, lineHeight: 13, letterSpacing: 0.4 },
} as const;

export const shadow = {
  card: { shadowColor: palette.ink, shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  floating: { shadowColor: palette.ink, shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
} as const;

export const motion = { fast: 150, base: 220, slow: 320 } as const;

/** Map/category accent per interest group — muted, used only for small markers and chips. */
export const groupAccent: Record<string, string> = {
  music: '#1769E8', nightlife: '#5B3FD6', food: '#E0672E', shopping: '#C2417A', sports: '#12A150', nature: '#2E9E6B',
  culture: '#0D47A1', family: '#E8A317', adventure: '#0F8FB3', technology: '#4F5D75', art: '#B5487F', wellness: '#8A5CC2', practical: '#5B6576',
};
