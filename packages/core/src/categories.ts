import type { Locale, LocalizedText } from './locales';

/**
 * Interest groups. The first 11 + "other" are the onboarding interests from the product brief;
 * "wellness" and "practical" exist for classification and are surfaced under "other".
 */
export const INTEREST_GROUPS = [
  'music', 'nightlife', 'food', 'shopping', 'sports', 'nature', 'culture', 'family',
  'adventure', 'technology', 'art', 'wellness', 'practical',
] as const;
export type InterestGroup = (typeof INTEREST_GROUPS)[number];

/** Interests offered on the onboarding screen. */
export const ONBOARDING_INTERESTS = [
  'music', 'nightlife', 'food', 'shopping', 'sports', 'nature', 'culture', 'family',
  'adventure', 'technology', 'art', 'other',
] as const;
export type OnboardingInterest = (typeof ONBOARDING_INTERESTS)[number];

export function interestToGroups(i: OnboardingInterest): InterestGroup[] {
  return i === 'other' ? ['wellness', 'practical'] : [i];
}

export const GROUP_LABELS: Record<InterestGroup | 'other', LocalizedText> = {
  music: { en: 'Music', el: 'Μουσική', ru: 'Музыка' },
  nightlife: { en: 'Nightlife', el: 'Νυχτερινή ζωή', ru: 'Ночная жизнь' },
  food: { en: 'Food & drink', el: 'Φαγητό & ποτό', ru: 'Еда и напитки' },
  shopping: { en: 'Shopping', el: 'Ψώνια', ru: 'Шопинг' },
  sports: { en: 'Sports', el: 'Αθλητισμός', ru: 'Спорт' },
  nature: { en: 'Nature', el: 'Φύση', ru: 'Природа' },
  culture: { en: 'Culture', el: 'Πολιτισμός', ru: 'Культура' },
  family: { en: 'Family', el: 'Οικογένεια', ru: 'Для семьи' },
  adventure: { en: 'Adventure', el: 'Περιπέτεια', ru: 'Приключения' },
  technology: { en: 'Technology', el: 'Τεχνολογία', ru: 'Технологии' },
  art: { en: 'Art', el: 'Τέχνη', ru: 'Искусство' },
  wellness: { en: 'Beauty & wellness', el: 'Ομορφιά & ευεξία', ru: 'Красота и здоровье' },
  practical: { en: 'Everyday services', el: 'Καθημερινές υπηρεσίες', ru: 'Полезное рядом' },
  other: { en: 'Other', el: 'Άλλο', ru: 'Другое' },
};

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

/** An OSM tag matcher: every key must match; `true` means "key present with any value". */
export type OsmMatcher = Record<string, string | true>;

export interface CategoryDef {
  slug: string;
  kind: 'event' | 'place' | 'both';
  group: InterestGroup;
  icon: string;
  label: LocalizedText;
  /** Normalised keyword stems per locale (lowercase, no accents). Multi-word = phrase of prefixes. */
  keywords: Partial<Record<Locale, string[]>>;
  osm?: OsmMatcher[];
  /** OSM elements additionally need one of these tags to be imported (filters noise). */
  osmRequireAny?: string[];
  google?: string[];
  ageMin?: number;
  dayParts?: DayPart[];
  /** Typical visit length in minutes, used by Plan My Day. */
  visitMinutes?: number;
  /** Typically free to visit (beaches, viewpoints, parks). Never used as a fact for a specific place. */
  usuallyFree?: boolean;
  outdoor?: boolean;
  /** What kind of outing it is, for "What can I do?" filters. */
  vibes?: Vibe[];
  /** Section of the balanced home feed this category counts towards. */
  bucket?: FeedBucket;
  /** Usually operates only in these months (1–12). Shown as "usually seasonal", never as a fact about a place. */
  seasonMonths?: [number, number];
}

export type Vibe = 'indoor' | 'outdoor' | 'extreme' | 'relaxing' | 'sports' | 'adventure' | 'social' | 'family';
export const VIBES: Vibe[] = ['indoor', 'outdoor', 'extreme', 'relaxing', 'sports', 'adventure', 'social', 'family'];
export type FeedBucket = 'food' | 'active' | 'entertainment' | 'events_nightlife' | 'nature' | 'sports' | 'shopping' | 'culture';

const c = (
  slug: string,
  kind: CategoryDef['kind'],
  group: InterestGroup,
  icon: string,
  label: [string, string, string],
  keywords: [string[], string[], string[]],
  extra: Partial<CategoryDef> = {},
): CategoryDef => ({
  slug,
  kind,
  group,
  icon,
  label: { en: label[0], el: label[1], ru: label[2] },
  keywords: { en: keywords[0], el: keywords[1], ru: keywords[2] },
  ...extra,
});

const EVENING: DayPart[] = ['evening', 'night'];
const DAYTIME: DayPart[] = ['morning', 'afternoon'];

export const CATEGORIES: CategoryDef[] = [
  // ── Events ────────────────────────────────────────────────────────────────
  c('concert', 'event', 'music', 'music', ['Concerts', 'Συναυλίες', 'Концерты'],
    [['concert', 'gig', 'live music', 'live band', 'recital'], ['συναυλ', 'ζωντανη μουσικη', 'ρεσιταλ'], ['концерт', 'жив музык', 'выступлен', 'сольник']],
    { dayParts: EVENING, visitMinutes: 120 }),
  c('music-festival', 'event', 'music', 'festival', ['Music festivals', 'Μουσικά φεστιβάλ', 'Музыкальные фестивали'],
    [['music festival', 'open air', 'openair'], ['μουσικο φεστιβαλ'], ['музыкальн фестивал', 'опен эйр', 'опенэйр']],
    { dayParts: ['afternoon', 'evening', 'night'], visitMinutes: 240 }),
  c('party', 'event', 'nightlife', 'party', ['Parties & club nights', 'Πάρτι & clubbing', 'Вечеринки и клубы'],
    [['party', 'parties', 'rave', 'club night', 'clubbing', 'dj set', 'dj'], ['παρτι', 'ρειβ', 'clubbing'], ['вечеринк', 'тусовк', 'тусич', 'рейв', 'диджей', 'пати']],
    { dayParts: ['night'], visitMinutes: 180, ageMin: 18 }),
  c('rock-metal', 'event', 'music', 'guitar', ['Rock, metal & hardcore', 'Ροκ, μέταλ & hardcore', 'Рок, метал, хардкор'],
    [['rock', 'metal', 'hardcore', 'punk', 'grunge'], ['ροκ', 'μεταλ', 'πανκ'], ['рок', 'метал', 'хардкор', 'панк']],
    { dayParts: EVENING, visitMinutes: 150 }),
  c('electronic', 'event', 'music', 'waveform', ['Electronic music', 'Ηλεκτρονική μουσική', 'Электронная музыка'],
    [['techno', 'house music', 'electronic', 'edm', 'trance', 'drum and bass', 'dnb'], ['ηλεκτρονικ', 'τεκνο'], ['техно', 'электрон', 'хаус', 'транс', 'драм']],
    { dayParts: ['night'], visitMinutes: 180 }),
  c('jazz-blues', 'event', 'music', 'sax', ['Jazz & blues', 'Τζαζ & μπλουζ', 'Джаз и блюз'],
    [['jazz', 'blues', 'soul', 'swing'], ['τζαζ', 'μπλουζ'], ['джаз', 'блюз', 'соул']],
    { dayParts: EVENING, visitMinutes: 120 }),
  c('classical', 'event', 'music', 'violin', ['Classical & opera', 'Κλασική μουσική & όπερα', 'Классика и опера'],
    [['classical', 'orchestra', 'symphony', 'opera', 'philharmonic', 'choir', 'chamber music'], ['κλασικ', 'ορχηστρ', 'συμφωνικ', 'οπερα', 'χορωδ'], ['классическ', 'оркестр', 'симфон', 'опер', 'хор', 'филармон']],
    { dayParts: EVENING, visitMinutes: 120 }),
  c('exhibition', 'event', 'art', 'frame', ['Exhibitions', 'Εκθέσεις', 'Выставки'],
    [['exhibition', 'expo', 'vernissage', 'art show'], ['εκθεσ', 'εγκαινια'], ['выставк', 'вернисаж', 'экспозиц']],
    { dayParts: DAYTIME, visitMinutes: 75 }),
  c('theatre', 'both', 'culture', 'masks', ['Theatre', 'Θέατρο', 'Театр'],
    [['theatre', 'theater', 'play', 'drama', 'musical'], ['θεατρ', 'παρασταση', 'μιουζικαλ'], ['театр', 'спектакл', 'мюзикл', 'постановк']],
    { dayParts: EVENING, visitMinutes: 150, osm: [{ amenity: 'theatre' }], google: ['performing_arts_theater'] }),
  c('dance', 'event', 'culture', 'dance', ['Dance & ballet', 'Χορός & μπαλέτο', 'Танец и балет'],
    [['ballet', 'dance show', 'dance performance', 'contemporary dance'], ['μπαλετο', 'χορευτικ', 'χορος'], ['балет', 'танц']],
    { dayParts: EVENING, visitMinutes: 120 }),
  c('comedy', 'event', 'culture', 'smile', ['Comedy & stand-up', 'Κωμωδία & stand-up', 'Комедия и стендап'],
    [['comedy', 'stand-up', 'standup', 'stand up', 'improv'], ['κωμωδ', 'σταντ απ'], ['стендап', 'стенд ап', 'комеди', 'импров']],
    { dayParts: EVENING, visitMinutes: 120 }),
  c('film-screening', 'event', 'culture', 'film', ['Film screenings', 'Προβολές ταινιών', 'Кинопоказы'],
    [['screening', 'film festival', 'open air cinema'], ['προβολη', 'φεστιβαλ κινηματογραφου', 'θερινος κινηματογραφος'], ['кинопоказ', 'показ фильм', 'кинофестивал']],
    { dayParts: EVENING, visitMinutes: 130 }),
  c('sports-event', 'event', 'sports', 'trophy', ['Sports events', 'Αθλητικές εκδηλώσεις', 'Спортивные события'],
    [['match', 'tournament', 'marathon', 'race', 'regatta', 'championship', 'cup final', 'football', 'basketball', 'tennis', 'triathlon'], ['αγων', 'τουρνουα', 'μαραθων', 'πρωταθλημα', 'ρεγκατα', 'ποδοσφαιρ', 'μπασκετ'], ['матч', 'турнир', 'марафон', 'забег', 'гонк', 'регат', 'чемпионат', 'футбол', 'баскетбол', 'теннис']],
    { visitMinutes: 150 }),
  c('motorsport', 'event', 'sports', 'car', ['Car & motor events', 'Εκδηλώσεις αυτοκινήτου', 'Автомобильные события'],
    [['car show', 'rally', 'motorsport', 'drift', 'car meet', 'motor show'], ['ραλι', 'εκθεση αυτοκινητου', 'ντριφτ'], ['ралли', 'автошоу', 'дрифт', 'автовыставк', 'мотоспорт']],
    { visitMinutes: 150 }),
  c('food-festival', 'event', 'food', 'wine', ['Food & wine festivals', 'Γιορτές φαγητού & κρασιού', 'Гастро- и винные фестивали'],
    [['food festival', 'wine festival', 'beer festival', 'street food', 'tasting'], ['γιορτη κρασιου', 'φεστιβαλ φαγητου', 'φεστιβαλ μπυρας', 'γευσιγνωσια'], ['фестиваль ед', 'винный фестивал', 'пивной фестивал', 'стрит фуд', 'дегустац']],
    { visitMinutes: 150 }),
  c('fair', 'event', 'shopping', 'tent', ['Fairs & markets', 'Παζάρια & αγορές', 'Ярмарки и базары'],
    [['fair', 'bazaar', 'flea market', 'christmas market', 'craft market'], ['παζαρ', 'εμποροπανηγυρ', 'χριστουγεννιατικη αγορα'], ['ярмарк', 'базар', 'блошин']],
    { dayParts: DAYTIME, visitMinutes: 90 }),
  c('festival', 'event', 'culture', 'sparkles', ['Festivals & celebrations', 'Φεστιβάλ & γιορτές', 'Фестивали и праздники'],
    [['festival', 'celebration', 'carnival', 'parade', 'fiesta', 'kataklysmos'], ['φεστιβαλ', 'πανηγυρ', 'καρναβαλ', 'παρελασ', 'κατακλυσμ'], ['фестивал', 'праздник', 'карнавал', 'парад']],
    { visitMinutes: 150 }),
  c('kids-event', 'event', 'family', 'balloon', ['For kids', 'Για παιδιά', 'Для детей'],
    [['kids show', 'kids event', 'children\'s theatre', 'puppet', 'toddler'], ['παιδικη παρασταση', 'παιδικο θεατρο', 'κουκλοθεατρ'], ['детск спектакл', 'детск праздник', 'кукольн', 'утренник']],
    { dayParts: DAYTIME, visitMinutes: 90 }),
  c('workshop', 'event', 'technology', 'wrench', ['Workshops & classes', 'Εργαστήρια & μαθήματα', 'Мастер-классы'],
    [['workshop', 'masterclass', 'class', 'course', 'lecture', 'talk'], ['εργαστηρ', 'σεμιναρ', 'διαλεξ', 'μαθημα'], ['мастер-класс', 'мастер класс', 'воркшоп', 'лекци', 'семинар', 'курс']],
    { visitMinutes: 120 }),
  c('tech-meetup', 'event', 'technology', 'chip', ['Tech & startups', 'Τεχνολογία & startups', 'Технологии и стартапы'],
    [['meetup', 'conference', 'hackathon', 'startup', 'summit', 'tech'], ['συνεδρι', 'χακαθον', 'νεοφυ'], ['митап', 'конференц', 'хакатон', 'стартап', 'саммит']],
    { visitMinutes: 180 }),
  c('community-event', 'event', 'culture', 'calendar', ['Other events', 'Άλλες εκδηλώσεις', 'Другие события'],
    [[], [], []], { visitMinutes: 120 }),
  c('wellness-event', 'event', 'wellness', 'lotus', ['Yoga & wellness', 'Γιόγκα & ευεξία', 'Йога и велнес'],
    [['yoga', 'retreat', 'meditation', 'breathwork', 'pilates'], ['γιογκα', 'διαλογισμ', 'πιλατες'], ['йог', 'ретрит', 'медитац', 'пилатес']],
    { visitMinutes: 90 }),

  // ── Food & drink ─────────────────────────────────────────────────────────
  c('restaurant', 'place', 'food', 'utensils', ['Restaurants', 'Εστιατόρια', 'Рестораны'],
    [['restaurant', 'dinner', 'lunch', 'eat', 'taverna', 'meze', 'seafood', 'fish restaurant'], ['εστιατορ', 'ταβερν', 'μεζε', 'ψαροταβερν', 'φαγητ'], ['ресторан', 'поесть', 'ужин', 'обед', 'таверн', 'мезе', 'рыбн ресторан']],
    { osm: [{ amenity: 'restaurant' }], google: ['restaurant'], visitMinutes: 75 }),
  c('cafe', 'place', 'food', 'coffee', ['Cafés', 'Καφετέριες', 'Кафе'],
    [['cafe', 'coffee', 'brunch', 'breakfast', 'espresso'], ['καφε', 'καφετερ', 'πρωινο', 'μπραντς'], ['кафе', 'кофе', 'кофейн', 'завтрак', 'бранч']],
    { osm: [{ amenity: 'cafe' }], google: ['cafe', 'coffee_shop'], visitMinutes: 45, dayParts: ['morning', 'afternoon'] }),
  c('bakery', 'place', 'food', 'croissant', ['Bakeries', 'Αρτοποιεία', 'Пекарни'],
    [['bakery', 'pastry', 'patisserie'], ['αρτοποι', 'φουρν', 'ζαχαροπλαστ'], ['пекарн', 'булочн', 'кондитерск', 'выпечк']],
    { osm: [{ shop: 'bakery' }, { shop: 'pastry' }], google: ['bakery'], visitMinutes: 20, dayParts: ['morning'] }),
  c('fast-food', 'place', 'food', 'burger', ['Street food & fast food', 'Γρήγορο φαγητό', 'Фастфуд и стритфуд'],
    [['fast food', 'burger', 'souvlaki', 'gyros', 'kebab', 'pizza', 'takeaway'], ['σουβλακ', 'γυρο', 'πιτσα', 'μπεργκερ', 'φαστ φουντ'], ['фастфуд', 'бургер', 'шаурм', 'сувлаки', 'гирос', 'пицц', 'кебаб']],
    { osm: [{ amenity: 'fast_food' }], google: ['fast_food_restaurant'], visitMinutes: 30 }),
  c('ice-cream', 'place', 'food', 'icecream', ['Ice cream', 'Παγωτό', 'Мороженое'],
    [['ice cream', 'gelato', 'frozen yogurt'], ['παγωτ'], ['морожен', 'джелато']],
    { osm: [{ amenity: 'ice_cream' }, { shop: 'ice_cream' }], google: ['ice_cream_shop'], visitMinutes: 20 }),
  c('winery', 'place', 'food', 'grapes', ['Wineries', 'Οινοποιεία', 'Винодельни'],
    [['winery', 'wine tasting', 'vineyard'], ['οινοποι', 'αμπελ'], ['виноделн', 'винодельн', 'винн дегустац', 'виноградник']],
    { osm: [{ craft: 'winery' }, { tourism: 'wine_cellar' }], google: ['winery'], visitMinutes: 75, dayParts: DAYTIME }),

  // ── Nightlife ────────────────────────────────────────────────────────────
  c('bar', 'place', 'nightlife', 'cocktail', ['Bars', 'Μπαρ', 'Бары'],
    [['bar', 'cocktail', 'drinks', 'rooftop', 'wine bar'], ['μπαρ', 'κοκτειλ', 'ποτο'], ['бар', 'коктейл', 'выпить', 'руфтоп']],
    { osm: [{ amenity: 'bar' }], google: ['bar', 'cocktail_bar', 'wine_bar'], visitMinutes: 90, dayParts: EVENING }),
  c('pub', 'place', 'nightlife', 'beer', ['Pubs', 'Παμπ', 'Пабы'],
    [['pub', 'beer', 'brewery', 'craft beer'], ['παμπ', 'μπυρ', 'ζυθοποι'], ['паб', 'пив', 'пивоварн']],
    { osm: [{ amenity: 'pub' }, { amenity: 'biergarten' }, { craft: 'brewery' }], google: ['pub', 'brewery'], visitMinutes: 90, dayParts: EVENING }),
  c('nightclub', 'place', 'nightlife', 'disco', ['Nightclubs', 'Νυχτερινά κέντρα', 'Ночные клубы'],
    [['nightclub', 'night club', 'club', 'disco'], ['κλαμπ', 'νυχτερινο κεντρ', 'ντισκο', 'μπουζουκ'], ['ночн клуб', 'клуб', 'дискотек']],
    { osm: [{ amenity: 'nightclub' }], google: ['night_club'], visitMinutes: 180, ageMin: 18, dayParts: ['night'] }),
  c('casino', 'place', 'nightlife', 'dice', ['Casinos', 'Καζίνο', 'Казино'],
    [['casino'], ['καζιν'], ['казино']],
    { osm: [{ amenity: 'casino' }], google: ['casino'], visitMinutes: 120, ageMin: 18, dayParts: EVENING }),
  c('billiards', 'place', 'nightlife', 'billiards', ['Billiards & snooker', 'Μπιλιάρδο', 'Бильярд'],
    [['billiards', 'pool hall', 'snooker'], ['μπιλιαρδ', 'σνουκερ'], ['бильярд', 'снукер']],
    { osm: [{ sport: 'billiards' }, { leisure: 'billiards' }], visitMinutes: 90, dayParts: EVENING }),
  c('live-music-venue', 'place', 'music', 'mic', ['Live music venues', 'Χώροι ζωντανής μουσικής', 'Концертные площадки'],
    [['music venue', 'concert hall', 'live music bar', 'jazz club'], ['μουσικη σκηνη', 'μουσικος χωρος', 'αιθουσα συναυλιων'], ['концертн площадк', 'концертн зал', 'джаз клуб']],
    { osm: [{ amenity: 'music_venue' }, { amenity: 'concert_hall' }], google: ['concert_hall'], visitMinutes: 150, dayParts: EVENING }),

  // ── Shopping ─────────────────────────────────────────────────────────────
  c('shopping-mall', 'place', 'shopping', 'bag', ['Shopping malls', 'Εμπορικά κέντρα', 'Торговые центры'],
    [['mall', 'shopping centre', 'shopping center'], ['εμπορικο κεντρ', 'mall'], ['торгов центр', 'тц', 'молл']],
    { osm: [{ shop: 'mall' }, { shop: 'department_store' }], google: ['shopping_mall', 'department_store'], visitMinutes: 90 }),
  c('supermarket', 'place', 'shopping', 'cart', ['Supermarkets', 'Σούπερ μάρκετ', 'Супермаркеты'],
    [['supermarket', 'grocery', 'groceries', 'convenience store', 'kiosk'], ['σουπερ μαρκετ', 'σουπερμαρκετ', 'περιπτερ', 'μπακαλ'], ['супермаркет', 'продукт', 'магазин у дома', 'киоск']],
    { osm: [{ shop: 'supermarket' }, { shop: 'convenience' }], google: ['supermarket', 'grocery_store', 'convenience_store'], visitMinutes: 30 }),
  c('farmers-market', 'both', 'shopping', 'basket', ['Farmers markets', 'Λαϊκές αγορές', 'Фермерские рынки'],
    [['farmers market', 'market', 'municipal market', 'local produce'], ['λαικη αγορα', 'δημοτικη αγορα', 'αγορα'], ['фермерск рын', 'рынок', 'рынк', 'базар']],
    { osm: [{ amenity: 'marketplace' }], google: ['farmers_market'], visitMinutes: 60, dayParts: ['morning'] }),
  c('clothing-store', 'place', 'shopping', 'shirt', ['Clothing & fashion', 'Ρούχα & μόδα', 'Одежда'],
    [['clothes', 'clothing', 'fashion', 'boutique', 'shoes'], ['ρουχ', 'μοδα', 'μπουτικ', 'παπουτσ'], ['одежд', 'бутик', 'обув', 'шмот']],
    { osm: [{ shop: 'clothes' }, { shop: 'shoes' }, { shop: 'boutique' }], google: ['clothing_store', 'shoe_store'], visitMinutes: 40 }),
  c('sports-store', 'place', 'shopping', 'sneaker', ['Sports shops', 'Αθλητικά είδη', 'Спортивные магазины'],
    [['sports shop', 'sports store', 'sporting goods', 'outdoor gear'], ['αθλητικα ειδη'], ['спортивн магазин', 'спорттовар']],
    { osm: [{ shop: 'sports' }, { shop: 'outdoor' }], google: ['sporting_goods_store'], visitMinutes: 40 }),
  c('bookstore', 'place', 'shopping', 'book', ['Bookshops', 'Βιβλιοπωλεία', 'Книжные'],
    [['bookstore', 'bookshop', 'books'], ['βιβλιοπωλ', 'βιβλι'], ['книжн', 'книг']],
    { osm: [{ shop: 'books' }], google: ['book_store'], visitMinutes: 40 }),
  c('electronics-store', 'place', 'technology', 'phone', ['Electronics', 'Ηλεκτρονικά', 'Электроника'],
    [['electronics', 'phone shop', 'computer store'], ['ηλεκτρονικα', 'κινητα'], ['электроник', 'техник', 'телефон']],
    { osm: [{ shop: 'electronics' }, { shop: 'mobile_phone' }, { shop: 'computer' }], google: ['electronics_store'], visitMinutes: 30 }),

  // ── Beauty, wellness & fitness ───────────────────────────────────────────
  c('beauty-salon', 'place', 'wellness', 'sparkle', ['Beauty salons', 'Ινστιτούτα ομορφιάς', 'Салоны красоты'],
    [['beauty salon', 'nails', 'manicure', 'beauty', 'lashes'], ['ινστιτουτο ομορφιας', 'νυχια', 'μανικιουρ', 'ομορφια'], ['салон красот', 'маникюр', 'ногт', 'ресниц', 'бьюти']],
    { osm: [{ shop: 'beauty' }, { shop: 'cosmetics' }], google: ['beauty_salon', 'nail_salon'], visitMinutes: 60 }),
  c('barbershop', 'place', 'wellness', 'scissors', ['Barbers & hairdressers', 'Κουρεία & κομμωτήρια', 'Барбершопы и парикмахерские'],
    [['barber', 'barbershop', 'haircut', 'hairdresser', 'hair salon'], ['κουρει', 'κομμωτ', 'κουρεμα'], ['барбершоп', 'барбер', 'парикмахер', 'стрижк']],
    { osm: [{ shop: 'hairdresser' }, { shop: 'barber' }], google: ['barber_shop', 'hair_salon'], visitMinutes: 45 }),
  c('spa', 'place', 'wellness', 'lotus', ['Spa & massage', 'Σπα & μασάζ', 'Спа и массаж'],
    [['spa', 'massage', 'sauna', 'hammam'], ['σπα', 'μασαζ', 'σαουν', 'χαμαμ'], ['спа', 'массаж', 'саун', 'хамам']],
    { osm: [{ leisure: 'sauna' }, { shop: 'massage' }, { amenity: 'spa' }], google: ['spa', 'massage'], visitMinutes: 90 }),
  c('gym', 'place', 'sports', 'dumbbell', ['Gyms & fitness', 'Γυμναστήρια', 'Фитнес-центры'],
    [['gym', 'fitness', 'workout'], ['γυμναστηρ', 'fitness'], ['спортзал', 'фитнес', 'тренажер', 'качалк']],
    { osm: [{ leisure: 'fitness_centre' }, { leisure: 'sports_centre' }], google: ['gym', 'fitness_center'], visitMinutes: 75 }),
  c('coworking', 'place', 'technology', 'laptop', ['Coworking', 'Coworking', 'Коворкинги'],
    [['coworking', 'co-working', 'workspace', 'work from'], ['coworking', 'χωρος εργασιας'], ['коворкинг', 'поработать']],
    { osm: [{ amenity: 'coworking_space' }, { office: 'coworking' }], google: ['coworking_space'], visitMinutes: 240, dayParts: DAYTIME }),

  // ── Activities & entertainment ───────────────────────────────────────────
  c('karting', 'place', 'adventure', 'flag', ['Karting', 'Καρτ', 'Картинг'],
    [['karting', 'go-kart', 'go kart', 'gokart', 'kart'], ['καρτ', 'γκο καρτ'], ['картинг', 'карт']],
    { osm: [{ sport: 'karting' }], visitMinutes: 60 }),
  c('bowling', 'place', 'family', 'bowling', ['Bowling', 'Μπόουλινγκ', 'Боулинг'],
    [['bowling'], ['μποουλινγκ', 'μπουλινγκ', 'bowling'], ['боулинг']],
    { osm: [{ leisure: 'bowling_alley' }, { sport: '10pin' }], google: ['bowling_alley'], visitMinutes: 90 }),
  c('water-park', 'place', 'family', 'water', ['Water parks', 'Υδάτινα πάρκα', 'Аквапарки'],
    [['water park', 'waterpark', 'aquapark', 'water slides'], ['υδατινο παρκο', 'water park'], ['аквапарк', 'водн горк']],
    { osm: [{ leisure: 'water_park' }], google: ['water_park'], visitMinutes: 240, outdoor: true, dayParts: DAYTIME }),
  c('amusement-park', 'place', 'family', 'ferris', ['Amusement parks', 'Λούνα παρκ', 'Парки развлечений'],
    [['amusement park', 'theme park', 'luna park', 'funfair'], ['λουνα παρκ', 'θεματικο παρκο'], ['парк развлечен', 'луна-парк', 'луна парк', 'аттракцион']],
    { osm: [{ tourism: 'theme_park' }], google: ['amusement_park'], visitMinutes: 180 }),
  c('escape-room', 'place', 'adventure', 'key', ['Escape rooms', 'Escape rooms', 'Квесты'],
    [['escape room', 'escape game', 'quest room'], ['escape room', 'δωματιο αποδρασ'], ['квест', 'эскейп']],
    { osm: [{ leisure: 'escape_game' }], visitMinutes: 75 }),
  c('vr-arcade', 'place', 'technology', 'vr', ['VR & arcades', 'VR & ηλεκτρονικά παιχνίδια', 'VR и игровые залы'],
    [['virtual reality', 'vr', 'arcade', 'gaming'], ['εικονικη πραγματικοτητα', 'vr', 'ηλεκτρονικα παιχνιδια'], ['vr', 'виар', 'виртуальн реальн', 'игров зал', 'компьютерн клуб']],
    { osm: [{ leisure: 'amusement_arcade' }], google: ['video_arcade'], visitMinutes: 75 }),
  c('cinema', 'place', 'culture', 'film', ['Cinemas', 'Κινηματογράφοι', 'Кинотеатры'],
    [['cinema', 'movie', 'movies', 'film'], ['σινεμ', 'κινηματογραφ', 'ταινι'], ['кино', 'кинотеатр', 'фильм']],
    { osm: [{ amenity: 'cinema' }], google: ['movie_theater'], visitMinutes: 140, dayParts: EVENING }),
  c('boat-trip', 'place', 'adventure', 'boat', ['Boat trips', 'Κρουαζιέρες & βάρκες', 'Морские прогулки'],
    [['boat trip', 'boat tour', 'boat ride', 'boat', 'cruise', 'yacht', 'catamaran', 'boat rental', 'glass bottom', 'pirate ship', 'sunset cruise'],
      ['κρουαζιερ', 'βαρκ', 'σκαφ', 'γιοτ'],
      ['морск прогулк', 'прогулк на лодк', 'прогулк на яхт', 'прогулк на катер', 'яхт', 'катер', 'катамаран', 'лодк', 'круиз']],
    { osm: [{ amenity: 'boat_rental' }, { shop: 'boat_rental' }, { tourism: 'attraction', boat: 'yes' }], visitMinutes: 180, outdoor: true, dayParts: DAYTIME }),
  c('diving', 'place', 'adventure', 'diving', ['Diving & snorkelling', 'Καταδύσεις', 'Дайвинг'],
    [['diving', 'scuba', 'snorkel', 'dive'], ['καταδυσ', 'scuba'], ['дайвинг', 'снорк', 'погружен']],
    { osm: [{ shop: 'scuba_diving' }, { sport: 'scuba_diving' }], visitMinutes: 180, outdoor: true, dayParts: DAYTIME }),
  c('surfing', 'place', 'adventure', 'surf', ['Water sports', 'Θαλάσσια σπορ', 'Водные развлечения'],
    [['surf', 'kitesurf', 'windsurf', 'sup', 'paddle board', 'water sports', 'water sport', 'jet ski', 'jetski', 'parasailing', 'kayak', 'canoe', 'wakeboard', 'water ski', 'banana boat'],
      ['σερφ', 'θαλασσια σπορ', 'καγιακ', 'τζετ σκι'],
      ['серф', 'кайт', 'виндсерф', 'сап', 'водн спорт', 'водн развлечен', 'гидроцикл', 'парасейл', 'парашют над мор', 'каяк', 'байдарк', 'вейкборд', 'водн лыж', 'банан лодк']],
    { osm: [{ sport: 'surfing' }, { sport: 'kitesurfing' }, { sport: 'windsurfing' }, { sport: 'water_ski' }, { sport: 'canoe' }, { shop: 'surf' }], visitMinutes: 150, outdoor: true, dayParts: DAYTIME }),
  c('tours', 'place', 'adventure', 'compass', ['Tours, safaris & off-road', 'Εκδρομές, σαφάρι & off-road', 'Экскурсии, сафари и офф-роуд'],
    [['guided tour', 'day tour', 'tours', 'excursion', 'safari', 'jeep', 'quad', 'atv', 'buggy', 'off road', 'offroad', 'day trip', 'segway'],
      ['εκδρομ', 'σαφαρι', 'ξεναγ', 'τζιπ'],
      ['экскурс', 'сафари', 'джип', 'квадроцикл', 'багги', 'сигвей']],
    { osm: [{ office: 'guide' }], visitMinutes: 240, outdoor: true, dayParts: DAYTIME }),
  c('hiking', 'place', 'nature', 'hiking', ['Hiking trails', 'Μονοπάτια πεζοπορίας', 'Пешие маршруты'],
    [['hike', 'hiking', 'trail', 'trek', 'nature trail', 'walk'], ['πεζοπορ', 'μονοπατ', 'περιπατ'], ['пеш маршрут', 'поход', 'хайкинг', 'тропа', 'троп', 'треккинг', 'пеш прогулк']],
    { osm: [{ route: 'hiking' }, { highway: 'trailhead' }], osmRequireAny: ['name'], google: ['hiking_area'], visitMinutes: 150, outdoor: true, usuallyFree: true, dayParts: DAYTIME }),
  c('cycling', 'place', 'sports', 'bike', ['Cycling', 'Ποδηλασία', 'Велосипед'],
    [['cycling', 'bike', 'bicycle', 'mtb', 'bike rental'], ['ποδηλατ'], ['велосипед', 'вело', 'байк']],
    { osm: [{ route: 'bicycle' }, { route: 'mtb' }, { amenity: 'bicycle_rental' }], osmRequireAny: ['name'], visitMinutes: 120, outdoor: true, dayParts: DAYTIME }),
  c('beach', 'place', 'nature', 'beach', ['Beaches', 'Παραλίες', 'Пляжи'],
    [['beach', 'swim', 'swimming', 'sea'], ['παραλ', 'κολυμπ', 'θαλασσ'], ['пляж', 'купат', 'море', 'моря']],
    { osm: [{ natural: 'beach' }], osmRequireAny: ['name'], google: ['beach'], visitMinutes: 150, outdoor: true, usuallyFree: true, dayParts: DAYTIME }),
  c('park', 'place', 'nature', 'tree', ['Parks & nature', 'Πάρκα & φύση', 'Парки и природа'],
    [['park', 'nature', 'garden', 'forest', 'nature reserve', 'national park'], ['παρκο', 'κηπ', 'δασ', 'φυσ'], ['парк', 'природ', 'сад', 'лес', 'заповедник']],
    { osm: [{ leisure: 'park' }], osmRequireAny: ['name'], google: ['park', 'national_park', 'botanical_garden'], visitMinutes: 60, outdoor: true, usuallyFree: true }),
  c('viewpoint', 'place', 'nature', 'binoculars', ['Viewpoints', 'Θέες', 'Смотровые площадки'],
    [['viewpoint', 'view', 'lookout', 'sunset', 'panorama', 'scenic'], ['θεα', 'ηλιοβασιλεμ', 'πανοραμα'], ['смотров', 'вид', 'закат', 'панорам']],
    { osm: [{ tourism: 'viewpoint' }], google: ['observation_deck'], visitMinutes: 30, outdoor: true, usuallyFree: true }),
  c('museum', 'place', 'culture', 'museum', ['Museums', 'Μουσεία', 'Музеи'],
    [['museum'], ['μουσει'], ['музе']],
    { osm: [{ tourism: 'museum' }], google: ['museum'], visitMinutes: 90, dayParts: DAYTIME }),
  c('historic-site', 'place', 'culture', 'columns', ['Historic sites', 'Ιστορικά μνημεία', 'Исторические места'],
    [['historic', 'history', 'castle', 'ruins', 'archaeological', 'ancient', 'monastery', 'fort', 'medieval', 'heritage', 'tomb'], ['ιστορικ', 'καστρ', 'αρχαιολογ', 'αρχαι', 'μοναστηρ', 'μνημει', 'ερειπι'], ['историческ', 'истори', 'замок', 'замк', 'руин', 'археолог', 'древн', 'монастыр', 'крепост', 'средневеков']],
    { osm: [{ historic: 'archaeological_site' }, { historic: 'castle' }, { historic: 'monastery' }, { historic: 'ruins' }, { historic: 'fort' }, { historic: 'monument' }, { historic: 'tomb' }, { amenity: 'place_of_worship', historic: true }, { amenity: 'monastery' }], osmRequireAny: ['name'], google: ['historical_landmark', 'historical_place'], visitMinutes: 60, dayParts: DAYTIME }),
  c('religious-site', 'place', 'culture', 'church', ['Churches & monasteries', 'Εκκλησίες & μονές', 'Храмы и монастыри'],
    [['church', 'monastery', 'mosque', 'cathedral', 'chapel'], ['εκκλησι', 'μοναστηρ', 'μονη', 'τζαμ', 'παρεκκλησ'], ['церк', 'храм', 'мечет', 'собор', 'часовн']],
    { osm: [{ amenity: 'place_of_worship' }], osmRequireAny: ['wikidata', 'wikipedia'], google: ['church', 'mosque'], visitMinutes: 30 }),
  c('art-gallery', 'place', 'art', 'palette', ['Art galleries', 'Γκαλερί τέχνης', 'Арт-галереи'],
    [['gallery', 'art gallery', 'art', 'contemporary art'], ['γκαλερι', 'πινακοθηκ', 'τεχν'], ['галере', 'искусств', 'арт']],
    { osm: [{ tourism: 'gallery' }, { shop: 'art' }, { amenity: 'arts_centre' }], google: ['art_gallery'], visitMinutes: 60, dayParts: DAYTIME }),
  c('zoo-aquarium', 'place', 'family', 'fish', ['Zoos & aquariums', 'Ζωολογικοί κήποι & ενυδρεία', 'Зоопарки и аквариумы'],
    [['zoo', 'aquarium', 'animal park', 'bird park', 'petting zoo'], ['ζωολογικ', 'ενυδρει', 'παρκο ζωων'], ['зоопарк', 'аквариум', 'океанариум', 'парк птиц', 'контактн зоопарк']],
    { osm: [{ tourism: 'zoo' }, { tourism: 'aquarium' }], google: ['zoo', 'aquarium'], visitMinutes: 120, dayParts: DAYTIME }),
  c('playground', 'place', 'family', 'swing', ['Playgrounds', 'Παιδικές χαρές', 'Детские площадки'],
    [['playground', 'play area', 'soft play'], ['παιδικη χαρα', 'παιδοτοπ'], ['детск площадк', 'игров площадк', 'детск комнат']],
    { osm: [{ leisure: 'playground' }], osmRequireAny: ['name'], google: ['playground'], visitMinutes: 45, outdoor: true, usuallyFree: true, dayParts: DAYTIME }),
  c('marina', 'place', 'adventure', 'anchor', ['Marinas', 'Μαρίνες', 'Марины'],
    [['marina', 'harbour', 'harbor', 'port'], ['μαριν', 'λιμαν'], ['марин', 'гаван', 'порт']],
    { osm: [{ leisure: 'marina' }], google: ['marina'], visitMinutes: 60, outdoor: true, usuallyFree: true }),
  c('campsite', 'place', 'nature', 'tent', ['Camping', 'Κάμπινγκ', 'Кемпинги'],
    [['camping', 'campsite', 'campground', 'picnic'], ['καμπινγκ', 'κατασκην', 'πικνικ'], ['кемпинг', 'палатк', 'пикник']],
    { osm: [{ tourism: 'camp_site' }, { tourism: 'picnic_site' }], osmRequireAny: ['name'], google: ['campground'], visitMinutes: 120, outdoor: true }),

  // ── More things to do: adventure, water, sports, outdoors, entertainment, social, shopping, family ──────
  c('paintball', 'place', 'adventure', 'target', ['Paintball & airsoft', 'Paintball & airsoft', 'Пейнтбол и страйкбол'],
    [['paintball', 'airsoft'], ['πεϊντμπολ', 'πειντμπολ', 'αιρσοφτ'], ['пейнтбол', 'страйкбол', 'эйрсофт']],
    { osm: [{ sport: 'paintball' }, { sport: 'airsoft' }], visitMinutes: 120, outdoor: true, dayParts: DAYTIME }),
  c('laser-tag', 'place', 'adventure', 'laser', ['Laser tag', 'Laser tag', 'Лазертаг'],
    [['laser tag', 'lasertag', 'laser game'], ['λειζερ ταγκ'], ['лазертаг', 'лазерн бой']],
    { osm: [{ sport: 'laser_tag' }], visitMinutes: 75 }),
  c('climbing', 'place', 'adventure', 'climb', ['Climbing & bouldering', 'Αναρρίχηση', 'Скалолазание и боулдеринг'],
    [['climbing', 'bouldering', 'climbing wall', 'rock climbing'], ['αναρριχ'], ['скалолаз', 'боулдеринг', 'скалодром']],
    { osm: [{ sport: 'climbing' }], osmRequireAny: ['name'], visitMinutes: 120 }),
  c('zipline', 'place', 'adventure', 'zip', ['Ziplines & rope parks', 'Zipline & σχοινοπάρκα', 'Зиплайны и верёвочные парки'],
    [['zipline', 'zip line', 'rope park', 'ropes course', 'adventure park', 'treetop'], ['ζιπλαιν', 'περιπετειας παρκο', 'σχοινοπαρκ'], ['зиплайн', 'тарзанк', 'веревочн парк', 'верёвочн парк', 'парк приключен']],
    { osm: [{ aerialway: 'zip_line' }, { sport: 'climbing_adventure' }], visitMinutes: 150, outdoor: true, dayParts: DAYTIME }),
  c('horse-riding', 'place', 'adventure', 'horse', ['Horse riding', 'Ιππασία', 'Конные прогулки'],
    [['horse riding', 'horseback', 'equestrian', 'pony'], ['ιππασ', 'αλογ'], ['конн', 'верхов езд', 'лошад', 'пони']],
    { osm: [{ leisure: 'horse_riding' }, { sport: 'equestrian' }, { route: 'horse' }], osmRequireAny: ['name'], visitMinutes: 120, outdoor: true, dayParts: DAYTIME }),
  c('air-sports', 'place', 'adventure', 'paraglide', ['Paragliding & skydiving', 'Αλεξίπτωτο πλαγιάς & ελεύθερη πτώση', 'Параглайдинг и прыжки с парашютом'],
    [['paragliding', 'paraglide', 'skydiving', 'skydive', 'parachute', 'tandem flight'], ['αλεξιπτωτ', 'πτωση με αλεξιπτωτο'], ['параглайд', 'парашют', 'скайдайв', 'полет на параплан', 'параплан']],
    { osm: [{ sport: 'free_flying' }, { sport: 'paragliding' }, { sport: 'skydiving' }, { sport: 'parachuting' }], visitMinutes: 180, outdoor: true, dayParts: DAYTIME }),
  c('fishing', 'place', 'nature', 'fish', ['Fishing', 'Ψάρεμα', 'Рыбалка'],
    [['fishing', 'fishing trip', 'angling'], ['ψαρεμ'], ['рыбалк', 'рыбн ловл']],
    { osm: [{ leisure: 'fishing' }], osmRequireAny: ['name'], visitMinutes: 180, outdoor: true, usuallyFree: true }),
  c('swimming-pool', 'place', 'sports', 'swim', ['Swimming pools', 'Πισίνες', 'Бассейны'],
    [['swimming pool', 'pool', 'swimming', 'lap swimming'], ['πισιν', 'κολυμβητηρ'], ['бассейн', 'плаван']],
    { osm: [{ leisure: 'swimming_pool' }, { leisure: 'sports_centre', sport: 'swimming' }], osmRequireAny: ['name'], visitMinutes: 90 }),
  c('sailing', 'place', 'adventure', 'sail', ['Sailing', 'Ιστιοπλοΐα', 'Парусный спорт'],
    [['sailing', 'sailing club', 'regatta'], ['ιστιοπλο'], ['парусн', 'регат']],
    { osm: [{ sport: 'sailing' }, { club: 'sailing' }], osmRequireAny: ['name'], visitMinutes: 180, outdoor: true, dayParts: DAYTIME }),
  c('martial-arts', 'place', 'sports', 'karate', ['Martial arts & boxing', 'Πολεμικές τέχνες & πυγμαχία', 'Единоборства и бокс'],
    [['martial arts', 'karate', 'judo', 'taekwondo', 'boxing', 'kickboxing', 'mma', 'jiu jitsu', 'muay thai'], ['πολεμικ τεχν', 'καρατε', 'τζουντο', 'πυγμαχ', 'μποξ'], ['единоборств', 'карате', 'дзюдо', 'тхэквондо', 'бокс', 'кикбоксинг', 'мма', 'джиу', 'тайский бокс']],
    { osm: [{ sport: 'martial_arts' }, { sport: 'karate' }, { sport: 'judo' }, { sport: 'taekwondo' }, { sport: 'boxing' }, { sport: 'kickboxing' }, { sport: 'mixed_martial_arts' }], osmRequireAny: ['name'], visitMinutes: 90 }),
  c('crossfit', 'place', 'sports', 'dumbbell', ['CrossFit', 'CrossFit', 'Кроссфит'],
    [['crossfit', 'functional training'], ['κροσφιτ'], ['кроссфит', 'функциональн тренир']],
    { osm: [{ sport: 'crossfit' }], visitMinutes: 75 }),
  c('racket-sports', 'place', 'sports', 'tennis', ['Tennis & padel', 'Τένις & padel', 'Теннис и падел'],
    [['tennis', 'padel', 'squash', 'badminton', 'table tennis'], ['τενις', 'πανελ', 'σκουος', 'μπαντμιντον'], ['теннис', 'падел', 'сквош', 'бадминтон', 'пинг понг']],
    { osm: [{ sport: 'tennis' }, { sport: 'padel' }, { sport: 'squash' }, { sport: 'badminton' }], osmRequireAny: ['name'], visitMinutes: 90 }),
  c('sports-courts', 'place', 'sports', 'ball', ['Sports courts & pitches', 'Γήπεδα', 'Спортплощадки'],
    [['basketball', 'football', 'soccer', 'futsal', 'volleyball', 'beach volleyball', 'sports court', 'pitch'], ['μπασκετ', 'ποδοσφαιρ', 'βολει', 'γηπεδ'], ['баскетбол', 'футбол', 'мини футбол', 'волейбол', 'пляжн волейбол', 'спортплощадк', 'поле']],
    { osm: [{ sport: 'basketball' }, { sport: 'soccer' }, { sport: 'volleyball' }, { sport: 'beachvolleyball' }, { sport: 'futsal' }, { sport: 'multi' }], osmRequireAny: ['name'], visitMinutes: 90, outdoor: true }),
  c('skatepark', 'place', 'sports', 'skate', ['Skateparks', 'Skateparks', 'Скейт-парки'],
    [['skatepark', 'skate park', 'skateboard', 'bmx'], ['σκειτ'], ['скейт', 'скейтпарк', 'бмх', 'роллер']],
    { osm: [{ sport: 'skateboard' }, { leisure: 'skatepark' }, { sport: 'bmx' }], visitMinutes: 90, outdoor: true, usuallyFree: true }),
  c('yoga-studio', 'place', 'wellness', 'lotus', ['Yoga & pilates studios', 'Στούντιο γιόγκα & πιλάτες', 'Студии йоги и пилатеса'],
    [['yoga studio', 'yoga class', 'pilates studio'], ['στουντιο γιογκα'], ['студи йог', 'йог студи', 'занят йог', 'студи пилатес']],
    { osm: [{ sport: 'yoga' }, { leisure: 'fitness_centre', sport: 'yoga' }, { sport: 'pilates' }], osmRequireAny: ['name'], visitMinutes: 75 }),
  c('dance-studio', 'place', 'culture', 'dance', ['Dance studios', 'Σχολές χορού', 'Танцевальные студии'],
    [['dance studio', 'dance school', 'dance class', 'salsa', 'bachata', 'tango'], ['σχολη χορου', 'σαλσα', 'ταγκο'], ['танц студи', 'школ танц', 'сальс', 'бачат', 'танго']],
    { osm: [{ leisure: 'dance' }, { amenity: 'dancing_school' }], osmRequireAny: ['name'], visitMinutes: 90, dayParts: EVENING }),
  c('sports-club', 'place', 'sports', 'run', ['Sports clubs', 'Αθλητικοί σύλλογοι', 'Спортивные клубы'],
    [['running club', 'cycling club', 'sports club', 'triathlon'], ['αθλητικ ομιλ', 'συλλογ δρομ'], ['беговой клуб', 'бегов клуб', 'велоклуб', 'спортклуб', 'спортивн клуб', 'триатлон']],
    { osm: [{ club: 'sport' }], osmRequireAny: ['name'], visitMinutes: 90 }),
  c('nature-reserve', 'place', 'nature', 'terrain', ['Nature reserves & national parks', 'Φυσικά καταφύγια & εθνικά πάρκα', 'Заповедники и нацпарки'],
    [['nature reserve', 'national park', 'forest park', 'protected area', 'nature park'], ['εθνικ δρυμ', 'εθνικ παρκ', 'φυσικ καταφυγ', 'δασικ παρκ'], ['заповедник', 'нацпарк', 'национальн парк', 'природн парк', 'лесопарк']],
    { osm: [{ leisure: 'nature_reserve' }, { boundary: 'national_park' }, { boundary: 'protected_area' }], osmRequireAny: ['name'], visitMinutes: 150, outdoor: true, usuallyFree: true, dayParts: DAYTIME }),
  c('waterfall', 'place', 'nature', 'waterfall', ['Waterfalls', 'Καταρράκτες', 'Водопады'],
    [['waterfall', 'falls'], ['καταρρακτ'], ['водопад']],
    { osm: [{ waterway: 'waterfall' }], osmRequireAny: ['name'], visitMinutes: 90, outdoor: true, usuallyFree: true, dayParts: DAYTIME }),
  c('cave', 'place', 'nature', 'cave', ['Caves', 'Σπηλιές', 'Пещеры'],
    [['cave', 'caves', 'grotto'], ['σπηλ'], ['пещер', 'грот']],
    { osm: [{ natural: 'cave_entrance' }], osmRequireAny: ['name'], visitMinutes: 60, outdoor: true, usuallyFree: true, dayParts: DAYTIME }),
  c('garden', 'place', 'nature', 'flower', ['Botanical gardens', 'Βοτανικοί κήποι', 'Ботанические сады'],
    [['botanical garden', 'botanic garden', 'garden'], ['βοτανικ κηπ', 'κηπ'], ['ботаническ сад', 'сад']],
    { osm: [{ leisure: 'garden', 'garden:type': 'botanical' }], osmRequireAny: ['name'], visitMinutes: 75, outdoor: true, dayParts: DAYTIME }),
  c('birdwatching', 'place', 'nature', 'bird', ['Bird watching', 'Παρατήρηση πουλιών', 'Наблюдение за птицами'],
    [['bird watching', 'birdwatching', 'bird hide', 'flamingo'], ['παρατηρηση πουλ', 'φλαμινγκ'], ['наблюден за птиц', 'птиц', 'фламинго']],
    { osm: [{ leisure: 'bird_hide' }], visitMinutes: 60, outdoor: true, usuallyFree: true, dayParts: DAYTIME }),
  c('picnic', 'place', 'nature', 'picnic', ['Picnic sites', 'Χώροι πικνίκ', 'Места для пикника'],
    [['picnic', 'picnic site', 'bbq area'], ['πικνικ', 'χωρος αναψυχ'], ['пикник', 'зон отдых', 'мангал']],
    { osm: [{ tourism: 'picnic_site' }, { leisure: 'picnic_site' }], osmRequireAny: ['name'], visitMinutes: 120, outdoor: true, usuallyFree: true, dayParts: DAYTIME }),
  c('arcade', 'place', 'family', 'gamepad', ['Arcades & gaming', 'Ηλεκτρονικά παιχνίδια & gaming', 'Игровые залы и гейминг'],
    [['arcade', 'gaming center', 'game center', 'esports', 'playstation'], ['ηλεκτρονικ παιχνιδ', 'gaming'], ['игров зал', 'игровой клуб', 'компьютерн клуб', 'киберспорт', 'аркад']],
    { osm: [{ leisure: 'amusement_arcade' }], osmRequireAny: ['name'], visitMinutes: 90 }),
  c('trampoline-park', 'place', 'family', 'jump', ['Trampoline parks', 'Πάρκα τραμπολίνο', 'Батутные парки'],
    [['trampoline', 'trampoline park', 'jump park'], ['τραμπολ'], ['батут']],
    { osm: [{ leisure: 'trampoline_park' }, { sport: 'trampoline' }], osmRequireAny: ['name'], visitMinutes: 90 }),
  c('performing-arts', 'place', 'culture', 'masks', ['Theatres & concert halls', 'Θέατρα & αίθουσες συναυλιών', 'Театры и концертные залы'],
    [['theatre venue', 'concert hall', 'amphitheatre', 'arts centre', 'comedy club', 'stand up'], ['θεατρ', 'αιθουσ συναυλι', 'αμφιθεατρ', 'πολιτιστικ κεντρ'], ['театр', 'концертн зал', 'амфитеатр', 'арт центр', 'стендап', 'камеди клуб']],
    { osm: [{ amenity: 'theatre' }, { amenity: 'concert_hall' }, { amenity: 'arts_centre' }, { amenity: 'events_venue' }], osmRequireAny: ['name'], visitMinutes: 150, dayParts: EVENING }),
  c('board-games', 'place', 'food', 'dice', ['Board game cafés', 'Καφέ επιτραπέζιων', 'Антикафе и настольные игры'],
    [['board game', 'board games', 'boardgame', 'game cafe'], ['επιτραπεζ'], ['настольн игр', 'антикафе']],
    { visitMinutes: 120, dayParts: ['afternoon', 'evening'] }),
  c('community-centre', 'place', 'culture', 'people', ['Community & social centres', 'Πολιτιστικά & κοινωνικά κέντρα', 'Культурные и социальные центры'],
    [['community centre', 'community center', 'social club', 'language exchange', 'cultural centre'], ['κοινοτικ κεντρ', 'πολιτιστικ συλλογ'], ['культурн центр', 'социальн клуб', 'языков обмен', 'разговорн клуб', 'общин']],
    { osm: [{ amenity: 'community_centre' }, { amenity: 'social_centre' }], osmRequireAny: ['name'], visitMinutes: 90 }),
  c('creative-workshop', 'place', 'art', 'brush', ['Creative workshops', 'Δημιουργικά εργαστήρια', 'Творческие мастерские'],
    [['pottery', 'ceramics', 'art class', 'painting class', 'craft workshop', 'atelier'], ['κεραμικ', 'αγγειοπλαστ', 'εργαστηρ ζωγραφ'], ['гончар', 'керамик', 'мастер класс', 'урок живопис', 'творческ мастерск']],
    { osm: [{ craft: 'pottery' }, { craft: 'ceramics' }], osmRequireAny: ['name'], visitMinutes: 120 }),
  c('second-hand', 'place', 'shopping', 'hanger', ['Vintage & second-hand', 'Vintage & μεταχειρισμένα', 'Винтаж и секонд-хенд'],
    [['vintage', 'thrift', 'second hand', 'secondhand', 'charity shop', 'flea market', 'antiques', 'antique'], ['μεταχειρισμ', 'παλαιοπωλ', 'αντικ'], ['винтаж', 'секонд', 'комиссион', 'блошин', 'барахолк', 'антиквар']],
    { osm: [{ shop: 'second_hand' }, { shop: 'charity' }, { shop: 'antiques' }], osmRequireAny: ['name'], visitMinutes: 45 }),
  c('local-shops', 'place', 'shopping', 'store', ['Local boutiques & crafts', 'Τοπικά καταστήματα & χειροτεχνία', 'Местные бутики и ремёсла'],
    [['boutique', 'gift shop', 'souvenir', 'handmade', 'crafts', 'local designer'], ['μπουτικ', 'δωρα', 'σουβενιρ', 'χειροτεχν'], ['бутик', 'подарк', 'сувенир', 'ручн работ', 'ремесл']],
    { osm: [{ shop: 'boutique' }, { shop: 'gift' }, { shop: 'craft' }, { shop: 'art' }], osmRequireAny: ['name'], visitMinutes: 30 }),
  c('kids-play', 'place', 'family', 'child', ['Kids activity centres', 'Παιδότοποι', 'Детские игровые центры'],
    [['kids club', 'soft play', 'indoor playground', 'play centre', 'kids activities'], ['παιδοτοπ', 'παιδικ'], ['детск игров', 'детск центр', 'игров комнат', 'для детей']],
    { osm: [{ leisure: 'indoor_play' }, { leisure: 'playground', indoor: 'yes' }], osmRequireAny: ['name'], visitMinutes: 90 }),
  c('science-centre', 'place', 'family', 'atom', ['Science & discovery centres', 'Κέντρα επιστήμης', 'Научные и познавательные центры'],
    [['science centre', 'science center', 'planetarium', 'observatory', 'discovery centre'], ['κεντρ επιστημ', 'πλανηταρ', 'αστεροσκοπ'], ['научн центр', 'планетари', 'обсерватор', 'познавательн']],
    { osm: [{ amenity: 'planetarium' }, { tourism: 'museum', museum: 'science' }, { man_made: 'observatory', tourism: 'attraction' }], osmRequireAny: ['name'], visitMinutes: 120 }),

  // ── Everyday services ────────────────────────────────────────────────────
  c('pharmacy', 'place', 'practical', 'pill', ['Pharmacies', 'Φαρμακεία', 'Аптеки'],
    [['pharmacy', 'chemist', 'drugstore'], ['φαρμακ'], ['аптек']],
    { osm: [{ amenity: 'pharmacy' }], google: ['pharmacy', 'drugstore'], visitMinutes: 10 }),
  c('hospital', 'place', 'practical', 'hospital', ['Hospitals', 'Νοσοκομεία', 'Больницы'],
    [['hospital', 'emergency', 'a&e', 'er'], ['νοσοκομ', 'πρωτες βοηθει', 'επειγοντ'], ['больниц', 'госпитал', 'скор', 'неотложн', 'травмпункт']],
    { osm: [{ amenity: 'hospital' }], google: ['hospital'], visitMinutes: 60 }),
  c('clinic', 'place', 'practical', 'stethoscope', ['Clinics & doctors', 'Κλινικές & ιατρεία', 'Клиники и врачи'],
    [['clinic', 'doctor', 'medical centre', 'medical center', 'gp'], ['κλινικ', 'ιατρει', 'γιατρ', 'ιατρικο κεντρ'], ['клиник', 'врач', 'медцентр', 'медицинск центр', 'доктор']],
    { osm: [{ amenity: 'clinic' }, { amenity: 'doctors' }], google: ['doctor', 'medical_clinic'], visitMinutes: 45 }),
  c('dentist', 'place', 'practical', 'tooth', ['Dentists', 'Οδοντίατροι', 'Стоматологии'],
    [['dentist', 'dental'], ['οδοντιατρ'], ['стоматолог', 'зубн']],
    { osm: [{ amenity: 'dentist' }], google: ['dentist'], visitMinutes: 45 }),
  c('atm', 'place', 'practical', 'cash', ['ATMs', 'ATM', 'Банкоматы'],
    [['atm', 'cash machine', 'cashpoint', 'withdraw cash'], ['atm', 'αυτοματη ταμειακη', 'μετρητα'], ['банкомат', 'снять наличн', 'наличн']],
    { osm: [{ amenity: 'atm' }, { amenity: 'bank', atm: 'yes' }], google: ['atm'], visitMinutes: 5 }),
  c('bank', 'place', 'practical', 'bank', ['Banks', 'Τράπεζες', 'Банки'],
    [['bank'], ['τραπεζ'], ['банк']],
    { osm: [{ amenity: 'bank' }], google: ['bank'], visitMinutes: 20 }),
  c('car-wash', 'place', 'practical', 'carwash', ['Car washes', 'Πλυντήρια αυτοκινήτων', 'Автомойки'],
    [['car wash', 'carwash'], ['πλυντηριο αυτοκινητ', 'πλυσιμο αυτοκινητ'], ['автомойк', 'мойк']],
    { osm: [{ amenity: 'car_wash' }], google: ['car_wash'], visitMinutes: 30 }),
  c('car-repair', 'place', 'practical', 'wrench', ['Car repair', 'Συνεργεία', 'Автосервисы'],
    [['car repair', 'mechanic', 'garage', 'tyres', 'tires'], ['συνεργει', 'μηχανικ αυτοκινητ', 'λαστιχ'], ['автосервис', 'шиномонтаж', 'автомастерск', 'механик']],
    { osm: [{ shop: 'car_repair' }, { shop: 'tyres' }], google: ['car_repair'], visitMinutes: 60 }),
  c('fuel', 'place', 'practical', 'fuel', ['Petrol stations', 'Πρατήρια καυσίμων', 'Заправки'],
    [['gas station', 'petrol', 'fuel', 'filling station', 'diesel'], ['πρατηρι', 'βενζιν', 'καυσιμ'], ['заправк', 'азс', 'бензин', 'топлив']],
    { osm: [{ amenity: 'fuel' }], google: ['gas_station'], visitMinutes: 10 }),
  c('ev-charging', 'place', 'practical', 'bolt', ['EV charging', 'Φόρτιση ηλεκτρικών', 'Зарядные станции'],
    [['ev charging', 'charging station', 'charger', 'electric car', 'tesla'], ['φορτιση', 'φορτιστ', 'ηλεκτρικο αυτοκινητ'], ['зарядн', 'электрозаправ', 'электромобил', 'зарядк']],
    { osm: [{ amenity: 'charging_station' }], google: ['electric_vehicle_charging_station'], visitMinutes: 40 }),
  c('post-office', 'place', 'practical', 'mail', ['Post offices', 'Ταχυδρομεία', 'Почта'],
    [['post office', 'postal', 'parcel'], ['ταχυδρομ', 'δεμα'], ['почт', 'посылк']],
    { osm: [{ amenity: 'post_office' }], google: ['post_office'], visitMinutes: 15 }),
  c('police', 'place', 'practical', 'shield', ['Police', 'Αστυνομία', 'Полиция'],
    [['police'], ['αστυνομ'], ['полиц']],
    { osm: [{ amenity: 'police' }], google: ['police'], visitMinutes: 30 }),
  c('veterinary', 'place', 'practical', 'paw', ['Vets', 'Κτηνίατροι', 'Ветклиники'],
    [['vet', 'veterinary', 'animal hospital'], ['κτηνιατρ'], ['ветеринар', 'ветклиник']],
    { osm: [{ amenity: 'veterinary' }], google: ['veterinary_care'], visitMinutes: 45 }),
];

export const CATEGORY_BY_SLUG: ReadonlyMap<string, CategoryDef> = new Map(CATEGORIES.map((x) => [x.slug, x]));
export const CATEGORY_SLUGS = CATEGORIES.map((x) => x.slug) as [string, ...string[]];

export function getCategory(slug: string): CategoryDef | undefined {
  return CATEGORY_BY_SLUG.get(slug);
}

export function categoriesInGroup(group: InterestGroup): CategoryDef[] {
  return CATEGORIES.filter((x) => x.group === group);
}

export function groupOf(slug: string): InterestGroup | undefined {
  return CATEGORY_BY_SLUG.get(slug)?.group;
}

/** Strictest age limit across categories (used for 18+ gating). */
export function ageMinFor(slugs: readonly string[]): number | undefined {
  let max: number | undefined;
  for (const s of slugs) {
    const a = CATEGORY_BY_SLUG.get(s)?.ageMin;
    if (a !== undefined && (max === undefined || a > max)) max = a;
  }
  return max;
}

/** Return categories whose OSM matchers match the given tags (most specific first). */
export function categoriesForOsmTags(tags: Record<string, string>): CategoryDef[] {
  const out: Array<{ def: CategoryDef; specificity: number }> = [];
  for (const def of CATEGORIES) {
    if (!def.osm) continue;
    for (const m of def.osm) {
      const entries = Object.entries(m);
      const ok = entries.every(([k, v]) => (v === true ? tags[k] !== undefined && tags[k] !== 'no' : tags[k] === v));
      if (!ok) continue;
      if (def.osmRequireAny && !def.osmRequireAny.some((k) => tags[k])) continue;
      out.push({ def, specificity: entries.length });
      break;
    }
  }
  return out.sort((a, b) => b.specificity - a.specificity).map((x) => x.def);
}

/**
 * Activities are often mapped only as a generic business (`tourism=attraction`, `shop=travel_agency`, `office=company`)
 * with a telling name: "Blue Lagoon Cruise", "Jeep Safari Troodos". Recognised only on elements that are a business
 * or attraction (never on streets or buildings).
 */
const NAME_RULES: Array<[slug: string, re: RegExp]> = [
  ['boat-trip', /\b(cruises?|boat (trips?|tours?|rides?|hire|rentals?)|catamaran|yacht charters?|sailing|glass[- ]bottom|pirate ship)\b|κρουαζιερ|κρουαζιέρ|круиз/i],
  ['diving', /\b(div(e|ing) (cent(er|re)|school|club)|scuba|snorkel)/i],
  ['surfing', /\b(water ?sports?|jet ?skis?|parasail|kayak|canoe|wakeboard|kite ?surf|windsurf|paddle ?board)/i],
  ['tours', /\b(safaris?|jeep|quad|buggy|excursions?|guided tours?|day tours?)\b|σαφάρι|σαφαρι|экскурс|сафари/i],
  ['laser-tag', /\blaser ?(tag|game|arena)\b|лазертаг/i],
  ['zipline', /\bzip ?line|\bropes? (park|course)\b|\badventure park\b|tree ?top/i],
  ['paintball', /\bpaintball|\bairsoft/i],
  ['escape-room', /\bescape ?rooms?\b|\bquest room\b|квест/i],
  ['board-games', /\bboard ?games?\b|\bgame caf[eé]\b|επιτραπέζι|настольн|антикафе/i],
  ['trampoline-park', /\btrampoline|батут/i],
  ['karting', /\bkarting\b|\bgo[- ]?karts?\b/i],
  ['horse-riding', /\b(horse ?riding|riding (centre|center|school|club)|equestrian|stables?)\b|ιππασ/i],
  ['air-sports', /\bparaglid|\bskydiv|\btandem flights?\b/i],
  ['kids-play', /\b(soft play|kids? (club|zone|world|land|park)|play ?(centre|center|land|zone))\b|παιδότοπ|παιδοτοπ/i],
];
const BUSINESS_KEYS = ['tourism', 'leisure', 'shop', 'office', 'amenity', 'sport', 'club', 'craft'];

export function categoriesForOsmName(tags: Record<string, string>): CategoryDef[] {
  const name = [tags.name, tags['name:en'], tags.brand].filter(Boolean).join(' ');
  if (!name || !BUSINESS_KEYS.some((k) => tags[k])) return [];
  return NAME_RULES.filter(([, re]) => re.test(name)).map(([slug]) => getCategory(slug)!).filter(Boolean);
}

/** Return categories for Google Place types. */
export function categoriesForGoogleTypes(types: readonly string[]): CategoryDef[] {
  const set = new Set(types);
  return CATEGORIES.filter((d) => d.google?.some((t) => set.has(t)));
}

/** Words that refer to a whole interest group rather than a single category. */
export const GROUP_KEYWORDS: Record<InterestGroup, Partial<Record<Locale, string[]>>> = {
  music: { en: ['music'], el: ['μουσικ'], ru: ['музык'] },
  nightlife: { en: ['nightlife', 'night out', 'go out'], el: ['νυχτεριν', 'εξοδο'], ru: ['ночн жизн', 'потусить', 'оторваться'] },
  food: { en: ['food', 'eat', 'eating', 'hungry'], el: ['φαγητ', 'φαι'], ru: ['еда', 'еды', 'поесть', 'перекусить', 'покушать'] },
  shopping: { en: ['shopping', 'shops', 'shop', 'stores'], el: ['ψωνι', 'μαγαζ', 'καταστημ'], ru: ['шопинг', 'магазин', 'покупк'] },
  sports: { en: ['sport', 'sports'], el: ['αθλητ', 'σπορ'], ru: ['спорт'] },
  nature: { en: ['nature', 'outdoors', 'outdoor'], el: ['φυση', 'υπαιθρ'], ru: ['природ', 'на природ'] },
  culture: { en: ['culture', 'cultural', 'sightseeing', 'sights'], el: ['πολιτισμ', 'αξιοθεατ'], ru: ['культур', 'достопримечательн'] },
  family: { en: ['family', 'kids', 'children', 'child'], el: ['οικογεν', 'παιδι', 'παιδ'], ru: ['семья', 'семьей', 'семейн', 'дет', 'ребен', 'ребят'] },
  adventure: { en: ['adventure', 'extreme', 'adrenaline', 'active'], el: ['περιπετει', 'αδρεναλιν'], ru: ['приключен', 'экстрим', 'адреналин', 'активн отдых'] },
  technology: { en: ['technology', 'tech'], el: ['τεχνολογ'], ru: ['технолог', 'айти'] },
  art: { en: ['art', 'arts'], el: ['τεχν'], ru: ['искусств', 'арт'] },
  wellness: { en: ['wellness', 'relax', 'self-care'], el: ['ευεξι', 'χαλαρωσ'], ru: ['релакс', 'расслаб', 'велнес'] },
  practical: { en: ['services', 'errands'], el: ['υπηρεσι'], ru: ['услуг', 'сервис'] },
};

/** Broad categories a user may search for, and the narrower categories they include. */
export const CATEGORY_UMBRELLAS: Record<string, string[]> = {
  concert: ['rock-metal', 'electronic', 'jazz-blues', 'classical', 'music-festival'],
  festival: ['music-festival', 'food-festival'],
  'sports-event': ['motorsport'],
  theatre: ['dance', 'comedy'],
  party: ['electronic'],
};

/** Expand umbrella categories ("concert" → also classical, jazz, rock …). */
export function expandCategories(slugs: readonly string[]): string[] {
  return [...new Set(slugs.flatMap((s) => [s, ...(CATEGORY_UMBRELLAS[s] ?? [])]))];
}

// ── Vibes, feed buckets, seasons ───────────────────────────────────────────

const V: Record<string, Vibe[]> = {
  karting: ['outdoor', 'extreme', 'adventure', 'social'], paintball: ['outdoor', 'extreme', 'adventure', 'social'], 'laser-tag': ['indoor', 'adventure', 'social', 'family'],
  climbing: ['indoor', 'sports', 'adventure', 'extreme'], zipline: ['outdoor', 'extreme', 'adventure', 'family'], 'horse-riding': ['outdoor', 'adventure', 'relaxing', 'family'],
  'air-sports': ['outdoor', 'extreme', 'adventure'], 'escape-room': ['indoor', 'adventure', 'social'], 'vr-arcade': ['indoor', 'social'], tours: ['outdoor', 'adventure', 'social'],
  'boat-trip': ['outdoor', 'relaxing', 'social', 'family'], diving: ['outdoor', 'adventure', 'sports', 'extreme'], surfing: ['outdoor', 'sports', 'adventure', 'extreme'], sailing: ['outdoor', 'sports', 'adventure'],
  fishing: ['outdoor', 'relaxing'], 'water-park': ['outdoor', 'family', 'social'], 'swimming-pool': ['sports', 'relaxing', 'family'], marina: ['outdoor', 'relaxing'],
  gym: ['indoor', 'sports'], crossfit: ['indoor', 'sports'], 'martial-arts': ['indoor', 'sports'], 'racket-sports': ['sports', 'social'], 'sports-courts': ['outdoor', 'sports', 'social'],
  skatepark: ['outdoor', 'sports', 'extreme'], 'yoga-studio': ['indoor', 'relaxing', 'sports'], 'dance-studio': ['indoor', 'social', 'sports'], 'sports-club': ['sports', 'social'], cycling: ['outdoor', 'sports'],
  hiking: ['outdoor', 'sports', 'adventure'], beach: ['outdoor', 'relaxing', 'family'], park: ['outdoor', 'relaxing', 'family'], viewpoint: ['outdoor', 'relaxing'], campsite: ['outdoor', 'adventure'],
  'nature-reserve': ['outdoor', 'relaxing', 'adventure'], waterfall: ['outdoor', 'adventure', 'relaxing'], cave: ['outdoor', 'adventure'], garden: ['outdoor', 'relaxing', 'family'],
  birdwatching: ['outdoor', 'relaxing'], picnic: ['outdoor', 'relaxing', 'family', 'social'], bowling: ['indoor', 'social', 'family'], billiards: ['indoor', 'social'], arcade: ['indoor', 'social', 'family'],
  'trampoline-park': ['indoor', 'family', 'sports'], 'amusement-park': ['outdoor', 'family', 'social'], cinema: ['indoor', 'relaxing', 'social'], 'live-music-venue': ['indoor', 'social'],
  'performing-arts': ['indoor', 'social'], nightclub: ['indoor', 'social'], 'board-games': ['indoor', 'social', 'relaxing'], 'community-centre': ['indoor', 'social'],
  'creative-workshop': ['indoor', 'social', 'relaxing'], spa: ['indoor', 'relaxing'], 'zoo-aquarium': ['family', 'relaxing'], playground: ['outdoor', 'family'], 'kids-play': ['indoor', 'family'],
  'science-centre': ['indoor', 'family'], museum: ['indoor', 'relaxing'], 'art-gallery': ['indoor', 'relaxing'], 'historic-site': ['outdoor', 'relaxing'], 'religious-site': ['relaxing'],
  winery: ['relaxing', 'social'], 'farmers-market': ['outdoor', 'social'], 'second-hand': ['indoor'], 'local-shops': ['indoor'], 'shopping-mall': ['indoor', 'family'],
};
const B: Partial<Record<InterestGroup, FeedBucket>> = {
  food: 'food', nightlife: 'events_nightlife', music: 'events_nightlife', adventure: 'active', nature: 'nature', sports: 'sports', shopping: 'shopping',
  culture: 'culture', art: 'culture', family: 'entertainment', technology: 'entertainment', wellness: 'sports',
};
const BUCKET_OVERRIDE: Record<string, FeedBucket> = {
  bowling: 'entertainment', billiards: 'entertainment', cinema: 'entertainment', casino: 'entertainment', 'performing-arts': 'entertainment', 'board-games': 'entertainment',
  'escape-room': 'active', 'laser-tag': 'active', 'water-park': 'active', 'amusement-park': 'entertainment', 'trampoline-park': 'entertainment', arcade: 'entertainment', 'vr-arcade': 'entertainment',
  marina: 'nature', fishing: 'nature', 'swimming-pool': 'sports', spa: 'culture', 'beauty-salon': 'shopping', barbershop: 'shopping',
};
const SEASON: Record<string, [number, number]> = { 'water-park': [5, 10], 'boat-trip': [4, 11], surfing: [5, 10], sailing: [4, 11], 'air-sports': [3, 11], zipline: [3, 11] };
for (const def of CATEGORIES) {
  def.vibes = V[def.slug];
  def.bucket = def.kind === 'event' && ['music', 'nightlife'].includes(def.group) ? 'events_nightlife' : BUCKET_OVERRIDE[def.slug] ?? B[def.group];
  if (SEASON[def.slug]) def.seasonMonths = SEASON[def.slug];
}

/** True when a seasonal category is outside its usual months on this date (Cyprus). */
export function outOfSeason(slug: string, month: number): boolean {
  const m = getCategory(slug)?.seasonMonths;
  return !!m && (month < m[0] || month > m[1]);
}
