import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic config: injects keys that must not be committed.
 * - GOOGLE_MAPS_ANDROID_KEY: Maps SDK for Android key, restricted to package app.passtra.android + signing SHA-1.
 *   (iOS uses Apple Maps through react-native-maps and needs no key.)
 * - EAS_PROJECT_ID: from `eas init`.
 * Server-side secrets (Google Places, Anthropic, Ticketmaster …) never go into the app — see docs/04-api-keys.md.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = (config.plugins ?? []).map((p) =>
    Array.isArray(p) && p[0] === 'react-native-maps' ? ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY ?? '' }] : p,
  ) as ExpoConfig['plugins'];
  return {
    ...(config as ExpoConfig),
    plugins,
    extra: { ...config.extra, eas: { projectId: process.env.EAS_PROJECT_ID ?? config.extra?.eas?.projectId ?? undefined } },
  };
};
