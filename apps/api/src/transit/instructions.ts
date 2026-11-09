import type { Locale } from '@passtra/core';

/** Turn-by-turn text from OSRM maneuvers, in en / el / ru. */
type M = { type: string; modifier?: string; exit?: number };
const DIR: Record<Locale, Record<string, string>> = {
  en: { left: 'left', right: 'right', 'slight left': 'slightly left', 'slight right': 'slightly right', 'sharp left': 'sharp left', 'sharp right': 'sharp right', straight: 'straight', uturn: 'a U-turn' },
  el: { left: 'αριστερά', right: 'δεξιά', 'slight left': 'ελαφρώς αριστερά', 'slight right': 'ελαφρώς δεξιά', 'sharp left': 'απότομα αριστερά', 'sharp right': 'απότομα δεξιά', straight: 'ευθεία', uturn: 'αναστροφή' },
  ru: { left: 'налево', right: 'направо', 'slight left': 'плавно налево', 'slight right': 'плавно направо', 'sharp left': 'резко налево', 'sharp right': 'резко направо', straight: 'прямо', uturn: 'разворот' },
};
const T: Record<Locale, { depart: string; arrive: string; turn: string; cont: string; round: string; onto: string; fork: string; end: string }> = {
  en: { depart: 'Head out', arrive: 'You have arrived', turn: 'Turn {d}', cont: 'Continue {d}', round: 'At the roundabout take exit {n}', onto: ' onto {s}', fork: 'Keep {d} at the fork', end: 'At the end of the road turn {d}' },
  el: { depart: 'Ξεκινήστε', arrive: 'Φτάσατε', turn: 'Στρίψτε {d}', cont: 'Συνεχίστε {d}', round: 'Στον κυκλικό κόμβο πάρτε την {n}η έξοδο', onto: ' στην {s}', fork: 'Κρατηθείτε {d} στη διχάλα', end: 'Στο τέλος του δρόμου στρίψτε {d}' },
  ru: { depart: 'Начните движение', arrive: 'Вы на месте', turn: 'Поверните {d}', cont: 'Продолжайте {d}', round: 'На круговом движении — {n}-й съезд', onto: ' на {s}', fork: 'На развилке держитесь {d}', end: 'В конце дороги поверните {d}' },
};

export function instruction(m: M, street: string, locale: Locale): string | null {
  const t = T[locale];
  const d = DIR[locale][m.modifier ?? 'straight'] ?? m.modifier ?? '';
  const onto = street ? t.onto.replace('{s}', street) : '';
  switch (m.type) {
    case 'depart': return t.depart + onto;
    case 'arrive': return t.arrive;
    case 'roundabout': case 'rotary': case 'roundabout turn': return t.round.replace('{n}', String(m.exit ?? 1)) + onto;
    case 'fork': return t.fork.replace('{d}', d) + onto;
    case 'end of road': return t.end.replace('{d}', d) + onto;
    case 'new name': case 'continue': case 'notification': return m.modifier && m.modifier !== 'straight' ? t.turn.replace('{d}', d) + onto : street ? t.cont.replace('{d}', d) + onto : null;
    default: return m.modifier === 'straight' ? t.cont.replace('{d}', d) + onto : t.turn.replace('{d}', d) + onto; // turn, merge, on/off ramp…
  }
}
