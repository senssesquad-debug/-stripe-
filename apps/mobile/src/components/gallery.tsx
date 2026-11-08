import type { ImageDTO } from '@passtra/core';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme';
import { Tap, Txt } from './ui';

function Photo({ img, width, height, caption }: { img: ImageDTO; width: number; height: number; caption?: string | null }) {
  const th = useTheme();
  return (
    <View style={{ width, gap: 6 }}>
      <Image source={{ uri: img.url }} style={{ width, height, borderRadius: th.radius.md, backgroundColor: th.c.surfaceAlt }} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
      {caption ? <Txt v="caption" tone="secondary">{caption}</Txt> : null}
      {img.attribution ? (
        <Tap onPress={() => (img.source ? void WebBrowser.openBrowserAsync(img.source) : undefined)} accessibilityRole={img.source ? 'link' : undefined}>
          <Txt v="micro" tone="tertiary" numberOfLines={2}>{img.attribution}</Txt>
        </Tap>
      ) : null}
    </View>
  );
}

/**
 * Photos of a place: the first current photo is the cover (shown above), further current photos scroll here,
 * and historical photos are a separate, captioned group so they're never mistaken for how the place looks today.
 */
export function PlaceGallery({ images }: { images: ImageDTO[] }) {
  const th = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const w = Math.min(320, width * 0.72);
  const current = images.filter((i) => i.kind !== 'historical').slice(1);
  const historical = images.filter((i) => i.kind === 'historical');
  if (!current.length && !historical.length) return null;
  return (
    <View style={{ gap: 16 }}>
      {current.length ? (
        <View style={{ gap: 8 }}>
          <Txt v="headline">{t('place.photos')}</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {current.map((img) => <Photo key={img.url} img={img} width={w} height={w * 0.66} caption={img.year ? t('place.photoYear', { year: img.year }) : null} />)}
          </ScrollView>
        </View>
      ) : null}
      {historical.length ? (
        <View style={{ gap: 8, padding: 14, borderRadius: th.radius.lg, borderWidth: 1, borderColor: th.c.border }}>
          <Txt v="headline">{t('place.historical')}</Txt>
          <Txt v="caption" tone="secondary">{t('place.historicalNote')}</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {historical.map((img) => <Photo key={img.url} img={img} width={w * 0.8} height={w * 0.55} caption={img.year ? t('place.photoYear', { year: img.year }) : null} />)}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
