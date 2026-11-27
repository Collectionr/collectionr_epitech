import { describe, expect, it } from 'vitest';

import { formatPercentChange, formatPrice, formatPriceForSpeech } from './formatPrice';

/** Séparateur de milliers de `Intl` en fr-FR : espace fine insécable. */
const THOUSANDS = '\u202F';
/** Espace insécable : avant « EUR », « euros » et « % ». */
const NO_BREAK = '\u00A0';

describe('formatPrice', () => {
  it.each([
    [12.4, `12,40${NO_BREAK}EUR`],
    [0.5, `0,50${NO_BREAK}EUR`],
    [1240.5, `1${THOUSANDS}240,50${NO_BREAK}EUR`],
    [1234567.891, `1${THOUSANDS}234${THOUSANDS}567,89${NO_BREAK}EUR`],
  ])('affiche %d comme %s', (amount, expected) => {
    expect(formatPrice(amount)).toBe(expected);
  });

  it('lit la devise en toutes lettres pour un lecteur d’écran', () => {
    expect(formatPriceForSpeech(12.4)).toBe(`12,40${NO_BREAK}euros`);
  });
});

describe('formatPercentChange', () => {
  it.each([
    [0.032, `3,2${NO_BREAK}%`],
    [-0.032, `3,2${NO_BREAK}%`],
    [0.5, `50${NO_BREAK}%`],
  ])('affiche la variation %d sans signe (%s)', (change, expected) => {
    expect(formatPercentChange(change)).toBe(expected);
  });
});
