import { confirmAsync, showToast } from '@/lib/feedback';
import { errorText } from '@/lib/errors';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Share, Switch } from 'react-native';
import { Banner, Button, Divider, Row, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { signOut, useSession } from '@/lib/auth';
import { useTheme } from '@/theme';

export const PRIVACY_URL = 'https://passtra.app/privacy';

export default function Privacy() {
  const th = useTheme();
  const { t } = useTranslation();
  const session = useSession();
  const [personal, setPersonal] = useState(true);
  useEffect(() => {
    if (session) void api.me().then((me) => setPersonal(me.personalizationEnabled as boolean)).catch(() => undefined);
  }, [session]);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Txt v="title">{t('profile.privacy')}</Txt>
      <Banner icon="map-marker-off-outline" text={t('privacy.location')} />
      {session ? (
        <>
          <Row title={t('privacy.personalization')} subtitle={t('privacy.personalizationHelp')}
            right={<Switch value={personal} trackColor={{ true: th.c.primary, false: th.c.border }} onValueChange={(v) => { setPersonal(v); void api.updateMe({ personalizationEnabled: v }); }} />} />
          <Divider />
          <Row icon="download-outline" title={t('privacy.export')} onPress={async () => { const data = await api.exportMe(); await Share.share({ message: JSON.stringify(data, null, 2) }); }} />
          <Divider />
          <Button title={t('privacy.delete')} kind="danger" icon="delete-outline" onPress={async () => {
            if (!(await confirmAsync(t('privacy.delete'), t('privacy.deleteConfirm'), t('privacy.delete'), t('common.cancel'), true))) return;
            try {
              await api.deleteMe();
              await signOut();
              showToast(t('privacy.deleted'));
              router.replace('/');
            } catch (e) {
              showToast(errorText(e), 'error');
            }
          }} />
        </>
      ) : null}
      <Row icon="file-document-outline" title={t('privacy.policy')} onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)} />
    </ScrollView>
  );
}
