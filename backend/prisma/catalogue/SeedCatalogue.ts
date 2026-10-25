import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { loadReferenceCatalogue } from './CatalogueFixtures';

/** The only game of the V1 catalogue. `slug` is the conflict target of the UPSERT. */
export const POKEMON_GAME = { slug: 'pokemon', name: 'Pokémon' } as const;

export interface CatalogueSeedSummary {
  sets: number;
  cards: number;
  variants: number;
}

// Reference data only, idempotent: every row is an UPSERT on its natural key (games.slug,
// sets.tcgdexId, cards.tcgdexId, variants.(cardId, tcgdexVariantId)), the same keys the TCG
// microservice uses (ADR-015).
export async function seedCatalogue(prismaClient: PrismaClient): Promise<CatalogueSeedSummary> {
  const catalogue = loadReferenceCatalogue();

  const game = await prismaClient.game.upsert({
    where: { slug: POKEMON_GAME.slug },
    update: { name: POKEMON_GAME.name },
    create: { ...POKEMON_GAME },
  });

  let cardCount = 0;
  let variantCount = 0;
  for (const { set, cards, variants } of catalogue) {
    const storedSet = await prismaClient.cardSet.upsert({
      where: { tcgdexId: set.tcgdexId },
      update: { ...set, gameId: game.id },
      create: { ...set, gameId: game.id },
    });

    const storedCards = await prismaClient.$transaction(
      cards.map((card) =>
        prismaClient.card.upsert({
          where: { tcgdexId: card.tcgdexId },
          update: { ...card, setId: storedSet.id },
          create: { ...card, setId: storedSet.id },
        }),
      ),
    );
    const cardIds = new Map(storedCards.map((card) => [card.tcgdexId, card.id]));

    await prismaClient.$transaction(
      variants.map(({ cardTcgdexId, ...columns }) => {
        const cardId = cardIds.get(cardTcgdexId);
        if (cardId === undefined) {
          throw new Error(
            `Variant ${columns.tcgdexVariantId} points at unknown card ${cardTcgdexId}`,
          );
        }
        return prismaClient.variant.upsert({
          where: { cardId_tcgdexVariantId: { cardId, tcgdexVariantId: columns.tcgdexVariantId } },
          update: { ...columns, cardId },
          create: { ...columns, cardId },
        });
      }),
    );

    cardCount += cards.length;
    variantCount += variants.length;
  }

  return { sets: catalogue.length, cards: cardCount, variants: variantCount };
}
