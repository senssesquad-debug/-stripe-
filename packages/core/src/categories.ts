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
}

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
    [['gym', 'fitness', 'crossfit', 'workout', 'yoga studio'], ['γυμναστηρ', 'fitness', 'κροσφιτ'], ['спортзал', 'фитнес', 'тренажер', 'кроссфит', 'качалк']],
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
    [['boat trip', 'boat tour', 'cruise', 'yacht', 'catamaran', 'boat rental', 'glass bottom'], ['κρουαζιερ', 'βαρκ', 'σκαφ', 'γιοτ'], ['морск прогулк', 'яхт', 'катер', 'катамаран', 'лодк']],
    { osm: [{ amenity: 'boat_rental' }, { tourism: 'attraction', boat: 'yes' }], visitMinutes: 180, outdoor: true, dayParts: DAYTIME }),
  c('diving', 'place', 'adventure', 'diving', ['Diving & snorkelling', 'Καταδύσεις', 'Дайвинг'],
    [['diving', 'scuba', 'snorkel', 'dive'], ['καταδυσ', 'scuba'], ['дайвинг', 'снорк', 'погружен']],
    { osm: [{ shop: 'scuba_diving' }, { sport: 'scuba_diving' }], visitMinutes: 180, outdoor: true, dayParts: DAYTIME }),
  c('surfing', 'place', 'adventure', 'surf', ['Surf, kite & windsurf', 'Surf, kite & windsurf', 'Серфинг и кайт'],
    [['surf', 'kitesurf', 'windsurf', 'sup', 'paddle board', 'water sports'], ['σερφ', 'θαλασσια σπορ'], ['серф', 'кайт', 'виндсерф', 'сап', 'водн спорт']],
    { osm: [{ sport: 'surfing' }, { sport: 'kitesurfing' }, { sport: 'windsurfing' }, { shop: 'surf' }], visitMinutes: 150, outdoor: true, dayParts: DAYTIME }),
  c('hiking', 'place', 'nature', 'hiking', ['Hiking trails', 'Μονοπάτια πεζοπορίας', 'Пешие маршруты'],
    [['hike', 'hiking', 'trail', 'trek', 'nature trail', 'walk'], ['πεζοπορ', 'μονοπατ', 'περιπατ'], ['пеш маршрут', 'поход', 'хайкинг', 'тропа', 'троп', 'треккинг', 'прогулк']],
    { osm: [{ route: 'hiking' }, { highway: 'trailhead' }], osmRequireAny: ['name'], google: ['hiking_area'], visitMinutes: 150, outdoor: true, usuallyFree: true, dayParts: DAYTIME }),
  c('cycling', 'place', 'sports', 'bike', ['Cycling', 'Ποδηλασία', 'Велосипед'],
    [['cycling', 'bike', 'bicycle', 'mtb', 'bike rental'], ['ποδηλατ'], ['велосипед', 'вело', 'байк']],
    { osm: [{ route: 'bicycle' }, { route: 'mtb' }, { amenity: 'bicycle_rental' }], osmRequireAny: ['name'], visitMinutes: 120, outdoor: true, dayParts: DAYTIME }),
  c('beach', 'place', 'nature', 'beach', ['Beaches', 'Παραλίες', 'Пляжи'],
    [['beach', 'swim', 'swimming', 'sea'], ['παραλ', 'κολυμπ', 'θαλασσ'], ['пляж', 'купат', 'море', 'моря']],
    { osm: [{ natural: 'beach' }], osmRequireAny: ['name'], google: ['beach'], visitMinutes: 150, outdoor: true, usuallyFree: true, dayParts: DAYTIME }),
  c('park', 'place', 'nature', 'tree', ['Parks & nature', 'Πάρκα & φύση', 'Парки и природа'],
    [['park', 'nature', 'garden', 'forest', 'nature reserve', 'national park'], ['παρκο', 'κηπ', 'δασ', 'φυσ'], ['парк', 'природ', 'сад', 'лес', 'заповедник']],
    { osm: [{ leisure: 'park' }, { leisure: 'nature_reserve' }, { boundary: 'national_park' }, { leisure: 'garden', garden_type: 'botanical' }], osmRequireAny: ['name'], google: ['park', 'national_park', 'botanical_garden'], visitMinutes: 60, outdoor: true, usuallyFree: true }),
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
