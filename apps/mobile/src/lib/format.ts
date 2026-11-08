import i18n from '@/i18n';

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const diff = Math.max(0, now - Date.parse(iso)) / 1000;
  if (diff < 90) return i18n.t('ago.justNow');
  if (diff < 3600) return i18n.t('ago.minutes', { count: Math.round(diff / 60) });
  if (diff < 86400) return i18n.t('ago.hours', { count: Math.round(diff / 3600) });
  return i18n.t('ago.days', { count: Math.round(diff / 86400) });
}

export function distanceLabel(km: number | null | undefined): string | null {
  if (km === null || km === undefined) return null;
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} ${i18n.t('common.km')}`;
}
