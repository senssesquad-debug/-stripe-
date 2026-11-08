import type { ImageDTO } from '@passtra/core';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import i18n from '@/i18n';
import { sizedImage } from '@/lib/images';
import { useTheme } from '@/theme';
import { Icon, Tap, Txt } from './ui';

/** One photo as displayed: a URL plus the credit line its licence or terms require. */
export interface GalleryPhoto { url: string; caption: string | null; credit: string | null; creditUrl: string | null; key: string }

export const fromOwn = (img: ImageDTO): GalleryPhoto => ({
  url: img.url, key: img.url, caption: img.year ? i18n.t('place.photoYear', { year: img.year }) : null, credit: img.attribution ?? null, creditUrl: img.source ?? null,
});
export const fromGoogle = (p: { url: string; authors: Array<{ name: string; uri: string | null }> }): GalleryPhoto => ({
  url: p.url, key: p.url, caption: null, credit: `${p.authors.map((a) => a.name).join(', ') || 'Google user'} · Google`, creditUrl: p.authors[0]?.uri ?? null,
});

function Photo({ p, width, height, onOpen }: { p: GalleryPhoto; width: number; height: number; onOpen: () => void }) {
  const th = useTheme();
  const [failed, setFailed] = useState(false);
  if (failed) return null; // a photo that can't load is left out, never shown broken
  return (
    <View style={{ width, gap: 6 }}>
      <Tap onPress={onOpen} accessibilityRole="imagebutton" accessibilityLabel={p.caption ?? p.credit ?? ''}>
        <Image source={{ uri: sizedImage(p.url, width) }} style={{ width, height, borderRadius: th.radius.md, backgroundColor: th.c.surfaceAlt }} contentFit="cover" transition={200}
          cachePolicy="memory-disk" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      </Tap>
      {p.caption ? <Txt v="caption" tone="secondary">{p.caption}</Txt> : null}
      {p.credit ? (
        <Tap onPress={() => (p.creditUrl ? void WebBrowser.openBrowserAsync(p.creditUrl) : undefined)} accessibilityRole={p.creditUrl ? 'link' : undefined}>
          <Txt v="micro" tone="tertiary" numberOfLines={2}>{p.credit}</Txt>
        </Tap>
      ) : null}
    </View>
  );
}

/** Full-screen viewer: swipe through all photos, with each one's credit. */
export function PhotoViewer({ photos, index, onClose }: { photos: GalleryPhoto[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [page, setPage] = useState(index ?? 0);
  if (index === null) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: index * width, y: 0 }}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
          {photos.map((p) => (
            <View key={p.key} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: sizedImage(p.url, width, 2) }} style={{ width, height: height * 0.75 }} contentFit="contain" />
            </View>
          ))}
        </ScrollView>
        <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt v="callout" style={{ color: '#fff' }}>{page + 1} / {photos.length}</Txt>
          <Tap onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={12}><Icon name="close" size={28} color="#fff" /></Tap>
        </View>
        {photos[page]?.credit ? <Txt v="caption" style={{ position: 'absolute', bottom: insets.bottom + 16, left: 16, right: 16, color: '#ddd' }}>{[photos[page]!.caption, photos[page]!.credit].filter(Boolean).join(' · ')}</Txt> : null}
      </View>
    </Modal>
  );
}

/**
 * Photos of a place: current photos (own, then Google) scroll here; historical photos are a separate, captioned
 * group so they're never mistaken for how the place looks today. Tapping opens the full-screen viewer.
 */
export function PlaceGallery({ images, google = [], skipFirst }: { images: ImageDTO[]; google?: GalleryPhoto[]; skipFirst: boolean }) {
  const th = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<{ list: GalleryPhoto[]; i: number } | null>(null);
  const w = Math.min(320, width * 0.72);
  const ownCurrent = images.filter((i) => i.kind !== 'historical').map(fromOwn);
  const current = [...ownCurrent, ...google].slice(skipFirst ? 1 : 0);
  const historical = images.filter((i) => i.kind === 'historical').map(fromOwn);
  if (!current.length && !historical.length) return null;
  return (
    <View style={{ gap: 16 }}>
      {current.length ? (
        <View style={{ gap: 8 }}>
          <Txt v="headline">{t('place.photos')}</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {current.map((p, i) => <Photo key={p.key} p={p} width={w} height={w * 0.66} onOpen={() => setOpen({ list: current, i })} />)}
          </ScrollView>
        </View>
      ) : null}
      {historical.length ? (
        <View style={{ gap: 8, padding: 14, borderRadius: th.radius.lg, borderWidth: 1, borderColor: th.c.border }}>
          <Txt v="headline">{t('place.historical')}</Txt>
          <Txt v="caption" tone="secondary">{t('place.historicalNote')}</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {historical.map((p, i) => <Photo key={p.key} p={p} width={w * 0.8} height={w * 0.55} onOpen={() => setOpen({ list: historical, i })} />)}
          </ScrollView>
        </View>
      ) : null}
      <PhotoViewer photos={open?.list ?? []} index={open ? open.i : null} onClose={() => setOpen(null)} />
    </View>
  );
}
