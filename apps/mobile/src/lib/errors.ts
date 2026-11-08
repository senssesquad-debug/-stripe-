import i18n from '@/i18n';
import { ApiError } from './api';

/** A user-facing message for an API error: a translated one when we know the code, the server's text otherwise. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.isNetwork) return i18n.t('auth.err_network');
    const key = `auth.err_${e.code}`;
    if (i18n.exists(key)) return i18n.t(key);
    if (e.status === 429) return i18n.t('auth.err_rate_limited');
    if (e.status >= 500) return i18n.t('errors.server');
    return e.message;
  }
  return (e as Error)?.message ?? String(e);
}
