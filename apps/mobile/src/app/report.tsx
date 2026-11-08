import { confirmAsync, showToast } from '@/lib/feedback';
import { errorText } from '@/lib/errors';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';
import { Button, Chip, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useTheme } from '@/theme';

const KINDS = { event: ['cancelled', 'wrong_time', 'wrong_location', 'wrong_price', 'duplicate', 'inappropriate', 'other'], place: ['closed', 'wrong_location', 'wrong_time', 'duplicate', 'inappropriate', 'other'] } as const;

export default function Report() {
  const th = useTheme();
  const { t } = useTranslation();
  const { type, id } = useLocalSearchParams<{ type: 'event' | 'place'; id: string }>();
  const [kind, setKind] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!kind) return;
    setBusy(true);
    try {
      await api.report({ entityType: type, entityId: id, kind, message: message.trim() || undefined });
      showToast(t('verification.reportThanks'));
      router.back();
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: th.c.background }} contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Txt v="title">{t('report.title')}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(KINDS[type] ?? KINDS.event).map((k) => <Chip key={k} label={t(`report.${k}`)} active={kind === k} onPress={() => setKind(k)} />)}
      </View>
      <TextInput multiline value={message} onChangeText={setMessage} placeholder={t('report.messagePlaceholder')} placeholderTextColor={th.c.textTertiary} maxLength={2000}
        style={{ minHeight: 120, padding: 14, borderRadius: th.radius.md, backgroundColor: th.c.surface, color: th.c.text, fontFamily: th.font.medium, textAlignVertical: 'top' }} />
      <Button title={t('report.send')} onPress={() => void send()} disabled={!kind} loading={busy} />
    </ScrollView>
  );
}
