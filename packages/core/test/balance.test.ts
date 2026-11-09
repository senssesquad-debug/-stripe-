import { describe, expect, it } from 'vitest';
import { ACTIVITY_IDEAS, balance, bucketOf } from '../src/activities';
import { CATEGORIES, getCategory } from '../src/categories';
import type { Candidate, Scored } from '../src/ranking';

const item = (id: string, cat: string, score: number): Scored<Candidate> => ({ item: { id, type: 'place', categories: [cat] }, score, reasons: [] });

describe('balanced feed', () => {
  // A typical Cyprus town: food everywhere, fewer of everything else — and the food places score higher (open now, close).
  const pool = [
    ...Array.from({ length: 60 }, (_, i) => item(`food${i}`, i % 2 ? 'restaurant' : 'cafe', 0.9 - i * 0.001)),
    ...Array.from({ length: 8 }, (_, i) => item(`kart${i}`, i % 2 ? 'karting' : 'escape-room', 0.5 - i * 0.01)),
    ...Array.from({ length: 8 }, (_, i) => item(`nat${i}`, i % 2 ? 'beach' : 'hiking', 0.45 - i * 0.01)),
    ...Array.from({ length: 6 }, (_, i) => item(`ent${i}`, 'bowling', 0.4 - i * 0.01)),
    ...Array.from({ length: 6 }, (_, i) => item(`sport${i}`, 'racket-sports', 0.35 - i * 0.01)),
    ...Array.from({ length: 6 }, (_, i) => item(`cult${i}`, 'museum', 0.3 - i * 0.01)),
    ...Array.from({ length: 6 }, (_, i) => item(`night${i}`, 'bar', 0.3 - i * 0.01)),
  ];

  it('food is a minority of the first 20 even when it scores highest', () => {
    const out = balance(pool, 20);
    const food = out.filter((s) => bucketOf(s.item.categories[0]) === 'food').length;
    expect(food).toBeLessThanOrEqual(4);
    expect(food).toBeGreaterThanOrEqual(2);
  });

  it('never three of the same kind in a row, never two food places in a row', () => {
    const out = balance(pool, 30).map((s) => bucketOf(s.item.categories[0]));
    for (let i = 2; i < out.length; i++) expect(out[i] === out[i - 1] && out[i] === out[i - 2]).toBe(false);
    for (let i = 1; i < out.length; i++) expect(out[i] === 'food' && out[i - 1] === 'food').toBe(false);
  });

  it('interests raise a bucket’s share', () => {
    const base = balance(pool, 20).filter((s) => bucketOf(s.item.categories[0]) === 'nature').length;
    const nature = balance(pool, 20, ['nature']).filter((s) => bucketOf(s.item.categories[0]) === 'nature').length;
    expect(nature).toBeGreaterThan(base);
  });

  it('when only food exists nearby, food is shown (no empty feed)', () => {
    const onlyFood = pool.slice(0, 10);
    expect(balance(onlyFood, 8)).toHaveLength(8);
  });

  it('within a bucket the best item comes first', () => {
    const out = balance(pool, 20).filter((s) => bucketOf(s.item.categories[0]) === 'food');
    expect(out[0]!.item.id).toBe('food0');
  });
});

describe('activity ideas', () => {
  it('every idea points at existing categories', () => {
    for (const a of ACTIVITY_IDEAS) for (const c of a.categories) expect(getCategory(c), `${a.key}: ${c}`).toBeTruthy();
  });
  it('covers adventure, water, sports, nature, entertainment, social, shopping and family', () => {
    const buckets = new Set(ACTIVITY_IDEAS.flatMap((a) => a.categories.map((c) => bucketOf(c))));
    for (const b of ['active', 'nature', 'sports', 'entertainment', 'events_nightlife', 'shopping', 'culture']) expect(buckets).toContain(b);
    expect(ACTIVITY_IDEAS.length).toBeGreaterThanOrEqual(35);
  });
  it('no idea is about eating out', () => {
    for (const a of ACTIVITY_IDEAS) for (const c of a.categories) expect(['restaurant', 'cafe', 'fast-food', 'bakery']).not.toContain(c);
    expect(CATEGORIES.length).toBeGreaterThan(110);
  });
});
