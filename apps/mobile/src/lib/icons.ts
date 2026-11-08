import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Category icon keys (from @passtra/core) → MaterialCommunityIcons glyphs. Validated by scripts/check-icons.mjs. */
export const CATEGORY_ICON: Record<string, IconName> = {
  music: 'music-note', festival: 'party-popper', party: 'glass-cocktail', guitar: 'guitar-electric', waveform: 'waveform', sax: 'saxophone',
  violin: 'violin', frame: 'image-frame', masks: 'drama-masks', dance: 'human-female-dance', smile: 'emoticon-happy-outline', film: 'filmstrip',
  trophy: 'trophy-outline', car: 'car-sports', wine: 'glass-wine', tent: 'tent', sparkles: 'creation', balloon: 'balloon', wrench: 'wrench-outline',
  chip: 'chip', lotus: 'meditation', calendar: 'calendar-star', utensils: 'silverware-fork-knife', coffee: 'coffee-outline', croissant: 'food-croissant',
  burger: 'hamburger', icecream: 'ice-cream', grapes: 'fruit-grapes', cocktail: 'glass-cocktail', beer: 'glass-mug-variant', disco: 'speaker',
  dice: 'dice-5-outline', billiards: 'billiards', mic: 'microphone-variant', bag: 'shopping-outline', cart: 'cart-outline', basket: 'basket-outline',
  shirt: 'tshirt-crew-outline', sneaker: 'shoe-sneaker', book: 'book-open-variant', phone: 'cellphone', sparkle: 'shimmer', scissors: 'content-cut',
  dumbbell: 'dumbbell', laptop: 'laptop', flag: 'flag-checkered', bowling: 'bowling', water: 'waves', ferris: 'ferris-wheel', key: 'key-variant',
  vr: 'virtual-reality', boat: 'sail-boat', diving: 'diving-scuba', surf: 'surfing', hiking: 'hiking', bike: 'bike', beach: 'beach', tree: 'pine-tree',
  binoculars: 'binoculars', museum: 'bank-outline', columns: 'pillar', church: 'church', palette: 'palette-outline', fish: 'fish', swing: 'seesaw',
  anchor: 'anchor', pill: 'pill', hospital: 'hospital-box-outline', stethoscope: 'stethoscope', tooth: 'tooth-outline', cash: 'cash-multiple',
  bank: 'bank', carwash: 'car-wash', fuel: 'gas-station', bolt: 'ev-station', mail: 'email-outline', shield: 'shield-outline', paw: 'paw',
};

export const iconFor = (key: string | undefined): IconName => (key && CATEGORY_ICON[key]) || 'map-marker-outline';
