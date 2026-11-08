import { normalizeText } from './text';

export interface ParsedPrice {
  isFree: boolean | null; // null = unknown
  min: number | null;
  max: number | null;
  currency: string | null;
  /** True when the text was fully understood; otherwise only `text` should be shown. */
  confident: boolean;
  text: string;
}

const FREE_PATTERNS = [
  /^(free|free entry|free entrance|free admission|admission free|entry free|no charge|gratis)$/,
  /^(δωρεαν|δωρεαν εισοδοσ|ελευθερη εισοδοσ|εισοδοσ ελευθερη|εισοδοσ δωρεαν)$/,
  /^(бесплатно|бесплатный вход|вход бесплатный|вход свободный|свободный вход)$/,
];
const FREE_WORD = /(?:^|\s)(free|δωρεαν|ελευθερη|бесплатн|свободн)/;
const UNKNOWN = /(?:^|\s)(tba|tbc|to be announced|donations?|by donation|varies|various|εθελοντικη|προσφορα|пожертвован\S*)(?:\s|$)/;
const CURRENCY_SYMBOLS: Record<string, string> = { '€': 'EUR', '£': 'GBP', '$': 'USD', '₽': 'RUB' };

function detectCurrency(raw: string, fallback: string): string {
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) if (raw.includes(sym)) return code;
  const m = raw.match(/\b(EUR|GBP|USD|euro|euros|ευρω|евро)\b/i);
  if (m) {
    const t = m[1]!.toLowerCase();
    if (t.startsWith('gbp')) return 'GBP';
    if (t.startsWith('usd')) return 'USD';
    return 'EUR';
  }
  return fallback;
}

function toNumber(s: string): number | null {
  // "1.200,50" / "1,200.50" / "12,50" / "12.50"
  let t = s.trim();
  if (/^\d{1,3}([.,]\d{3})+([.,]\d{1,2})?$/.test(t)) {
    const decimalSep = t.length - Math.max(t.lastIndexOf('.'), t.lastIndexOf(',')) === 3 ? t[Math.max(t.lastIndexOf('.'), t.lastIndexOf(','))] : null;
    if (decimalSep) {
      const thousands = decimalSep === ',' ? '.' : ',';
      t = t.split(thousands).join('').replace(decimalSep, '.');
    } else {
      t = t.replace(/[.,]/g, '');
    }
  } else {
    t = t.replace(',', '.');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse free-text ticket prices ("FREE", "€20 – €70", "από €10", "от 15 €").
 * When unsure, returns confident=false so the UI shows the original text instead of a guessed number.
 */
export function parsePrice(raw: string | null | undefined, defaultCurrency = 'EUR'): ParsedPrice {
  const text = (raw ?? '').trim();
  const empty: ParsedPrice = { isFree: null, min: null, max: null, currency: null, confident: false, text };
  if (!text) return empty;
  const norm = normalizeText(text);
  if (FREE_PATTERNS.some((re) => re.test(norm))) {
    return { isFree: true, min: 0, max: 0, currency: null, confident: true, text };
  }
  if (UNKNOWN.test(norm)) return empty;

  const numbers = [...text.matchAll(/\d+(?:[.,]\d+)*/g)].map((m) => toNumber(m[0])).filter((n): n is number => n !== null);
  const hasFreeWord = FREE_WORD.test(norm);
  if (numbers.length === 0) return hasFreeWord ? { ...empty, isFree: null } : empty;
  // Years/dates inside price strings make numbers unreliable.
  if (numbers.some((n) => n >= 1900 && n <= 2100)) return empty;

  const currency = detectCurrency(text, defaultCurrency);
  if (numbers.every((n) => n === 0)) return { isFree: true, min: 0, max: 0, currency, confident: true, text };
  if (hasFreeWord) {
    // e.g. "Free for kids, €10 adults": not free overall, minimum unclear.
    return { isFree: false, min: null, max: Math.max(...numbers), currency, confident: false, text };
  }
  const from = /(?:^|\s)(from|starting|απο|от|ab)(?:\s|$)/.test(norm);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return {
    isFree: false,
    min,
    max: from && numbers.length === 1 ? null : max,
    currency,
    confident: numbers.length <= 3,
    text,
  };
}

export function formatPrice(p: { isFree: boolean | null; min: number | null; max: number | null; currency: string | null; text?: string | null }, locale: string): string | null {
  if (p.isFree === true) return locale === 'el' ? 'Δωρεάν' : locale === 'ru' ? 'Бесплатно' : 'Free';
  if (p.min === null && p.max === null) return p.text || null;
  const fmt = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: p.currency ?? 'EUR', maximumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n);
  if (p.min !== null && p.max !== null && p.max !== p.min) return `${fmt(p.min)} – ${fmt(p.max)}`;
  if (p.min !== null && p.max === null) return `${locale === 'el' ? 'από' : locale === 'ru' ? 'от' : 'from'} ${fmt(p.min)}`;
  return fmt((p.min ?? p.max)!);
}
