import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import type pg from 'pg';
import * as webpush from 'web-push';
import type { AppConfig } from '../config';

/**
 * Real push delivery to every device of a user:
 *  - native apps: Expo push service (tokens registered by the iOS/Android app)
 *  - browsers: Web Push (VAPID) — works when the site is closed, delivered by the browser vendor's push service
 * Nothing is "simulated": results report what the push services accepted.
 */
export interface PushPayload {
  title: string;
  body: string;
  url?: string; // path inside the app to open on tap, e.g. /my-events
  tag?: string;
}

export interface DeliveryResult {
  webPush: { sent: number; failed: number };
  expo: { sent: number; failed: number };
}

let vapidReady: Promise<{ publicKey: string }> | null = null;

/** VAPID keys from env, or generated once and stored in app_settings. */
export function ensureVapid(pool: pg.Pool, config: AppConfig): Promise<{ publicKey: string }> {
  vapidReady ??= (async () => {
    let publicKey = config.WEB_PUSH_PUBLIC_KEY;
    let privateKey = config.WEB_PUSH_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      const row = (await pool.query<{ value: { publicKey: string; privateKey: string } }>(`SELECT value FROM app_settings WHERE key = 'vapid'`)).rows[0];
      if (row) ({ publicKey, privateKey } = row.value);
      else {
        const k = webpush.generateVAPIDKeys();
        await pool.query(`INSERT INTO app_settings (key, value) VALUES ('vapid', $1) ON CONFLICT (key) DO NOTHING`, [JSON.stringify(k)]);
        const stored = (await pool.query<{ value: { publicKey: string; privateKey: string } }>(`SELECT value FROM app_settings WHERE key = 'vapid'`)).rows[0]!;
        ({ publicKey, privateKey } = stored.value);
      }
    }
    webpush.setVapidDetails(config.WEB_PUSH_SUBJECT, publicKey!, privateKey!);
    return { publicKey: publicKey! };
  })();
  return vapidReady;
}

/** Test seam: replaced in tests to capture deliveries without calling real push services. */
export const transport = {
  web: (sub: webpush.PushSubscription, payload: string) => webpush.sendNotification(sub, payload, { TTL: 3600 }),
  expo: (expo: Expo, messages: ExpoPushMessage[]) => expo.sendPushNotificationsAsync(messages),
};

export async function pushToUser(pool: pg.Pool, config: AppConfig, userId: string, p: PushPayload): Promise<DeliveryResult> {
  const result: DeliveryResult = { webPush: { sent: 0, failed: 0 }, expo: { sent: 0, failed: 0 } };
  const subs = await pool.query<{ endpoint: string; p256dh: string; auth: string }>(
    'SELECT endpoint, p256dh, auth FROM web_push_subscriptions WHERE user_id = $1 AND disabled_at IS NULL', [userId]);
  if (subs.rowCount) {
    await ensureVapid(pool, config);
    const payload = JSON.stringify({ title: p.title, body: p.body, url: p.url ?? '/', tag: p.tag });
    for (const s of subs.rows) {
      try {
        await transport.web({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        result.webPush.sent++;
        await pool.query('UPDATE web_push_subscriptions SET last_success_at = now() WHERE endpoint = $1', [s.endpoint]);
      } catch (e) {
        result.webPush.failed++;
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await pool.query('UPDATE web_push_subscriptions SET disabled_at = now() WHERE endpoint = $1', [s.endpoint]);
      }
    }
  }
  const tokens = await pool.query<{ token: string }>('SELECT token FROM push_tokens WHERE user_id = $1 AND disabled_at IS NULL', [userId]);
  const messages: ExpoPushMessage[] = tokens.rows.filter((t) => Expo.isExpoPushToken(t.token)).map((t) => ({ to: t.token, title: p.title, body: p.body, sound: 'default', data: { url: p.url ?? '/' } }));
  if (messages.length) {
    const expo = new Expo({ accessToken: config.EXPO_ACCESS_TOKEN });
    for (const chunk of expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await transport.expo(expo, chunk);
        tickets.forEach((t, i) => {
          if (t.status === 'ok') result.expo.sent++;
          else {
            result.expo.failed++;
            if (t.details?.error === 'DeviceNotRegistered') void pool.query('UPDATE push_tokens SET disabled_at = now() WHERE token = $1', [chunk[i]!.to as string]);
          }
        });
      } catch {
        result.expo.failed += chunk.length;
      }
    }
  }
  return result;
}

export const delivered = (r: DeliveryResult) => r.webPush.sent + r.expo.sent > 0;
export const hasChannels = (r: DeliveryResult) => r.webPush.sent + r.webPush.failed + r.expo.sent + r.expo.failed > 0;
