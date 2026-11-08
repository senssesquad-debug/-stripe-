import '@/i18n';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold, useFonts } from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '@/components/toast';
import i18n, { deviceLocale } from '@/i18n';
import { initAuth, useSession } from '@/lib/auth';
import { resyncPush } from '@/lib/push';
import { store, useAppState } from '@/lib/store';
import { ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: (n, e) => n < 2 && (e as { status?: number })?.status !== 404, refetchOnWindowFocus: false } },
});

function Navigator() {
  const t = useTheme();
  const header = { headerShadowVisible: false, headerStyle: { backgroundColor: t.c.background }, headerTintColor: t.c.text, headerTitleStyle: { fontFamily: t.font.bold }, headerBackButtonDisplayMode: 'minimal' as const, contentStyle: { backgroundColor: t.c.background } };
  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={header}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="event/[id]" options={{ title: '', headerTransparent: false }} />
        <Stack.Screen name="place/[id]" options={{ title: '' }} />
        <Stack.Screen name="search" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="surprise" options={{ presentation: 'modal', title: '' }} />
        <Stack.Screen name="plan" options={{ title: '' }} />
        <Stack.Screen name="city" options={{ presentation: 'modal', title: '' }} />
        <Stack.Screen name="report" options={{ presentation: 'modal', title: '' }} />
        <Stack.Screen name="signin" options={{ presentation: 'modal', title: '' }} />
        <Stack.Screen name="about" options={{ title: '' }} />
        <Stack.Screen name="notifications" options={{ title: '' }} />
        <Stack.Screen name="privacy" options={{ title: '' }} />
        <Stack.Screen name="submit" options={{ title: '' }} />
        <Stack.Screen name="account" options={{ title: '' }} />
        <Stack.Screen name="my-events/index" options={{ title: '' }} />
        <Stack.Screen name="my-events/[id]" options={{ title: '' }} />
        <Stack.Screen name="locate" options={{ title: '' }} />
      </Stack>
      <ToastHost />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  const hydrated = useAppState((s) => s.hydrated);
  const locale = useAppState((s) => s.locale);
  const [ready, setReady] = useState(false);

  const session = useSession();
  useEffect(() => {
    void store.hydrate();
    void initAuth();
  }, []);
  // Keep this device's push subscription registered with the signed-in account.
  useEffect(() => {
    if (session) void resyncPush().catch(() => undefined);
  }, [session?.user.id]);
  useEffect(() => {
    if (hydrated) void i18n.changeLanguage(locale ?? deviceLocale());
  }, [hydrated, locale]);
  useEffect(() => {
    if (fontsLoaded && hydrated) {
      setReady(true);
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, hydrated]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Navigator />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
