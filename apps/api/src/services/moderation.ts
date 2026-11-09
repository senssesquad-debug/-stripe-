import Anthropic from '@anthropic-ai/sdk';
import { normalizeText } from '@passtra/core';
import type { AppConfig } from '../config';
import type { Logger } from '../engine/types';

/**
 * Review moderation: multilingual rules (en / el / ru) + optional AI judgement of context.
 *  - A single rude word in an otherwise normal review is not a reason to block it ("the souvlaki was damn good").
 *  - Personal data (phones, e-mails) is masked automatically.
 *  - Threats, slurs, insults aimed at people, links, ads/scams and duplicate texts go to a human (pending);
 *    only clear-cut cases (scam links, threats confirmed by AI) are rejected outright.
 */
export type Label = 'profanity' | 'insult' | 'slur' | 'threat' | 'spam' | 'ads' | 'scam_link' | 'link' | 'personal_data' | 'duplicate' | 'suspicious_account';
export interface Moderation { decision: 'publish' | 'pending' | 'reject'; labels: Label[]; reasons: string[]; engine: 'rules' | 'ai'; text: string }

const n = (s: string) => normalizeText(s);
const words = (list: string[]) => list.map(n);
// Stems match at word starts (normalized: lower-case, no accents).
const PROFANITY = words(['fuck', 'shit', 'bullshit', 'crap', 'damn', 'wtf', 'хрен', 'херн', 'говн', 'блин', 'бля', 'хуй', 'хуе', 'пизд', 'ебан', 'ебат', 'σκατ', 'γαμ', 'μαλακ']);
const INSULT = words(['idiot', 'stupid', 'moron', 'dumb', 'loser', 'scum', 'идиот', 'дебил', 'тупой', 'тупая', 'урод', 'мраз', 'сволоч', 'ηλιθι', 'βλακα', 'καθαρμα', 'κοπροσκυλ']);
const SLUR = words(['retard', 'faggot', 'nigger', 'nigga', 'пидор', 'пидар', 'чурк', 'хач', 'πουστ', 'αραπ']);
const THREAT = [/\b(i ?will|i'?ll|gonna|going to) (kill|hurt|burn|beat|find)\b/, /\bkill (you|him|her|them|the owner)\b/, /\bубью\b|\bубить (тебя|вас|его|ее)\b|\bсожгу\b|\bнайду тебя\b/, /θα σε (σκοτωσω|βρω)|θα (τους|τον) σκοτωσω|θα το καψω/, /\bbomb\b|\bбомб\w*|βομβ\w*/];
const ADS = [/\b(promo|discount|coupon) code\b/, /\bcrypto|bitcoin|forex|investment opportunity|earn money|work from home|casino|betting|loan offer\b/, /\bwhatsapp|telegram|viber\b/, /\bкриптовалют|заработ\w* в интернете|казино|ставки на спорт|промокод/, /κρυπτονομισμ|καζινο|στοιχηματ|κωδικο[σς]? εκπτωσ/];
const SCAM_HOSTS = /(bit\.ly|tinyurl\.com|t\.me|wa\.me|goo\.gl|is\.gd|cutt\.ly|rb\.gy|telegra\.ph)/i;
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s]+|[a-z0-9-]+\.(?:com|net|org|ru|io|me|ly|gl|gd|ph|co|cc|info|biz|app|link|shop|club|store|xyz|top|site|online|cy|gr|eu|uk|de)\b[^\s]*)/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /(?:\+|00)?\d[\d\s().-]{7,}\d/g;

const hasStem = (text: string, stems: string[]) => {
  const toks = n(text).split(' ');
  return stems.filter((st) => toks.some((t) => t.startsWith(st)));
};

export function ruleCheck(text: string): { labels: Label[]; reasons: string[]; masked: string } {
  const labels = new Set<Label>();
  const reasons: string[] = [];
  let masked = text.replace(EMAIL_RE, '[hidden]');
  masked = masked.replace(PHONE_RE, (m) => (m.replace(/\D/g, '').length >= 8 ? '[hidden]' : m));
  if (masked !== text) { labels.add('personal_data'); reasons.push('Contact details were hidden'); }
  const norm = n(masked);
  const prof = hasStem(masked, PROFANITY);
  if (prof.length) labels.add('profanity');
  if (hasStem(masked, INSULT).length) labels.add('insult');
  if (hasStem(masked, SLUR).length) { labels.add('slur'); reasons.push('Slur'); }
  if (THREAT.some((re) => re.test(norm))) { labels.add('threat'); reasons.push('Possible threat'); }
  if (ADS.some((re) => re.test(norm))) { labels.add('ads'); reasons.push('Advertising'); }
  const urls = masked.match(URL_RE) ?? [];
  if (urls.length) {
    labels.add('link');
    if (urls.some((u) => SCAM_HOSTS.test(u))) { labels.add('scam_link'); reasons.push('Shortened or messenger link'); }
  }
  if (/(.)\1{7,}/.test(masked) || (masked.length > 30 && masked.replace(/[^A-ZА-ЯΑ-Ω]/g, '').length / masked.replace(/\s/g, '').length > 0.7)) { labels.add('spam'); reasons.push('Repeated characters or all caps'); }
  return { labels: [...labels], reasons, masked };
}

/** Combine rule labels (and the AI's view of context) into a decision. */
export function decide(labels: Label[], ai: { decision: 'publish' | 'pending' | 'reject'; severity: number } | null): Moderation['decision'] {
  const has = (l: Label) => labels.includes(l);
  if (has('scam_link') && (has('ads') || !ai || ai.decision === 'reject')) return 'reject';
  if (ai?.decision === 'reject' && ai.severity >= 3) return 'reject';
  // Always a human for these, unless the AI is sure the context is harmless (e.g. a quote, a joke about a dish).
  const serious = has('threat') || has('slur') || has('link') || has('ads') || has('duplicate') || has('spam');
  if (serious) return ai?.decision === 'publish' && !has('link') && !has('duplicate') ? 'publish' : 'pending';
  // Rude words alone don't block a review; an insult aimed at people goes to a human unless AI sees it's fine.
  if (has('insult') && has('profanity')) return ai ? (ai.decision === 'publish' ? 'publish' : 'pending') : 'pending';
  if (has('suspicious_account')) return 'pending';
  return ai?.decision === 'pending' && ai.severity >= 2 ? 'pending' : 'publish';
}

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['decision', 'severity', 'labels', 'reason'],
  properties: {
    decision: { type: 'string', enum: ['publish', 'pending', 'reject'] },
    severity: { type: 'integer', minimum: 0, maximum: 3 },
    labels: { type: 'array', items: { type: 'string', enum: ['profanity', 'insult', 'slur', 'threat', 'spam', 'ads', 'scam_link', 'personal_data', 'off_topic', 'fake'] } },
    reason: { type: 'string' },
  },
};
const SYSTEM = `You moderate user reviews of venues and events in Cyprus (English, Greek, Russian).
Judge CONTEXT: occasional rude words describing an experience are acceptable; insults or harassment aimed at people,
threats, hate speech, ads/spam, scam links, personal data of others, and clearly fake or off-topic reviews are not.
severity: 0 fine, 1 mild, 2 needs a human, 3 clearly unacceptable. decision: publish | pending (human review) | reject.`;

export class Moderator {
  private client: Anthropic | null;
  constructor(private config: AppConfig, private log: Logger, client?: Anthropic | null) {
    this.client = client !== undefined ? client : config.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, maxRetries: 0 }) : null;
  }

  async moderate(text: string, extra: Label[] = []): Promise<Moderation> {
    const r = ruleCheck(text);
    const labels = [...new Set([...r.labels, ...extra])];
    let ai: { decision: 'publish' | 'pending' | 'reject'; severity: number; labels: string[]; reason: string } | null = null;
    if (this.client && text.trim().length >= 3) {
      try {
        const res = await this.client.beta.messages.create({
          model: this.config.ANTHROPIC_MODEL, max_tokens: 300, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
          output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } }, system: SYSTEM,
          messages: [{ role: 'user', content: `Review:\n${r.masked.slice(0, 2000)}` }],
        }, { timeout: 5000, maxRetries: 0 });
        const block = res.content.find((b) => b.type === 'text');
        if (res.stop_reason === 'end_turn' && block?.type === 'text') ai = JSON.parse(block.text);
      } catch (e) {
        this.log.warn({ err: (e as Error).message }, 'ai moderation failed; rules only');
      }
    }
    const reasons = [...r.reasons, ...(ai?.reason ? [ai.reason] : [])];
    return { decision: decide(labels, ai), labels, reasons, engine: ai ? 'ai' : 'rules', text: r.masked };
  }
}
