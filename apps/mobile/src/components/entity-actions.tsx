import type { EntityDTO } from '@passtra/core';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { requireAuth } from '@/lib/auth';
import { prefillFrom } from '@/lib/my-events';
import { copyLink, shareEntity } from '@/lib/share';
import { router } from 'expo-router';
import { openOnMap } from './map-shared';
import { Button } from './ui';

/** In-app actions shared by event and place cards: map, route, My events, share. */
export function EntityActions({ entity }: { entity: EntityDTO }) {
  const { t } = useTranslation();
  const hasLocation = entity.type === 'place' || (entity.location !== null && entity.location.precision !== 'city');
  return (
    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
      {hasLocation ? <Button title={t('route.route')} icon="directions" onPress={() => openOnMap(entity, true, true)} /> : null}
      {hasLocation ? <Button title={t('route.onMap')} icon="map-outline" kind="secondary" onPress={() => openOnMap(entity, false, true)} /> : null}
      <Button title={t('myEvents.add')} icon="calendar-plus" kind="secondary"
        onPress={() => requireAuth('myEvents', () => router.push({ pathname: '/my-events/[id]', params: { id: 'new', ...prefillFrom(entity) } }))} />
      <Button title={t('common.share')} icon="share-variant-outline" kind="ghost" onPress={() => void shareEntity(entity)} />
      {Platform.OS === 'web' ? null : <Button title={t('share.copyLink')} icon="link-variant" kind="ghost" onPress={() => void copyLink(entity)} />}
    </View>
  );
}
