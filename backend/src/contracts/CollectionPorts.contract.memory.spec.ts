import { randomUUID } from 'node:crypto';
import { collectionRepositoryContract } from './CollectionPorts.contract';
import { InMemoryCollectionRepository } from './InMemoryCollectionRepository';

// The in-memory repository must honour the same contract as the Prisma one (COLLR-417 runs this
// same suite against PostgreSQL). It runs in the plain unit suite: no infrastructure needed.
collectionRepositoryContract('InMemoryCollectionRepository', () => {
  const licenceId = randomUUID();
  const otherLicenceId = randomUUID();
  const cardId = randomUUID();
  const secondCardId = randomUUID();
  const foreignCardId = randomUUID();
  const variantId = randomUUID();
  const secondCardVariantId = randomUUID();

  return {
    repository: new InMemoryCollectionRepository({
      licences: new Set([licenceId, otherLicenceId]),
      cards: new Map([
        [cardId, licenceId],
        [secondCardId, licenceId],
        [foreignCardId, otherLicenceId],
      ]),
      variants: new Map([
        [variantId, cardId],
        [secondCardVariantId, secondCardId],
      ]),
    }),
    catalogue: {
      licenceId,
      otherLicenceId,
      cardId,
      variantId,
      secondCardId,
      secondCardVariantId,
      foreignCardId,
    },
    newOwnerId: () => Promise.resolve(randomUUID()),
  };
});
