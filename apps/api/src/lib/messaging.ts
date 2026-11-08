import type { AppConfig } from '../config';

export class DeliveryUnavailableError extends Error {
  constructor(public channel: 'email' | 'sms') {
    super(`${channel} delivery is not configured`);
  }
}

/** Sends a transactional email via Resend (https://resend.com). */
export async function sendEmail(config: AppConfig, to: string, subject: string, text: string): Promise<void> {
  if (!config.RESEND_API_KEY) throw new DeliveryUnavailableError('email');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: config.EMAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Email provider error ${res.status}`);
}

/** Sends an SMS via Twilio Programmable Messaging. */
export async function sendSms(config: AppConfig, to: string, body: string): Promise<void> {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = config;
  if (!sid || !token || !from) throw new DeliveryUnavailableError('sms');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`SMS provider error ${res.status}`);
}
