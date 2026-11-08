import type { LocalizedText } from './locales';

/**
 * Countries and cities are data, not code paths. Launching a new country means adding
 * entries here (they are synced into the database) plus data sources for it.
 */
export interface CountryDef {
  code: string; // ISO 3166-1 alpha-2
  name: LocalizedText;
  timezone: string; // IANA
  currency: string; // ISO 4217
  defaultLocale: string;
  /** Rough bounding box [minLng, minLat, maxLng, maxLat] used to sanity-check coordinates. */
  bbox: [number, number, number, number];
  enabled: boolean;
}

export interface CityDef {
  slug: string;
  country: string;
  name: LocalizedText;
  /** Alternative spellings and inflected forms, used for query parsing and venue/city matching. */
  aliases: string[];
  lat: number;
  lng: number;
  radiusKm: number;
  timezone: string;
  featured: boolean;
}

export const COUNTRIES: CountryDef[] = [
  {
    code: 'CY',
    name: { en: 'Cyprus', el: 'Κύπρος', ru: 'Кипр' },
    timezone: 'Europe/Nicosia',
    currency: 'EUR',
    defaultLocale: 'en',
    bbox: [32.2, 34.5, 34.65, 35.75],
    enabled: true,
  },
];

const CY = 'Europe/Nicosia';

/**
 * City centres are approximate reference points (verified against OpenStreetMap Nominatim,
 * see docs/01-research.md). Radius is the "city" search radius used by Explore the City.
 */
export const CITIES: CityDef[] = [
  { slug: 'limassol', country: 'CY', name: { en: 'Limassol', el: 'Λεμεσός', ru: 'Лимассол' }, aliases: ['lemesos', 'limasol', 'λεμεσο', 'лимасол', 'лимассоле', 'лимассола'], lat: 34.6786, lng: 33.0413, radiusKm: 12, timezone: CY, featured: true },
  { slug: 'nicosia', country: 'CY', name: { en: 'Nicosia', el: 'Λευκωσία', ru: 'Никосия' }, aliases: ['lefkosia', 'lefkosa', 'никосии', 'никосию'], lat: 35.1856, lng: 33.3823, radiusKm: 12, timezone: CY, featured: true },
  { slug: 'larnaca', country: 'CY', name: { en: 'Larnaca', el: 'Λάρνακα', ru: 'Ларнака' }, aliases: ['larnaka', 'ларнаке', 'ларнаку', 'ларнаки'], lat: 34.9229, lng: 33.6233, radiusKm: 10, timezone: CY, featured: true },
  { slug: 'paphos', country: 'CY', name: { en: 'Paphos', el: 'Πάφος', ru: 'Пафос' }, aliases: ['pafos', 'πάφο', 'пафосе', 'пафоса'], lat: 34.7754, lng: 32.4245, radiusKm: 10, timezone: CY, featured: true },
  { slug: 'ayia-napa', country: 'CY', name: { en: 'Ayia Napa', el: 'Αγία Νάπα', ru: 'Айя-Напа' }, aliases: ['agia napa', 'aya napa', 'айя напа', 'айя-напе', 'айя напе', 'айянапа'], lat: 34.9823, lng: 33.9999, radiusKm: 6, timezone: CY, featured: true },
  { slug: 'protaras', country: 'CY', name: { en: 'Protaras', el: 'Πρωταράς', ru: 'Протарас' }, aliases: ['πρωταρα', 'протарасе'], lat: 35.0125, lng: 34.0583, radiusKm: 5, timezone: CY, featured: true },
  { slug: 'paralimni', country: 'CY', name: { en: 'Paralimni', el: 'Παραλίμνι', ru: 'Паралимни' }, aliases: [], lat: 35.0379, lng: 33.9822, radiusKm: 5, timezone: CY, featured: false },
  { slug: 'famagusta', country: 'CY', name: { en: 'Famagusta', el: 'Αμμόχωστος', ru: 'Фамагуста' }, aliases: ['ammochostos', 'gazimagusa', 'magusa', 'фамагусте'], lat: 35.1174, lng: 33.9419, radiusKm: 7, timezone: 'Asia/Famagusta', featured: true },
  { slug: 'kyrenia', country: 'CY', name: { en: 'Kyrenia', el: 'Κερύνεια', ru: 'Кирения' }, aliases: ['girne', 'keryneia', 'кирении'], lat: 35.3364, lng: 33.3173, radiusKm: 7, timezone: 'Asia/Famagusta', featured: false },
  { slug: 'polis', country: 'CY', name: { en: 'Polis Chrysochous', el: 'Πόλη Χρυσοχούς', ru: 'Полис' }, aliases: ['polis', 'πολη', 'полисе'], lat: 35.036, lng: 32.426, radiusKm: 5, timezone: CY, featured: true },
  { slug: 'latchi', country: 'CY', name: { en: 'Latchi', el: 'Λατσί', ru: 'Лачи' }, aliases: ['latsi', 'лаччи'], lat: 35.0397, lng: 32.3964, radiusKm: 3, timezone: CY, featured: false },
  { slug: 'troodos', country: 'CY', name: { en: 'Troodos', el: 'Τρόοδος', ru: 'Троодос' }, aliases: ['τροοδο', 'троодосе'], lat: 34.9214, lng: 32.8636, radiusKm: 12, timezone: CY, featured: true },
  { slug: 'platres', country: 'CY', name: { en: 'Platres', el: 'Πλάτρες', ru: 'Платрес' }, aliases: ['pano platres'], lat: 34.8897, lng: 32.8633, radiusKm: 4, timezone: CY, featured: false },
  { slug: 'kakopetria', country: 'CY', name: { en: 'Kakopetria', el: 'Κακοπετριά', ru: 'Какопетрия' }, aliases: [], lat: 34.9881, lng: 32.9028, radiusKm: 4, timezone: CY, featured: false },
  { slug: 'omodos', country: 'CY', name: { en: 'Omodos', el: 'Όμοδος', ru: 'Омодос' }, aliases: [], lat: 34.8486, lng: 32.8086, radiusKm: 3, timezone: CY, featured: false },
  { slug: 'lefkara', country: 'CY', name: { en: 'Lefkara', el: 'Λεύκαρα', ru: 'Лефкара' }, aliases: ['pano lefkara', 'pano lefkara square'], lat: 34.8667, lng: 33.3, radiusKm: 3, timezone: CY, featured: false },
  { slug: 'pissouri', country: 'CY', name: { en: 'Pissouri', el: 'Πισσούρι', ru: 'Писсури' }, aliases: ['pissouri bay'], lat: 34.668, lng: 32.701, radiusKm: 4, timezone: CY, featured: false },
  { slug: 'peyia', country: 'CY', name: { en: 'Peyia', el: 'Πέγεια', ru: 'Пейя' }, aliases: ['pegeia', 'coral bay'], lat: 34.8833, lng: 32.3833, radiusKm: 5, timezone: CY, featured: false },
  { slug: 'strovolos', country: 'CY', name: { en: 'Strovolos', el: 'Στρόβολος', ru: 'Строволос' }, aliases: [], lat: 35.1428, lng: 33.3407, radiusKm: 4, timezone: CY, featured: false },
  { slug: 'geroskipou', country: 'CY', name: { en: 'Geroskipou', el: 'Γεροσκήπου', ru: 'Героскипу' }, aliases: ['yeroskipou'], lat: 34.7581, lng: 32.4544, radiusKm: 3, timezone: CY, featured: false },
];

export function cityBySlug(slug: string): CityDef | undefined {
  return CITIES.find((c) => c.slug === slug);
}

export function countryByCode(code: string): CountryDef | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function isInsideBbox(country: CountryDef, lat: number, lng: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = country.bbox;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}
