import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Modal, PanResponder, View } from 'react-native';
import { api } from '@/lib/api';
import { setProfile, useSession } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { confirmAsync, showToast } from '@/lib/feedback';
import { useTheme } from '@/theme';
import { Card } from './form';
import { AVATAR_PRESETS, Avatar } from './avatar';
import { Button, Tap, Txt } from './ui';

const VIEW = 280;

/** Square crop: drag to position, +/− to zoom; produces a 512×512 JPEG. */
function CropModal({ src, onDone, onCancel }: { src: { uri: string; width: number; height: number } | null; onDone: (base64: string) => void; onCancel: () => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const start = useRef({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const base = src ? Math.max(VIEW / src.width, VIEW / src.height) : 1;
  const scale = base * zoom;
  const w = src ? src.width * scale : VIEW;
  const h = src ? src.height * scale : VIEW;
  const clamp = (o: { x: number; y: number }) => ({ x: Math.max(-(w - VIEW) / 2, Math.min((w - VIEW) / 2, o.x)), y: Math.max(-(h - VIEW) / 2, Math.min((h - VIEW) / 2, o.y)) });
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { start.current = offRef.current; },
    onPanResponderMove: (_, g) => setOff(clampRef.current({ x: start.current.x + g.dx, y: start.current.y + g.dy })),
  })).current;
  const offRef = useRef(off); offRef.current = off;
  const clampRef = useRef(clamp); clampRef.current = clamp;
  const setZoomClamped = (z: number) => { const nz = Math.max(1, Math.min(4, z)); setZoom(nz); setOff((o) => o); };
  if (!src) return null;
  const save = async () => {
    setBusy(true);
    try {
      // Visible square → source pixels.
      const left = (w - VIEW) / 2 - off.x;
      const top = (h - VIEW) / 2 - off.y;
      const crop = { originX: Math.max(0, Math.round(left / scale)), originY: Math.max(0, Math.round(top / scale)), width: Math.round(VIEW / scale), height: Math.round(VIEW / scale) };
      crop.width = Math.min(crop.width, src.width - crop.originX);
      crop.height = Math.min(crop.height, src.height - crop.originY);
      const out = await ImageManipulator.manipulateAsync(src.uri, [{ crop }, { resize: { width: 512, height: 512 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      onDone(out.base64!);
    } catch (e) {
      showToast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 }}>
        <Txt v="headline" style={{ color: '#fff' }}>{t('avatar.cropTitle')}</Txt>
        <View {...pan.panHandlers} style={{ width: VIEW, height: VIEW, borderRadius: VIEW / 2, overflow: 'hidden', backgroundColor: '#000' }} accessibilityLabel={t('avatar.cropHint')}>
          <Image source={{ uri: src.uri }} style={{ position: 'absolute', width: w, height: h, left: (VIEW - w) / 2 + clamp(off).x, top: (VIEW - h) / 2 + clamp(off).y }} />
        </View>
        <Txt v="caption" style={{ color: '#ddd' }}>{t('avatar.cropHint')}</Txt>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Button title="−" compact kind="secondary" onPress={() => setZoomClamped(zoom - 0.25)} disabled={zoom <= 1} />
          <Txt v="bodyStrong" style={{ color: '#fff', width: 52, textAlign: 'center' }}>{Math.round(zoom * 100)}%</Txt>
          <Button title="+" compact kind="secondary" onPress={() => setZoomClamped(zoom + 0.25)} disabled={zoom >= 4} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title={t('avatar.use')} loading={busy} onPress={() => void save()} />
          <Button title={t('common.cancel')} kind="ghost" onPress={onCancel} style={{ backgroundColor: '#fff' }} />
        </View>
      </View>
    </Modal>
  );
}

/** Avatar settings: preset gallery, upload (crop/zoom), remove; saved to the account and shown next to reviews. */
export function AvatarEditor() {
  const th = useTheme();
  const { t } = useTranslation();
  const session = useSession();
  const [picking, setPicking] = useState(false);
  const [src, setSrc] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!session) return null;
  const u = session.user;
  const refresh = async () => setProfile(await api.me());
  const choose = async (preset: string | null) => {
    try { await api.setAvatarPreset(preset); await refresh(); setPicking(false); showToast(t('avatar.saved')); } catch (e) { showToast(errorText(e), 'error'); }
  };
  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showToast(t('avatar.noAccess'), 'error'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    if (a.width && a.height) setSrc({ uri: a.uri, width: a.width, height: a.height });
    else Image.getSize(a.uri, (width, height) => setSrc({ uri: a.uri, width, height }), () => showToast(t('avatar.badImage'), 'error'));
  };
  const upload = async (base64: string) => {
    setSrc(null);
    setBusy(true);
    try { await api.uploadAvatar(base64); await refresh(); showToast(t('avatar.saved')); } catch (e) { showToast(errorText(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={u.name ?? u.email ?? '?'} url={u.avatarUrl} preset={u.avatarPreset} size={72} />
        <View style={{ flex: 1, gap: 6 }}>
          <Txt v="headline">{t('avatar.title')}</Txt>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Button title={t('avatar.choose')} compact kind="secondary" onPress={() => setPicking(!picking)} />
            <Button title={t('avatar.upload')} compact kind="secondary" icon="image-outline" loading={busy} onPress={() => void pick()} />
            {u.avatarUrl ? <Button title={t('avatar.remove')} compact kind="ghost" onPress={async () => {
              if (!(await confirmAsync(t('avatar.remove'), t('avatar.removeBody'), t('avatar.remove'), t('common.cancel'), true))) return;
              try { await api.removeAvatarPhoto(); await refresh(); } catch (e) { showToast(errorText(e), 'error'); }
            }} /> : null}
          </View>
        </View>
      </View>
      {picking ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {Object.keys(AVATAR_PRESETS).map((k) => (
            <Tap key={k} onPress={() => void choose(k)} accessibilityRole="button" accessibilityLabel={k} accessibilityState={{ selected: u.avatarPreset === k }}
              style={{ padding: 3, borderRadius: 30, borderWidth: 2, borderColor: u.avatarPreset === k ? th.c.primary : 'transparent' }}>
              <Avatar name="" preset={k} size={48} />
            </Tap>
          ))}
          <Tap onPress={() => void choose(null)} accessibilityRole="button" style={{ padding: 3, borderRadius: 30, borderWidth: 2, borderColor: !u.avatarPreset && !u.avatarUrl ? th.c.primary : 'transparent' }}>
            <Avatar name={u.name ?? u.email ?? '?'} size={48} />
          </Tap>
        </View>
      ) : null}
      <CropModal src={src} onDone={(b) => void upload(b)} onCancel={() => setSrc(null)} />
    </Card>
  );
}
