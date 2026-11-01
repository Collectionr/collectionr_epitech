import type { Prisma } from '../../../../generated/prisma/client.js';
import { Card } from '../../domain/entities/Card';
import { CardSet } from '../../domain/entities/CardSet';
import { CardVariant } from '../../domain/entities/CardVariant';
import { LicenceTCG } from '../../domain/entities/LicenceTCG';
import { LocalizedText } from '../../domain/value-objects/LocalizedText';
import { LocalizedUrl } from '../../domain/value-objects/LocalizedUrl';

/** What the repository asks Prisma to load with a card: its set, the licence of the set, its printings. */
export const CARD_INCLUDE = {
  set: { include: { licenceTCG: true } },
  variants: true,
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

function toCardSet(record: CardRecord['set']): CardSet {
  return CardSet.restore({
    id: record.id,
    licenceTCG: toLicenceTCG(record.licenceTCG),
    tcgdexId: record.tcgdexId,
    name: LocalizedText.of(record.nameEn, record.nameFr),
    serie:
      record.serieTcgdexId !== null && record.serieNameEn !== null
        ? {
            tcgdexId: record.serieTcgdexId,
            name: LocalizedText.of(record.serieNameEn, record.serieNameFr),
          }
        : null,
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
    evolveFrom:
      record.evolveFromEn !== null
        ? LocalizedText.of(record.evolveFromEn, record.evolveFromFr)
        : null,
    stage: record.stage,
    tcgdexUpdatedAt: record.tcgdexUpdatedAt,
    image: LocalizedUrl.of(record.imageUrlEn, record.imageUrlFr),
    variants: record.variants.map(toCardVariant),
  });
}
