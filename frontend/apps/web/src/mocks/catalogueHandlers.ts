import { delay, http, HttpResponse } from 'msw';
import type { HttpHandler } from 'msw';

import { CATALOG_SEARCH } from '@shared/constants';
import { CATALOG_SEARCH_PATH } from '@shared/services';
import type { CatalogCard } from '@shared/types';

import { apiError } from './apiErrors';
import { MOCK_CATALOGUE } from './data/catalogue';

/** Bornes et messages du back (`CardNameSearch.ts`), en anglais comme lui. */
const MAX_SEARCH_LIMIT = 50;
const FORBIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const MESSAGES = {
  length: `The search term must be between ${CATALOG_SEARCH.minLength} and ${CATALOG_SEARCH.maxLength} characters long`,
  characters: 'The search term must not contain control or invisible characters',
  limit: `The search limit must be a whole number between 1 and ${MAX_SEARCH_LIMIT}`,
} as const;

/** Identifiant TCGdex d'une carte (`swsh3-20`), second critère de tri du back. */
function tcgdexIdOf({ card, set }: CatalogCard): string {
  return `${set.tcgdexId}-${card.number}`;
}

function matches({ card }: CatalogCard, term: string): boolean {
  const lowerTerm = term.toLocaleLowerCase('fr-FR');
  return [card.nameEn, card.nameFr].some(
    (name) => name !== null && name.toLocaleLowerCase('fr-FR').includes(lowerTerm),
  );
}

/**
 * Handler simulé de la recherche dans le catalogue. Aucun endpoint n'existe encore côté back
 * (COLLR-459) : chemin et réponse sont ceux supposés par `catalogService`. Le comportement suit le
 * dépôt du back (`searchByName`) : nom anglais ou français contenant le terme, sans tenir compte de
 * la casse mais des accents, tri par nom anglais puis identifiant TCGdex.
 * @param baseUrl - URL de base de l'API (`/api/v1`, ou URL absolue)
 */
export function createCatalogueHandlers(baseUrl: string): HttpHandler[] {
  return [
    http.get(`${baseUrl}${CATALOG_SEARCH_PATH}`, async ({ request }) => {
      // Temps de réponse réaliste dans le navigateur (aucun sous Node, pour les tests).
      await delay();
      const query = new URL(request.url).searchParams;
      const term = (query.get('q') ?? '').trim().normalize('NFC');
      const limit = Number(query.get('limit') ?? CATALOG_SEARCH.limit);

      if (term.length < CATALOG_SEARCH.minLength || term.length > CATALOG_SEARCH.maxLength) {
        return apiError(request, 400, MESSAGES.length);
      }
      if (FORBIDDEN_CHARACTERS.test(term)) {
        return apiError(request, 400, MESSAGES.characters);
      }
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT) {
        return apiError(request, 400, MESSAGES.limit);
      }

      const found = MOCK_CATALOGUE.filter((catalogueCard) => matches(catalogueCard, term))
        .sort(
          (first, second) =>
            first.card.nameEn.localeCompare(second.card.nameEn, 'en') ||
            tcgdexIdOf(first).localeCompare(tcgdexIdOf(second), 'en'),
        )
        .slice(0, limit);
      return HttpResponse.json(found);
    }),
  ];
}
