import { normalizeText } from './text';

/**
 * Display-name rules, shared by the app (instant feedback) and the API (the real check).
 *  - 3–40 characters after trimming and collapsing spaces; letters of any alphabet, spaces, - ' . only
 *  - no links, e-mails, long digit runs or repeated characters (spam)
 *  - no insults or slurs (en / el / ru)
 *  - no names that impersonate staff or the service (admin, moderator, passtra, support… in three languages)
 */
export type NameError = 'too_short' | 'too_long' | 'invalid_chars' | 'spam' | 'offensive' | 'reserved';

const OFFENSIVE = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'whore', 'nigger', 'nigga', 'faggot', 'retard', 'хуй', 'хуе', 'пизд', 'бляд', 'блят', 'ебан', 'ебат', 'сука', 'пидор', 'пидар', 'мраз', 'γαμ', 'πουστ', 'μουν', 'πουτ', 'καριολ'].map((w) => normalizeText(w));
const RESERVED = ['admin', 'administrator', 'moderator', 'mod', 'passtra', 'support', 'official', 'staff', 'system', 'root', 'team', 'helpdesk', 'security',
  'админ', 'администратор', 'модератор', 'поддержка', 'официальн', 'διαχειριστ', 'συντονιστ', 'υποστηριξ', 'επισημ'].map((w) => normalizeText(w));

export function validateDisplayName(input: string): { ok: true; name: string } | { ok: false; error: NameError } {
  const name = input.normalize('NFC').replace(/\s+/g, ' ').trim();
  if ([...name].length < 3) return { ok: false, error: 'too_short' };
  if ([...name].length > 40) return { ok: false, error: 'too_long' };
  if (/https?:|www\.|@|\.(com|net|org|ru|io|me)\b/i.test(name) || /\d{4,}/.test(name) || /(.)\1{3,}/u.test(name)) return { ok: false, error: 'spam' };
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(name)) return { ok: false, error: 'invalid_chars' };
  if ((name.match(/\p{L}/gu) ?? []).length < 2) return { ok: false, error: 'too_short' };
  const norm = normalizeText(name);
  const tokens = norm.split(' ');
  const compact = norm.replace(/[\s.'’-]/g, '');
  if (OFFENSIVE.some((w) => tokens.some((t) => t.startsWith(w)) || compact.includes(w))) return { ok: false, error: 'offensive' };
  if (RESERVED.some((w) => tokens.some((t) => t === w || (w.length > 4 && t.startsWith(w))) || compact === w || compact.startsWith('passtra'))) return { ok: false, error: 'reserved' };
  return { ok: true, name };
}
