/**
 * Formatage des prix et de leur variation, commun au web et au mobile (design-system.md, « Prix et
 * valeurs monétaires ») : `1 240,50 EUR`, virgule décimale, espaces insécables, `EUR` après le montant.
 */

const LOCALE = 'fr-FR';
/** Espace insécable entre le montant et la devise. */
const NO_BREAK_SPACE = '\u00A0';

const amountFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormat = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  maximumFractionDigits: 1,
});

/**
 * Montant affiché : « 1 240,50 EUR » (séparateur de milliers insécable fourni par `Intl`).
 * @param amount - Montant en euros
 */
export function formatPrice(amount: number): string {
  return `${amountFormat.format(amount)}${NO_BREAK_SPACE}EUR`;
}

/**
 * Montant lu par un lecteur d'écran : « 12,40 euros » (« EUR » serait épelé).
 * @param amount - Montant en euros
 */
export function formatPriceForSpeech(amount: number): string {
  return `${amountFormat.format(amount)}${NO_BREAK_SPACE}euros`;
}

/**
 * Variation en pourcentage, sans signe : « 3,2 % ». Le sens (hausse, baisse) est porté à part.
 * @param change - Variation relative (0,032 pour 3,2 %)
 */
export function formatPercentChange(change: number): string {
  return percentFormat.format(Math.abs(change));
}
