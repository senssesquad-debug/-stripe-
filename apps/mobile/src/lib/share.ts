import type { EntityDTO } from '@passtra/core';
import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';
import i18n from '@/i18n';
import { showToast } from './feedback';

/**
 * Public link of the site that serves the web app (the same URL opens the installed app through
 * Universal Links / App Links, and the web app otherwise). On the web it's simply the current origin.
 */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL
  ?? (Platform.OS === 'web' && typeof location !== 'undefined' ? location.origin : 'https://passtra.onrender.com')).replace(/\/$/, '');

export const entityUrl = (e: Pick<EntityDTO, 'type' | 'id'>) => `${WEB_URL}/${e.type}/${e.id}`;

/** Share one specific object. Web: system share sheet where available, else copy the link. */
export async function shareEntity(e: EntityDTO): Promise<void> {
  const url = entityUrl(e);
  const title = e.type === 'event' ? e.title : e.name;
  const text = e.type === 'event' ? `${title} — ${e.time.label}` : [title, e.city?.name].filter(Boolean).join(' · ');
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as Navigator | undefined;
    if (nav?.share && (!nav.canShare || nav.canShare({ title, text, url }))) {
      try {
        await nav.share({ title, text, url });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // user closed the sheet
      }
    }
    try {
      await nav!.clipboard.writeText(url);
      showToast(i18n.t('share.copied'));
    } catch {
      globalThis.prompt?.(i18n.t('share.copyManually'), url);
    }
    return;
  }
  await Share.share(Platform.OS === 'ios' ? { message: text, url } : { message: `${text}\n${url}`, title });
}

export async function copyLink(e: Pick<EntityDTO, 'type' | 'id'>): Promise<void> {
  await Clipboard.setStringAsync(entityUrl(e));
  showToast(i18n.t('share.copied'));
}
