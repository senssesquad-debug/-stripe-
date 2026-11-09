import { getCategory, groupOf, type FeedBucket, type InterestGroup, type Vibe } from './categories';
import type { LocalizedText } from './locales';
import type { Candidate, Scored } from './ranking';

/**
 * "What can I do?" — concrete things to do, each backed by real places or events of the listed categories.
 * An idea is only shown when there are real options for it nearby.
 */
export interface ActivityIdea {
  key: string;
  label: LocalizedText;
  icon: string;
  categories: string[];
  vibes: Vibe[];
}

const a = (key: string, icon: string, label: [string, string, string], categories: string[], vibes: Vibe[]): ActivityIdea =>
  ({ key, icon, label: { en: label[0], el: label[1], ru: label[2] }, categories, vibes });

export const ACTIVITY_IDEAS: ActivityIdea[] = [
  a('karting', 'flag', ['Go karting', 'Οδηγήστε καρτ', 'Покататься на картинге'], ['karting'], ['outdoor', 'extreme', 'adventure', 'social']),
  a('scuba', 'diving', ['Try scuba diving or snorkelling', 'Δοκιμάστε κατάδυση', 'Попробовать дайвинг или снорклинг'], ['diving'], ['outdoor', 'adventure', 'sports', 'extreme']),
  a('escape-room', 'key', ['Solve an escape room', 'Λύστε ένα escape room', 'Пройти квест'], ['escape-room'], ['indoor', 'adventure', 'social']),
  a('hike', 'hiking', ['Go hiking', 'Πάτε πεζοπορία', 'Сходить в поход'], ['hiking', 'nature-reserve'], ['outdoor', 'sports', 'adventure']),
  a('racket', 'tennis', ['Play padel or tennis', 'Παίξτε padel ή τένις', 'Сыграть в падел или теннис'], ['racket-sports'], ['sports', 'social']),
  a('water-sports', 'surf', ['Rent a jet ski, kayak or SUP', 'Νοικιάστε jet ski, καγιάκ ή SUP', 'Взять гидроцикл, каяк или сап'], ['surfing'], ['outdoor', 'sports', 'adventure', 'extreme']),
  a('adventure-park', 'zip', ['Visit an adventure park or zipline', 'Πάρκο περιπέτειας ή zipline', 'Сходить в парк приключений или на зиплайн'], ['zipline'], ['outdoor', 'extreme', 'adventure', 'family']),
  a('bowling', 'bowling', ['Go bowling', 'Παίξτε μπόουλινγκ', 'Сыграть в боулинг'], ['bowling'], ['indoor', 'social', 'family']),
  a('nature', 'terrain', ['Explore a nature trail, waterfall or cave', 'Εξερευνήστε φύση, καταρράκτη ή σπηλιά', 'Исследовать тропу, водопад или пещеру'], ['nature-reserve', 'waterfall', 'cave', 'garden'], ['outdoor', 'adventure', 'relaxing']),
  a('concert', 'music', ['Attend a live concert', 'Πάτε σε συναυλία', 'Сходить на концерт'], ['concert', 'music-festival', 'jazz-blues', 'rock-metal', 'electronic', 'classical', 'live-music-venue'], ['social']),
  a('boat', 'boat', ['Take a boat trip', 'Κάντε βόλτα με σκάφος', 'Морская прогулка'], ['boat-trip', 'sailing'], ['outdoor', 'relaxing', 'social', 'family']),
  a('paintball', 'target', ['Play paintball or laser tag', 'Paintball ή laser tag', 'Пейнтбол или лазертаг'], ['paintball', 'laser-tag'], ['extreme', 'adventure', 'social']),
  a('climbing', 'climb', ['Go climbing or bouldering', 'Αναρρίχηση', 'Скалолазание или боулдеринг'], ['climbing'], ['sports', 'adventure', 'extreme']),
  a('horse', 'horse', ['Go horse riding', 'Ιππασία', 'Конная прогулка'], ['horse-riding'], ['outdoor', 'adventure', 'family']),
  a('fly', 'paraglide', ['Paraglide or skydive', 'Αλεξίπτωτο πλαγιάς ή ελεύθερη πτώση', 'Полетать на параплане или прыгнуть с парашютом'], ['air-sports'], ['outdoor', 'extreme', 'adventure']),
  a('safari', 'compass', ['Jeep, quad or buggy safari', 'Σαφάρι με τζιπ, γουρούνα ή buggy', 'Сафари на джипе, квадроцикле или багги'], ['tours'], ['outdoor', 'adventure', 'extreme', 'social']),
  a('water-park', 'water', ['Spend the day at a water park', 'Μέρα σε υδάτινο πάρκο', 'Провести день в аквапарке'], ['water-park'], ['outdoor', 'family', 'social']),
  a('swim', 'swim', ['Go for a swim', 'Πάτε για κολύμπι', 'Поплавать'], ['swimming-pool', 'beach'], ['sports', 'relaxing', 'outdoor']),
  a('beach', 'beach', ['Relax on a beach', 'Χαλαρώστε σε παραλία', 'Отдохнуть на пляже'], ['beach'], ['outdoor', 'relaxing', 'family']),
  a('cycle', 'bike', ['Ride a bike route', 'Ποδηλατική διαδρομή', 'Прокатиться на велосипеде'], ['cycling'], ['outdoor', 'sports']),
  a('workout', 'dumbbell', ['Work out: gym, CrossFit or martial arts', 'Γυμναστική: γυμναστήριο, CrossFit, πολεμικές τέχνες', 'Тренировка: зал, кроссфит или единоборства'], ['gym', 'crossfit', 'martial-arts'], ['indoor', 'sports']),
  a('yoga', 'lotus', ['Join a yoga or pilates class', 'Μάθημα γιόγκα ή πιλάτες', 'Йога или пилатес'], ['yoga-studio', 'wellness-event'], ['indoor', 'relaxing', 'sports']),
  a('dance', 'dance', ['Take a dance class or go dancing', 'Χορός', 'Потанцевать или сходить на урок танцев'], ['dance-studio', 'dance'], ['social', 'indoor']),
  a('play-sport', 'ball', ['Play basketball, football or volleyball', 'Μπάσκετ, ποδόσφαιρο ή βόλεϊ', 'Сыграть в баскетбол, футбол или волейбол'], ['sports-courts', 'skatepark'], ['outdoor', 'sports', 'social']),
  a('games', 'gamepad', ['Arcade, VR or board games', 'Ηλεκτρονικά, VR ή επιτραπέζια', 'Игровые автоматы, VR или настолки'], ['arcade', 'vr-arcade', 'board-games', 'billiards'], ['indoor', 'social']),
  a('trampoline', 'jump', ['Bounce at a trampoline park', 'Πάρκο τραμπολίνο', 'Попрыгать в батутном парке'], ['trampoline-park'], ['indoor', 'family', 'sports']),
  a('movie', 'film', ['Catch a movie', 'Δείτε ταινία', 'Сходить в кино'], ['cinema', 'film-screening'], ['indoor', 'relaxing', 'social']),
  a('show', 'masks', ['See a play, show or stand-up', 'Δείτε παράσταση ή stand-up', 'Спектакль, шоу или стендап'], ['theatre', 'comedy', 'performing-arts'], ['indoor', 'social']),
  a('culture', 'museum', ['Visit a museum or gallery', 'Μουσείο ή γκαλερί', 'Музей или галерея'], ['museum', 'art-gallery', 'exhibition', 'science-centre'], ['indoor', 'relaxing', 'family']),
  a('history', 'columns', ['Explore a historic site', 'Ιστορικό μνημείο', 'Исторические места'], ['historic-site', 'religious-site'], ['outdoor', 'relaxing']),
  a('workshop', 'brush', ['Join a creative workshop', 'Δημιουργικό εργαστήρι', 'Творческий мастер-класс'], ['creative-workshop', 'workshop'], ['indoor', 'social', 'relaxing']),
  a('meet', 'people', ['Meet people: meetups and social clubs', 'Γνωριμίες: meetups και σύλλογοι', 'Знакомства: митапы и клубы'], ['community-centre', 'community-event', 'tech-meetup', 'sports-club'], ['social']),
  a('market', 'basket', ['Browse a market or vintage shops', 'Αγορές και vintage', 'Рынки и винтаж'], ['farmers-market', 'fair', 'second-hand', 'local-shops'], ['social', 'outdoor']),
  a('kids', 'child', ['Fun for kids', 'Για παιδιά', 'Развлечения для детей'], ['playground', 'kids-play', 'zoo-aquarium', 'amusement-park', 'kids-event'], ['family']),
  a('wine', 'grapes', ['Go wine tasting', 'Οινογνωσία', 'Дегустация вина'], ['winery'], ['relaxing', 'social']),
  a('spa', 'lotus', ['Unwind at a spa', 'Χαλάρωση σε σπα', 'Расслабиться в спа'], ['spa'], ['indoor', 'relaxing']),
  a('picnic', 'picnic', ['Have a picnic or watch birds', 'Πικνίκ ή παρατήρηση πουλιών', 'Пикник или наблюдение за птицами'], ['picnic', 'birdwatching', 'park'], ['outdoor', 'relaxing', 'family']),
  a('sports-event', 'trophy', ['Watch a match or race', 'Δείτε αγώνα', 'Посмотреть матч или гонку'], ['sports-event', 'motorsport'], ['social', 'sports']),
  a('nightlife', 'party', ['Go out: party or live DJ', 'Έξοδος: πάρτι ή DJ', 'Вечеринка или диджей'], ['party', 'nightclub'], ['social']),
  a('festival', 'festival', ['Go to a festival', 'Πάτε σε φεστιβάλ', 'Сходить на фестиваль'], ['festival', 'food-festival', 'music-festival'], ['outdoor', 'social', 'family']),
];

export const getActivityIdea = (key: string) => ACTIVITY_IDEAS.find((x) => x.key === key);

// ── Balanced feed ──────────────────────────────────────────────────────────────────────────────────────────

/** Starting shares of the home feed per bucket (the user's interests and what actually exists nearby adjust them). */
export const FEED_TARGETS: Record<FeedBucket, number> = {
  food: 0.15, active: 0.2, entertainment: 0.15, events_nightlife: 0.15, nature: 0.15, sports: 0.1, shopping: 0.05, culture: 0.05,
};

const BUCKET_OF_GROUP: Partial<Record<InterestGroup, FeedBucket>> = {
  food: 'food', adventure: 'active', family: 'entertainment', technology: 'entertainment', music: 'events_nightlife', nightlife: 'events_nightlife',
  nature: 'nature', sports: 'sports', wellness: 'sports', shopping: 'shopping', culture: 'culture', art: 'culture',
};

export const bucketOf = (slug: string | undefined): FeedBucket => (slug ? getCategory(slug)?.bucket ?? BUCKET_OF_GROUP[groupOf(slug) ?? 'culture'] ?? 'culture' : 'culture');

/**
 * Re-orders ranked items so each bucket gets roughly its share (interests raise a bucket's share), never three
 * items of the same bucket in a row and no two food places in a row while anything else is left. Within a bucket
 * the best-scored item comes first. Buckets with nothing nearby simply drop out.
 */
export function balance<C extends Candidate>(scored: Scored<C>[], limit: number, interests: InterestGroup[] = [], targets = FEED_TARGETS): Scored<C>[] {
  const share: Record<string, number> = { ...targets };
  for (const g of interests) { const b = BUCKET_OF_GROUP[g]; if (b) share[b] = (share[b] ?? 0) * 1.6 + 0.05; }
  const queues = new Map<FeedBucket, Scored<C>[]>();
  for (const s of [...scored].sort((x, y) => y.score - x.score)) {
    const b = bucketOf(s.item.categories[0]);
    if (!queues.has(b)) queues.set(b, []);
    queues.get(b)!.push(s);
  }
  const out: Scored<C>[] = [];
  const count = new Map<FeedBucket, number>();
  const recent: FeedBucket[] = [];
  while (out.length < limit) {
    const avail = [...queues.entries()].filter(([, q]) => q.length).map(([b]) => b);
    if (!avail.length) break;
    const total = avail.reduce((t, b) => t + (share[b] ?? 0.05), 0);
    const ok = (b: FeedBucket) => {
      if (avail.length === 1) return true;
      if (recent.length >= 2 && recent.at(-1) === b && recent.at(-2) === b) return false;
      if (b === 'food' && recent.at(-1) === 'food') return false;
      return true;
    };
    const candidates = avail.filter(ok);
    const pool = candidates.length ? candidates : avail;
    // Largest deficit against the target share wins; the best item's score breaks ties.
    let best = pool[0]!;
    let bestVal = -Infinity;
    for (const b of pool) {
      const want = ((share[b] ?? 0.05) / total) * (out.length + 1);
      const val = want - (count.get(b) ?? 0) + queues.get(b)![0]!.score * 0.01;
      if (val > bestVal) { bestVal = val; best = b; }
    }
    out.push(queues.get(best)!.shift()!);
    count.set(best, (count.get(best) ?? 0) + 1);
    recent.push(best);
  }
  return out;
}
