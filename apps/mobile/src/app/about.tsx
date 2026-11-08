import { useQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Divider, Row, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useMeta } from '@/lib/queries';
import { useTheme } from '@/theme';

export default function About() {
  const th = useTheme();
  const { t } = useTranslation();
  const status = useQuery({ queryKey: ['status'], queryFn: api.status });
  const meta = useMeta();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Txt v="title">{t('about.title')}</Txt>
      <Txt v="body" tone="secondary">{t('about.body')}</Txt>
      <Txt v="headline">{t('about.sources')}</Txt>
      {status.data?.sources.map((s) => <Row key={s.key} icon="database-outline" title={s.name} subtitle={s.lastSuccessAt ? t('about.lastUpdate', { ago: timeAgo(s.lastSuccessAt) }) : '—'} />)}
      <Divider />
      <Txt v="headline">{t('about.attributions')}</Txt>
      {meta.data?.attributions.map((a) => <Row key={a.name} icon="copyright" title={a.name} subtitle={a.license} onPress={() => void WebBrowser.openBrowserAsync(a.url)} />)}
    </ScrollView>
  );
}
