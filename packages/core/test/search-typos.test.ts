import { describe, expect, it } from 'vitest';
import { correctQuery, editDistance, parseQuery } from '../src/query-parser';
import { categoriesForOsmName } from '../src/categories';

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

describe('dishes search restaurants and takeaways by cuisine', () => {
  it.each(['pizza', 'πίτσα', 'пицца', 'pizzeria in Limassol'])('%s', (q) => {
    const f = parseQuery(q);
    expect(f.categories.sort()).toEqual(['fast-food', 'restaurant']);
    expect(f.keywords).toEqual(['pizza']);
  });
  it('sushi and burger', () => {
    expect(parseQuery('суши').keywords).toEqual(['sushi']);
    expect(parseQuery('best burger').keywords).toEqual(['burger']);
  });
  it('plain fast food stays a category only', () => {
    expect(parseQuery('fast food').categories).toEqual(['fast-food']);
    expect(parseQuery('fast food').keywords).toEqual([]);
  });
});

describe('activities', () => {
  it.each([
    ['boat trip', 'boat-trip'], ['катание на лодке', 'boat-trip'], ['прогулка на яхте', 'boat-trip'], ['морская прогулка', 'boat-trip'],
    ['βαρκάδα', 'boat-trip'], ['рыбалка', 'boat-trip'], ['sunset cruise', 'boat-trip'],
    ['jet ski', 'surfing'], ['гидроцикл', 'surfing'], ['kayak', 'surfing'], ['parasailing', 'surfing'],
    ['jeep safari', 'tours'], ['квадроциклы', 'tours'], ['экскурсия', 'tours'], ['εκδρομή', 'tours'],
    ['snorkeling', 'diving'],
  ])('%s → %s', (q, slug) => {
    expect(parseQuery(q).categories).toContain(slug);
  });
  it('a walk is not a hike unless it says so', () => {
    expect(parseQuery('прогулка на яхте').categories).not.toContain('hiking');
    expect(parseQuery('пешая прогулка').categories).toContain('hiking');
  });
  it('tourist does not mean tours', () => {
    expect(parseQuery('tourist attractions').categories).not.toContain('tours');
  });
});

describe('activities recognised by name on the map', () => {
  it.each([
    [{ tourism: 'attraction', name: 'Blue Lagoon Cruise' }, 'boat-trip'],
    [{ shop: 'travel_agency', name: 'Jeep Safari Troodos' }, 'tours'],
    [{ leisure: 'sports_centre', name: 'Coral Bay Water Sports' }, 'surfing'],
    [{ shop: 'sports', name: 'Paphos Dive Centre' }, 'diving'],
  ])('%o → %s', (tags, slug) => {
    expect(categoriesForOsmName(tags).map((c) => c.slug)).toContain(slug);
  });
  it('streets and buildings are not activities', () => {
    expect(categoriesForOsmName({ highway: 'residential', name: 'Cruise Street' })).toEqual([]);
    expect(categoriesForOsmName({ building: 'yes', name: 'Safari House' })).toEqual([]);
  });
});
