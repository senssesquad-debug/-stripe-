import { describe, expect, it } from 'vitest';
import { canonicalKey, cleanTitle, decodeHtmlEntities, excerpt, htmlToText, nameSimilarity, normalizeText, searchDocument, stripTrailingDate } from '../src/text';

describe('HTML cleanup (real visitcyprus.com titles)', () => {
  it('decodes numeric and named entities', () => {
    expect(decodeHtmlEntities('Regatta of Champions – The R.O.C. (Optimist &#038; ILCA4) &#8211; 8-15.11')).toBe('Regatta of Champions – The R.O.C. (Optimist & ILCA4) – 8-15.11');
    expect(decodeHtmlEntities('Lady&#8217;s Mile Beach')).toBe('Lady’s Mile Beach');
    expect(decodeHtmlEntities('a &amp; b &euro;5 &#x2013; &unknown;')).toBe('a & b €5 – &unknown;');
  });
  it('turns HTML into readable text', () => {
    expect(htmlToText('<p>Hello<br>world</p><script>x()</script><p>&nbsp;Bye</p>')).toBe('Hello\nworld\nBye');
  });
  it('cleans titles', () => {
    expect(cleanTitle('  <b>CYPRUS SYMPHONY</b>   ORCHESTRA &#8211; STARLIGHT 2 ')).toBe('CYPRUS SYMPHONY ORCHESTRA – STARLIGHT 2');
  });
  it('strips trailing date ranges that duplicate structured dates', () => {
    expect(stripTrailingDate('Lefkara Classic 2026 – 12-15.11.2026')).toBe('Lefkara Classic 2026');
    expect(stripTrailingDate('Radisson Blu Larnaka International Marathon – 15.11.2026')).toBe('Radisson Blu Larnaka International Marathon');
    expect(stripTrailingDate('Cyprus Youth Symphony Orchestra LA TRAVIATA – 9-10 Dec')).toBe('Cyprus Youth Symphony Orchestra LA TRAVIATA');
    expect(stripTrailingDate('Kambos Mountain Race – 17.1.2027')).toBe('Kambos Mountain Race');
    expect(stripTrailingDate('Concert No. 5')).toBe('Concert No. 5');
  });
  it('excerpts at word boundaries', () => {
    const s = 'word '.repeat(200);
    const e = excerpt(s, 100);
    expect(e.length).toBeLessThanOrEqual(101);
    expect(e.endsWith('…')).toBe(true);
  });
});

describe('normalisation & cross-script keys', () => {
  it('removes accents and Greek tonos, unifies final sigma', () => {
    expect(normalizeText('Λεμεσός')).toBe('λεμεσοσ');
    expect(normalizeText('Café   Ëlite!')).toBe('cafe elite');
    expect(normalizeText('Ёлка')).toBe('елка');
  });
  it('maps Greek, Cyrillic and Latin spellings of the same city to one key', () => {
    expect(canonicalKey('Λεμεσός')).toBe(canonicalKey('Lemesos'));
    expect(canonicalKey('Πάφος')).toBe(canonicalKey('Paphos'));
    expect(canonicalKey('Лимассол')).toBe(canonicalKey('Limassol'));
    expect(canonicalKey('Λάρνακα')).toBe(canonicalKey('Larnaca'));
    expect(canonicalKey('Никосия')).toBe(canonicalKey('Nicosia'));
    expect(canonicalKey('Χρυσοχούς')).toBe(canonicalKey('Chrysochous'));
  });
  it('builds search documents containing both scripts', () => {
    const d = searchDocument('Δημοτικό Θέατρο Λεμεσού');
    expect(d).toContain('θεατρο');
    expect(d).toContain('theatro');
  });
});

describe('name similarity', () => {
  it('scores identical names across scripts as 1', () => {
    expect(nameSimilarity('Πάφος', 'Paphos')).toBe(1);
  });
  it('handles a title contained in a longer title', () => {
    expect(nameSimilarity('Cyprus Symphony Orchestra Starlight 2', 'CYPRUS SYMPHONY ORCHESTRA – STARLIGHT 2 – Works by Mozart')).toBeGreaterThan(0.85);
  });
  it('keeps unrelated names apart', () => {
    expect(nameSimilarity('Kambos Mountain Race', 'Larnaka International Marathon')).toBeLessThan(0.3);
  });
});
