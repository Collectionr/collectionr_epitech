import type { Prisma } from '../../../../generated/prisma/client.js';
import { Card } from '../../domain/entities/Card';
import { CardSet, type CardSetSerie } from '../../domain/entities/CardSet';
import { CardVariant } from '../../domain/entities/CardVariant';
import { LicenceTCG } from '../../domain/entities/LicenceTCG';
import { LocalizedText } from '../../domain/value-objects/LocalizedText';
import { LocalizedUrl } from '../../domain/value-objects/LocalizedUrl';

/**
 * What the repository asks Prisma to load with a card: its set, the licence of the set, its printings.
 * The printings are sorted, because PostgreSQL gives no order for an unsorted relation and the display
 * would move from one call to the next: by type, then by TCGdex variant id (unique inside a card).
 */
export const CARD_INCLUDE = {
  set: { include: { licenceTCG: true } },
  variants: { orderBy: [{ type: 'asc' }, { tcgdexVariantId: 'asc' }] },
} satisfies Prisma.CardInclude;

export type CardRecord = Prisma.CardGetPayload<{ include: typeof CARD_INCLUDE }>;

function toLicenceTCG(record: CardRecord['set']['licenceTCG']): LicenceTCG {
  return LicenceTCG.restore({
    id: record.id,
    slug: record.slug,
    name: record.name,
    logoUrl: record.logoUrl,
  });
}

// TCGdex data is community-made and language by language: a series or a previous evolution can be
// known in French only. English is the reference, so the French text stands in for it rather than
// the row being dropped (the database accepts it, because refusing it would stop the sync).
function toSerie(record: CardRecord['set']): CardSetSerie | null {
  const name = record.serieNameEn ?? record.serieNameFr;
  if (record.serieTcgdexId === null || name === null) {
    return null;
  }
  return { tcgdexId: record.serieTcgdexId, name: LocalizedText.of(name, record.serieNameFr) };
}

function toEvolveFrom(record: CardRecord): LocalizedText | null {
  const name = record.evolveFromEn ?? record.evolveFromFr;
  return name === null ? null : LocalizedText.of(name, record.evolveFromFr);
}

function toCardSet(record: CardRecord['set']): CardSet {
  return CardSet.restore({
    id: record.id,
    licenceTCG: toLicenceTCG(record.licenceTCG),
    tcgdexId: record.tcgdexId,
    name: LocalizedText.of(record.nameEn, record.nameFr),
    serie: toSerie(record),

    releaseDate: record.releaseDate,
    abbreviationOfficial: record.abbreviationOfficial,
    abbreviationFr: record.abbreviationFr,
    tcgOnlineCode: record.tcgOnlineCode,
    officialCardCount: record.officialCardCount,
    totalCardCount: record.totalCardCount,
    printingCounts: {
      normal: record.normalCardCount,
      reverse: record.reverseCardCount,
      holo: record.holoCardCount,
      firstEdition: record.firstEditionCardCount,
    },
    logo: LocalizedUrl.of(record.logoUrlEn, record.logoUrlFr),
    symbolUrl: record.symbolUrl,
  });
}

function toCardVariant(record: CardRecord['variants'][number]): CardVariant {
  return CardVariant.restore({
    id: record.id,
    tcgdexVariantId: record.tcgdexVariantId,
    type: record.type,
    subtype: record.subtype,
    size: record.size,
    stamps: record.stamps,
    foil: record.foil,
    cardmarketProductId: record.cardmarketProductId,
    tcgplayerProductId: record.tcgplayerProductId,
    cardtraderProductId: record.cardtraderProductId,
  });
}

/** Turns a stored card (with its relations) into the domain entity. */
export function toCard(record: CardRecord): Card {
  return Card.restore({
    id: record.id,
    set: toCardSet(record.set),
    tcgdexId: record.tcgdexId,
    number: record.number,
    name: LocalizedText.of(record.nameEn, record.nameFr),
    category: record.category,
    rarity: record.rarity,
    illustrator: record.illustrator,
    hp: record.hp,
    types: record.types,
    dexIds: record.dexIds,
    evolveFrom: toEvolveFrom(record),
    stage: record.stage,
    tcgdexUpdatedAt: record.tcgdexUpdatedAt,
    image: LocalizedUrl.of(record.imageUrlEn, record.imageUrlFr),
    variants: record.variants.map(toCardVariant),
  });
}
