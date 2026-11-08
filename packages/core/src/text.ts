const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', euro: '€', pound: '£',
  copy: '©', reg: '®', trade: '™', middot: '·', bull: '•', laquo: '«', raquo: '»', deg: '°',
};

/** Decode HTML entities (named + numeric). Unknown entities are left as-is. */
export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

/** Convert an HTML fragment into readable plain text. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(withBreaks)
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Clean a title coming from a feed: decode entities, collapse whitespace. */
export function cleanTitle(input: string): string {
  return decodeHtmlEntities(input).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** Shorten text at a word boundary. Descriptions are excerpts; the full text stays at the source. */
export function excerpt(text: string, maxLen = 600): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > maxLen * 0.6 ? lastSpace : maxLen).trimEnd()}…`;
}

/** Lowercase, strip accents (incl. Greek tonos), unify final sigma, replace punctuation by spaces. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKD')
    // Keep Cyrillic "й" (и + breve) — it is a distinct letter, not an accent.
    .replace(/\u0438\u0306/g, 'й')
    .replace(/\u0418\u0306/g, 'Й')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/ς/g, 'σ')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const GREEK_DIGRAPHS: Array<[RegExp, string]> = [
  [/ου/g, 'ou'], [/αι/g, 'ai'], [/ει/g, 'ei'], [/οι/g, 'oi'], [/αυ/g, 'av'], [/ευ/g, 'ev'],
  [/^μπ|(?<=\s)μπ/g, 'b'], [/μπ/g, 'mb'], [/^ντ|(?<=\s)ντ/g, 'd'], [/ντ/g, 'nd'], [/γκ/g, 'gk'], [/γγ/g, 'ng'], [/τσ/g, 'ts'], [/τζ/g, 'tz'],
];
const GREEK: Record<string, string> = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n',
  ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'yi', є: 'ye',
};

/** Transliterate normalised Greek/Cyrillic text to Latin. Input should already be `normalizeText`-ed. */
export function transliterate(normalized: string): string {
  let s = normalized;
  for (const [re, rep] of GREEK_DIGRAPHS) s = s.replace(re, rep);
  let out = '';
  for (const ch of s) out += GREEK[ch] ?? CYRILLIC[ch] ?? ch;
  return out;
}

/**
 * Canonical Latin key for fuzzy comparison across scripts and spelling variants:
 * "Λεμεσός" ≈ "Lemesos", "Πάφος" ≈ "Paphos", "Лимассол" ≈ "Limassol".
 */
export function canonicalKey(input: string): string {
  return transliterate(normalizeText(input))
    .replace(/ph/g, 'f')
    .replace(/kh/g, 'ch')
    .replace(/y/g, 'i')
    .replace(/w/g, 'v')
    .replace(/c(?!h)/g, 'k')
    .replace(/([a-z])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  // en
  'the', 'a', 'an', 'and', 'or', 'of', 'at', 'in', 'on', 'for', 'with', 'to', 'by', 'from', 'live', 'presents', 'feat', 'ft',
  // el (canonical latin)
  'kai', 'to', 'ta', 'tou', 'tis', 'ton', 'sto', 'sti', 'stin', 'stous', 'me', 'apo', 'gia', 'o', 'i', 'oi',
  // ru (canonical latin)
  'v', 'na', 'i', 's', 'so', 'dlia', 'ot', 'po',
]);

export function tokens(input: string): string[] {
  return canonicalKey(input).split(' ').filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (const word of s.split(' ')) {
    if (!word) continue;
    const padded = `  ${word} `;
    for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  }
  return out;
}

/** pg_trgm-compatible similarity on canonical keys (0..1). */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(canonicalKey(a));
  const tb = trigrams(canonicalKey(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/** Jaccard similarity of significant tokens (0..1). */
export function tokenJaccard(a: string, b: string): number {
  const sa = new Set(tokens(a));
  const sb = new Set(tokens(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

/** Share of the shorter title's tokens contained in the longer one (handles "X" vs "X – Limassol 2026"). */
export function tokenContainment(a: string, b: string): number {
  const sa = new Set(tokens(a));
  const sb = new Set(tokens(b));
  const [small, big] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
  if (small.size === 0) return 0;
  let inter = 0;
  for (const t of small) if (big.has(t)) inter++;
  return inter / small.size;
}

/** Combined name/title similarity used by deduplication. */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ka = canonicalKey(a);
  const kb = canonicalKey(b);
  if (ka === kb) return 1;
  const containment = tokenContainment(a, b);
  // Containment only counts when the smaller side has some substance (≥2 tokens).
  const smallCount = Math.min(tokens(a).length, tokens(b).length);
  const contScore = smallCount >= 2 ? containment * 0.95 : containment * 0.7;
  return Math.max(trigramSimilarity(a, b), tokenJaccard(a, b), contScore);
}

/** Build a search document: original + canonical Latin form, so "Λεμεσός" matches "lemesos". */
export function searchDocument(...parts: Array<string | null | undefined>): string {
  const text = parts.filter(Boolean).join(' ');
  const norm = normalizeText(text);
  const canon = canonicalKey(text);
  return norm === canon ? norm : `${norm} ${canon}`;
}

const DATE_SUFFIX = /\s*[–—-]\s*\d{1,2}(?:[./]\d{1,2})?(?:\s*[–-]\s*\d{1,2}(?:[./]\d{1,2})?)?[./]\d{1,2}(?:[./]\d{2,4})?\s*$/;
const DATE_SUFFIX_WORDY = /\s*[–—-]\s*\d{1,2}(?:\s*[–-]\s*\d{1,2})?\s+[A-Za-zΑ-Ωα-ωА-Яа-я]{3,}\.?(?:\s+\d{4})?\s*$/;

/**
 * Remove a trailing date range like " – 12-15.11.2026" or " – 9-10 Dec" from a title.
 * The dates are kept as structured fields; this only removes the duplicate text.
 */
export function stripTrailingDate(title: string): string {
  const stripped = title.replace(DATE_SUFFIX, '').replace(DATE_SUFFIX_WORDY, '').trim();
  return stripped.length >= 3 ? stripped : title;
}
