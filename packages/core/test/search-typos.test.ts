import { describe, expect, it } from 'vitest';
import { correctQuery, editDistance, parseQuery } from '../src/query-parser';

const cats = (q: string) => parseQuery(q).categories;

describe('search understanding — categories in en / el / ru', () => {
  it.each([
    ['Restaurants', 'restaurant'], ['рестораны', 'restaurant'], ['εστιατόρια', 'restaurant'],
    ['Concerts', 'concert'], ['концерты', 'concert'], ['συναυλίες', 'concert'],
    ['Nightclubs', 'nightclub'], ['ночные клубы', 'nightclub'],
    ['Supermarkets', 'supermarket'], ['супермаркет', 'supermarket'], ['σούπερ μάρκετ', 'supermarket'],
    ['Beaches', 'beach'], ['пляжи', 'beach'], ['παραλίες', 'beach'],
    ['Hiking', 'hiking'], ['πεζοπορία', 'hiking'],
    ['Live music', 'concert'], ['where to eat', 'restaurant'], ['coffee', 'cafe'], ['кофейня', 'cafe'],
  ])('%s → %s', (q, slug) => expect(cats(q)).toContain(slug));

  it('times, cities and event intent', () => {
    expect(parseQuery('Events tonight')).toMatchObject({ time: 'tonight', entityTypes: ['event'] });
    expect(parseQuery('What can I do today?').time).toBe('today');
    expect(parseQuery('συναυλίες απόψε')).toMatchObject({ time: 'tonight', categories: ['concert'] });
    expect(parseQuery('концерты сегодня')).toMatchObject({ time: 'today', categories: ['concert'] });
    expect(parseQuery('museums in Nicosia')).toMatchObject({ city: 'nicosia', categories: ['museum'] });
    expect(parseQuery('Λεμεσό εστιατόρια').city).toBe('limassol');
  });

  it('generic words are never required keywords (they used to empty the results)', () => {
    expect(parseQuery('Family activities')).toMatchObject({ groups: ['family'], keywords: [] });
    expect(parseQuery('идеи для детей').keywords).toEqual([]);
    expect(parseQuery('δραστηριότητες για παιδιά').keywords).toEqual([]);
  });
});

describe('typo correction', () => {
  it('edit distance counts a transposition as one edit', () => {
    expect(editDistance('concret', 'concert')).toBe(1);
    expect(editDistance('abc', 'abc')).toBe(0);
  });
  it.each([
    ['resturants', 'restaurant'], ['concrets', 'concert'], ['nightclbs', 'nightclub'], ['hikng', 'hiking'], ['muzeum', 'museum'],
    ['рестараны', 'restaurant'], ['супермаркты', 'supermarket'], ['ночные клупы', 'nightclub'],
  ])('%s is understood as %s', (q, slug) => {
    const c = correctQuery(q);
    expect(c).not.toBeNull();
    expect(parseQuery(c!).categories).toContain(slug);
  });
  it('corrects misspelt city names', () => {
    expect(parseQuery(correctQuery('Limasol restaurants') ?? 'Limasol restaurants').city).toBe('limassol');
  });
  it('leaves correct queries alone', () => {
    expect(correctQuery('restaurants')).toBeNull();
    expect(correctQuery('пляжи')).toBeNull();
  });
});
