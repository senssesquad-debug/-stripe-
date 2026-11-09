import { describe, expect, it } from 'vitest';
import { validateDisplayName } from '../src/names';

describe('display names', () => {
  it.each(['Anna', 'Μαρία Παπαδοπούλου', 'Сергей Иванов', "O'Neil", 'Jean-Luc', 'Ann'])('accepts %s', (n) => expect(validateDisplayName(n).ok).toBe(true));
  it('trims and collapses spaces', () => expect(validateDisplayName('  Anna    Maria ')).toEqual({ ok: true, name: 'Anna Maria' }));
  it.each([
    ['A', 'too_short'], ['Al', 'too_short'], ['  Ал  ', 'too_short'], ['x'.repeat(41), 'too_long'],
    ['Anna<script>', 'invalid_chars'], ['Anna_99', 'invalid_chars'], ['🙂🙂🙂', 'invalid_chars'],
    ['www.cheap.com', 'spam'], ['Call 99123456', 'spam'], ['Annnnnna', 'spam'],
    ['Admin', 'reserved'], ['Passtra Support', 'reserved'], ['Модератор', 'reserved'], ['Διαχειριστής', 'reserved'], ['passtra team', 'reserved'],
    ['Fuck You', 'offensive'], ['сука', 'offensive'], ['Μαλάκας Πούστης', 'offensive'],
  ])('rejects %s (%s)', (n, err) => expect(validateDisplayName(n)).toEqual({ ok: false, error: err }));
});
