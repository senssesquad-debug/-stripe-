import { describe, expect, it } from 'vitest';
import { CATEGORIES, categoriesForOsmName, categoriesForOsmTags, getCategory, outOfSeason, VIBES } from '../src/categories';

const slugs = (t: Record<string, string>) => [...categoriesForOsmTags(t), ...categoriesForOsmName(t)].map((c) => c.slug);

describe('activity categories from OpenStreetMap tags', () => {
  it.each([
    [{ sport: 'paintball', name: 'X' }, 'paintball'], [{ sport: 'climbing', name: 'Climb Cyprus' }, 'climbing'], [{ aerialway: 'zip_line' }, 'zipline'],
    [{ leisure: 'horse_riding', name: 'Stables' }, 'horse-riding'], [{ sport: 'free_flying', name: 'Paragliding Cyprus' }, 'air-sports'],
    [{ leisure: 'swimming_pool', name: 'Municipal Pool' }, 'swimming-pool'], [{ sport: 'padel', leisure: 'pitch', name: 'Padel Club' }, 'racket-sports'],
    [{ sport: 'basketball', leisure: 'pitch', name: 'Court' }, 'sports-courts'], [{ sport: 'skateboard', leisure: 'pitch' }, 'skatepark'],
    [{ boundary: 'national_park', name: 'Troodos National Forest Park' }, 'nature-reserve'], [{ waterway: 'waterfall', name: 'Caledonia Waterfall' }, 'waterfall'],
    [{ natural: 'cave_entrance', name: 'Cave' }, 'cave'], [{ leisure: 'bird_hide' }, 'birdwatching'], [{ tourism: 'picnic_site', name: 'Picnic' }, 'picnic'],
    [{ leisure: 'amusement_arcade', name: 'Arcade' }, 'arcade'], [{ amenity: 'theatre', name: 'Rialto' }, 'performing-arts'], [{ shop: 'second_hand', name: 'Thrift' }, 'second-hand'],
    [{ amenity: 'planetarium', name: 'Planetarium' }, 'science-centre'], [{ amenity: 'cafe', name: 'Meeple Board Game Cafe' }, 'board-games'],
    [{ leisure: 'sports_centre', name: 'Kids World Play Centre' }, 'kids-play'], [{ tourism: 'attraction', name: 'Adventure Park Platres' }, 'zipline'],
    [{ leisure: 'sports_centre', name: 'Laser Tag Arena' }, 'laser-tag'], [{ tourism: 'attraction', name: 'Limassol Karting' }, 'karting'],
  ])('%o → %s', (tags, slug) => {
    expect(slugs(tags as Record<string, string>)).toContain(slug);
  });
});

describe('every outing category has a feed bucket; activities have vibes', () => {
  it('buckets', () => {
    for (const c of CATEGORIES.filter((x) => x.group !== 'practical')) expect(c.bucket, c.slug).toBeTruthy();
  });
  it('vibes are known values', () => {
    for (const c of CATEGORIES) for (const v of c.vibes ?? []) expect(VIBES).toContain(v);
    expect(getCategory('paintball')!.vibes).toContain('extreme');
    expect(getCategory('board-games')!.vibes).toContain('social');
  });
  it('food is only one bucket among eight', () => {
    const buckets = new Set(CATEGORIES.map((c) => c.bucket).filter(Boolean));
    expect(buckets.size).toBe(8);
  });
});

describe('seasons', () => {
  it('water parks are usually closed in winter, open in summer; diving is all year', () => {
    expect(outOfSeason('water-park', 1)).toBe(true);
    expect(outOfSeason('water-park', 7)).toBe(false);
    expect(outOfSeason('diving', 1)).toBe(false);
  });
});
