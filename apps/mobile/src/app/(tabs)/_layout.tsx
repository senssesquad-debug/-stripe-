import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppState } from '@/lib/store';
import { useTheme } from '@/theme';

const ICONS = {
  index: ['calendar-today', 'calendar-today-outline'],
  events: ['ticket', 'ticket-outline'],
  explore: ['compass', 'compass-outline'],
  map: ['map', 'map-outline'],
  saved: ['bookmark', 'bookmark-outline'],
  profile: ['account-circle', 'account-circle-outline'],
} as const;

export default function TabsLayout() {
  const th = useTheme();
  const { t } = useTranslation();
  const onboarded = useAppState((s) => s.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: th.c.primary,
        tabBarInactiveTintColor: th.c.textTertiary,
        tabBarStyle: { backgroundColor: th.c.background, borderTopColor: th.c.border, ...(Platform.OS === 'web' ? { height: 70, paddingTop: 6, paddingBottom: 12 } : {}) },
        tabBarLabelStyle: { fontFamily: th.font.semibold, fontSize: 11 },
        tabBarIcon: ({ focused, color, size }) => {
          const [on, off] = ICONS[route.name as keyof typeof ICONS] ?? ['circle', 'circle-outline'];
          return <MaterialCommunityIcons name={focused ? on : off} size={size} color={color as string} />;
        },
      })}>
      <Tabs.Screen name="index" options={{ title: t('tabs.today') }} />
      <Tabs.Screen name="events" options={{ title: t('tabs.events') }} />
      <Tabs.Screen name="explore" options={{ title: t('tabs.explore') }} />
      <Tabs.Screen name="map" options={{ title: t('tabs.map') }} />
      <Tabs.Screen name="saved" options={{ title: t('tabs.saved') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
