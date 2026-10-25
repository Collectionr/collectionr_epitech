import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Reads the versioned TCGdex responses (prisma/fixtures/tcgdex) and turns them into the rows of the
// catalogue tables. Pure and framework-free so the mapping can be unit-tested without a database.

export type FixtureLanguage = 'en' | 'fr';

export interface TcgdexLegality {
  standard: boolean | null;
  expanded: boolean | null;
}

export interface TcgdexSet {
  id: string;
  name: string;
  releaseDate: string | null;
  logo: string | null;
  symbol: string | null;
  serie: { id: string; name: string } | null;
  abbreviationOfficial: string | null;
  abbreviationLocalized: string | null;
  tcgOnline: string | null;
  officialCardCount: number;
  totalCardCount: number;
  normalCardCount: number | null;
  reverseCardCount: number | null;
  holoCardCount: number | null;
  firstEditionCardCount: number | null;
  legal: TcgdexLegality;
}

export interface TcgdexVariant {
  variantId: string;
  type: string;
  subtype: string | null;
  size: string;
  stamps: string[];
  foil: string | null;
  cardmarketProductId: number | null;
  tcgplayerProductId: number | null;
  cardtraderProductId: number | null;
}

export interface TcgdexCard {
  id: string;
  localId: string;
  name: string;
  category: string;
  rarity: string | null;
  illustrator: string | null;
  hp: number | null;
  types: string[];
  dexIds: number[];
  evolveFrom: string | null;
  stage: string | null;
  suffix: string | null;
  trainerType: string | null;
  energyType: string | null;
  regulationMark: string | null;
  legal: TcgdexLegality;
  hasNormal: boolean;
  hasReverse: boolean;
  hasHolo: boolean;
  hasFirstEdition: boolean;
  hasWPromo: boolean;
  updated: string | null;
  image: string | null;
  variantsDetailed: TcgdexVariant[];
}

export interface TcgdexFixture {
  set: TcgdexSet;
  cards: TcgdexCard[];
}

export interface CatalogueSetRow {
  tcgdexId: string;
  nameEn: string;
  nameFr: string | null;
  serieTcgdexId: string | null;
  serieNameEn: string | null;
  serieNameFr: string | null;
  releaseDate: Date | null;
  abbreviationOfficial: string | null;
  abbreviationFr: string | null;
  tcgOnlineCode: string | null;
  officialCardCount: number;
  totalCardCount: number;
  normalCardCount: number | null;
  reverseCardCount: number | null;
  holoCardCount: number | null;
  firstEditionCardCount: number | null;
  legalStandard: boolean | null;
  legalExpanded: boolean | null;
  logoUrlEn: string | null;
  logoUrlFr: string | null;
  symbolUrl: string | null;
}

export interface CatalogueCardRow {
  tcgdexId: string;
  number: string;
  nameEn: string;
  nameFr: string | null;
  categoryEn: string;
  categoryFr: string | null;
  rarityEn: string | null;
  rarityFr: string | null;
  illustrator: string | null;
  hp: number | null;
  typesEn: string[];
  typesFr: string[];
  dexIds: number[];
  evolveFromEn: string | null;
  evolveFromFr: string | null;
  stageEn: string | null;
  stageFr: string | null;
  suffix: string | null;
  trainerTypeEn: string | null;
  trainerTypeFr: string | null;
  energyTypeEn: string | null;
  energyTypeFr: string | null;
  regulationMark: string | null;
  legalStandard: boolean | null;
  legalExpanded: boolean | null;
  hasNormal: boolean;
  hasReverse: boolean;
  hasHolo: boolean;
  hasFirstEdition: boolean;
  hasWPromo: boolean;
  tcgdexUpdatedAt: Date | null;
  imageUrlEn: string | null;
  imageUrlFr: string | null;
}

export interface CatalogueVariantRow {
  cardTcgdexId: string;
  tcgdexVariantId: string;
  type: string;
  subtype: string | null;
  size: string;
  stamps: string[];
  foil: string | null;
  cardmarketProductId: number | null;
  tcgplayerProductId: number | null;
  cardtraderProductId: number | null;
}

export interface CatalogueSetData {
  set: CatalogueSetRow;
  cards: CatalogueCardRow[];
  variants: CatalogueVariantRow[];
}

/** The three TCGdex sets of the reference catalogue: different eras, id formats and rarity wordings. */
export const REFERENCE_SET_IDS = ['base1', 'swsh3', 'sv03.5'] as const;

const FIXTURES_DIRECTORY = join(__dirname, '..', 'fixtures', 'tcgdex');

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, context: string): JsonRecord {
  if (!isRecord(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value;
}

function optionalRecord(record: JsonRecord, key: string, context: string): JsonRecord | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }
  return requireRecord(value, `${context}.${key}`);
}

function requireString(record: JsonRecord, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${context}.${key} must be a non-empty string`);
  }
  return value;
}

function optionalString(record: JsonRecord, key: string, context: string): string | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`${context}.${key} must be a string when present`);
  }
  return value;
}

function requireInteger(record: JsonRecord, key: string, context: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${context}.${key} must be an integer`);
  }
  return value;
}

function optionalInteger(record: JsonRecord, key: string, context: string): number | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }
  return requireInteger(record, key, context);
}

function optionalBoolean(record: JsonRecord, key: string, context: string): boolean | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'boolean') {
    throw new Error(`${context}.${key} must be a boolean when present`);
  }
  return value;
}

function optionalStringArray(record: JsonRecord, key: string, context: string): string[] {
  const value = record[key];
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')) {
    throw new Error(`${context}.${key} must be an array of strings when present`);
  }
  return value;
}

function optionalIntegerArray(record: JsonRecord, key: string, context: string): number[] {
  const value = record[key];
  if (value === undefined || value === null) {
    return [];
  }
  if (
    !Array.isArray(value) ||
    !value.every((item): item is number => typeof item === 'number' && Number.isInteger(item))
  ) {
    throw new Error(`${context}.${key} must be an array of integers when present`);
  }
  return value;
}

function parseLegality(record: JsonRecord, context: string): TcgdexLegality {
  const legal = optionalRecord(record, 'legal', context);
  return {
    standard: legal ? optionalBoolean(legal, 'standard', `${context}.legal`) : null,
    expanded: legal ? optionalBoolean(legal, 'expanded', `${context}.legal`) : null,
  };
}

function parseSerie(set: JsonRecord, context: string): TcgdexSet['serie'] {
  const serie = optionalRecord(set, 'serie', context);
  if (!serie) {
    return null;
  }
  return {
    id: requireString(serie, 'id', `${context}.serie`),
    name: requireString(serie, 'name', `${context}.serie`),
  };
}

function parseSet(raw: unknown): TcgdexSet {
  const context = 'set';
  const set = requireRecord(raw, context);
  const cardCount = requireRecord(set['cardCount'], `${context}.cardCount`);
  const abbreviation = optionalRecord(set, 'abbreviation', context);
  return {
    id: requireString(set, 'id', context),
    name: requireString(set, 'name', context),
    releaseDate: optionalString(set, 'releaseDate', context),
    logo: optionalString(set, 'logo', context),
    symbol: optionalString(set, 'symbol', context),
    serie: parseSerie(set, context),
    abbreviationOfficial: abbreviation
      ? optionalString(abbreviation, 'official', `${context}.abbreviation`)
      : null,
    abbreviationLocalized: abbreviation
      ? optionalString(abbreviation, 'localized', `${context}.abbreviation`)
      : null,
    tcgOnline: optionalString(set, 'tcgOnline', context),
    officialCardCount: requireInteger(cardCount, 'official', `${context}.cardCount`),
    totalCardCount: requireInteger(cardCount, 'total', `${context}.cardCount`),
    normalCardCount: optionalInteger(cardCount, 'normal', `${context}.cardCount`),
    reverseCardCount: optionalInteger(cardCount, 'reverse', `${context}.cardCount`),
    holoCardCount: optionalInteger(cardCount, 'holo', `${context}.cardCount`),
    firstEditionCardCount: optionalInteger(cardCount, 'firstEd', `${context}.cardCount`),
    legal: parseLegality(set, context),
  };
}

function parseVariant(raw: unknown, context: string): TcgdexVariant {
  const variant = requireRecord(raw, context);
  const thirdParty = optionalRecord(variant, 'thirdParty', context);
  const thirdPartyContext = `${context}.thirdParty`;
  return {
    variantId: requireString(variant, 'variantId', context),
    type: requireString(variant, 'type', context),
    subtype: optionalString(variant, 'subtype', context),
    size: requireString(variant, 'size', context),
    stamps: optionalStringArray(variant, 'stamp', context),
    foil: optionalString(variant, 'foil', context),
    cardmarketProductId: thirdParty
      ? optionalInteger(thirdParty, 'cardmarket', thirdPartyContext)
      : null,
    tcgplayerProductId: thirdParty
      ? optionalInteger(thirdParty, 'tcgplayer', thirdPartyContext)
      : null,
    cardtraderProductId: thirdParty
      ? optionalInteger(thirdParty, 'cardtrader', thirdPartyContext)
      : null,
  };
}

function parseCard(raw: unknown, index: number): TcgdexCard {
  const context = `cards[${index}]`;
  const card = requireRecord(raw, context);
  const variants = optionalRecord(card, 'variants', context);
  const flag = (key: string): boolean =>
    (variants ? optionalBoolean(variants, key, `${context}.variants`) : null) ?? false;
  const detailed = card['variants_detailed'];
  if (detailed !== undefined && !Array.isArray(detailed)) {
    throw new Error(`${context}.variants_detailed must be an array when present`);
  }
  return {
    id: requireString(card, 'id', context),
    localId: requireString(card, 'localId', context),
    name: requireString(card, 'name', context),
    category: requireString(card, 'category', context),
    rarity: optionalString(card, 'rarity', context),
    illustrator: optionalString(card, 'illustrator', context),
    hp: optionalInteger(card, 'hp', context),
    types: optionalStringArray(card, 'types', context),
    dexIds: optionalIntegerArray(card, 'dexId', context),
    evolveFrom: optionalString(card, 'evolveFrom', context),
    stage: optionalString(card, 'stage', context),
    suffix: optionalString(card, 'suffix', context),
    trainerType: optionalString(card, 'trainerType', context),
    energyType: optionalString(card, 'energyType', context),
    regulationMark: optionalString(card, 'regulationMark', context),
    legal: parseLegality(card, context),
    hasNormal: flag('normal'),
    hasReverse: flag('reverse'),
    hasHolo: flag('holo'),
    hasFirstEdition: flag('firstEdition'),
    hasWPromo: flag('wPromo'),
    updated: optionalString(card, 'updated', context),
    image: optionalString(card, 'image', context),
    variantsDetailed: (detailed ?? []).map((item: unknown, position: number) =>
      parseVariant(item, `${context}.variants_detailed[${position}]`),
    ),
  };
}

/** Validates a stored TCGdex response (one set and its cards, in one language). */
export function parseTcgdexFixture(raw: unknown): TcgdexFixture {
  const fixture = requireRecord(raw, 'fixture');
  const cards = fixture['cards'];
  if (!Array.isArray(cards)) {
    throw new Error('fixture.cards must be an array');
  }
  return { set: parseSet(fixture['set']), cards: cards.map(parseCard) };
}

function toDateOnly(value: string | null, context: string): Date | null {
  if (value === null) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${context} must be a YYYY-MM-DD date`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function toTimestamp(value: string | null, context: string): Date | null {
  if (value === null) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${context} must be an ISO 8601 timestamp`);
  }
  return date;
}

/**
 * Merges the English and French responses of one set into one row per set and per card.
 * TCGdex ids do not depend on the language, so they are the join key. French is optional
 * (TCGdex covers about 95 % of the cards in French), English is the reference: everything that is
 * not text (counts, flags, numbers, codes of the variants) is read from the English response.
 */
export function mergeSetFixtures(english: TcgdexFixture, french: TcgdexFixture): CatalogueSetData {
  if (english.set.id !== french.set.id) {
    throw new Error(`Set id differs between languages: ${english.set.id} / ${french.set.id}`);
  }
  if (
    english.set.officialCardCount !== french.set.officialCardCount ||
    english.set.totalCardCount !== french.set.totalCardCount
  ) {
    throw new Error(`Card counts differ between languages for set ${english.set.id}`);
  }

  const frenchById = new Map(french.cards.map((card) => [card.id, card]));
  const englishIds = new Set(english.cards.map((card) => card.id));
  const unknownFrench = french.cards.find((card) => !englishIds.has(card.id));
  if (unknownFrench) {
    throw new Error(`Card ${unknownFrench.id} exists in French but not in English`);
  }

  const englishSet = english.set;
  const set: CatalogueSetRow = {
    tcgdexId: englishSet.id,
    nameEn: englishSet.name,
    nameFr: french.set.name,
    serieTcgdexId: englishSet.serie?.id ?? french.set.serie?.id ?? null,
    serieNameEn: englishSet.serie?.name ?? null,
    serieNameFr: french.set.serie?.name ?? null,
    releaseDate: toDateOnly(englishSet.releaseDate, `set ${englishSet.id} releaseDate`),
    abbreviationOfficial: englishSet.abbreviationOfficial ?? french.set.abbreviationOfficial,
    abbreviationFr: french.set.abbreviationLocalized,
    tcgOnlineCode: englishSet.tcgOnline,
    officialCardCount: englishSet.officialCardCount,
    totalCardCount: englishSet.totalCardCount,
    normalCardCount: englishSet.normalCardCount,
    reverseCardCount: englishSet.reverseCardCount,
    holoCardCount: englishSet.holoCardCount,
    firstEditionCardCount: englishSet.firstEditionCardCount,
    legalStandard: englishSet.legal.standard,
    legalExpanded: englishSet.legal.expanded,
    logoUrlEn: englishSet.logo,
    logoUrlFr: french.set.logo,
    symbolUrl: englishSet.symbol ?? french.set.symbol,
  };

  const cards = english.cards.map((card): CatalogueCardRow => {
    const frenchCard = frenchById.get(card.id);
    return {
      tcgdexId: card.id,
      number: card.localId,
      nameEn: card.name,
      nameFr: frenchCard?.name ?? null,
      categoryEn: card.category,
      categoryFr: frenchCard?.category ?? null,
      rarityEn: card.rarity,
      rarityFr: frenchCard?.rarity ?? null,
      illustrator: card.illustrator,
      hp: card.hp,
      typesEn: card.types,
      typesFr: frenchCard?.types ?? [],
      dexIds: card.dexIds,
      evolveFromEn: card.evolveFrom,
      evolveFromFr: frenchCard?.evolveFrom ?? null,
      stageEn: card.stage,
      stageFr: frenchCard?.stage ?? null,
      suffix: card.suffix,
      trainerTypeEn: card.trainerType,
      trainerTypeFr: frenchCard?.trainerType ?? null,
      energyTypeEn: card.energyType,
      energyTypeFr: frenchCard?.energyType ?? null,
      regulationMark: card.regulationMark,
      legalStandard: card.legal.standard,
      legalExpanded: card.legal.expanded,
      hasNormal: card.hasNormal,
      hasReverse: card.hasReverse,
      hasHolo: card.hasHolo,
      hasFirstEdition: card.hasFirstEdition,
      hasWPromo: card.hasWPromo,
      tcgdexUpdatedAt: toTimestamp(card.updated, `card ${card.id} updated`),
      imageUrlEn: card.image,
      imageUrlFr: frenchCard?.image ?? null,
    };
  });

  const variants = english.cards.flatMap((card) =>
    card.variantsDetailed.map((variant): CatalogueVariantRow => ({
      cardTcgdexId: card.id,
      tcgdexVariantId: variant.variantId,
      type: variant.type,
      subtype: variant.subtype,
      size: variant.size,
      stamps: variant.stamps,
      foil: variant.foil,
      cardmarketProductId: variant.cardmarketProductId,
      tcgplayerProductId: variant.tcgplayerProductId,
      cardtraderProductId: variant.cardtraderProductId,
    })),
  );

  return { set, cards, variants };
}

function readFixture(setId: string, language: FixtureLanguage): TcgdexFixture {
  const path = join(FIXTURES_DIRECTORY, `${setId}.${language}.json`);
  const raw: unknown = JSON.parse(readFileSync(path, 'utf-8'));
  return parseTcgdexFixture(raw);
}

/** Loads the reference catalogue: the three TCGdex sets of REFERENCE_SET_IDS, in English and French. */
export function loadReferenceCatalogue(): CatalogueSetData[] {
  return REFERENCE_SET_IDS.map((setId) =>
    mergeSetFixtures(readFixture(setId, 'en'), readFixture(setId, 'fr')),
  );
}
