import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { Icon, Tap } from './ui';

export function HomeButton() {
  const th = useTheme();
  const { t } = useTranslation();
  return (
    <Tap accessibilityRole="button" accessibilityLabel={t('common.home')} hitSlop={10} onPress={() => router.replace('/' as Href)} style={{ padding: 6 }}>
      <Icon name="home-outline" size={24} color={th.c.text} />
    </Tap>
  );
}

/** Back when there is history; Home when the screen was opened directly from a shared link or after a reload. */
export const headerLeftForDirectOpen = () => (router.canGoBack() ? undefined : () => <HomeButton />);
