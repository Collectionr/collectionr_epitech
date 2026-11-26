import type { CardView, SetView, VariantView } from '@shared/types';

/**
 * Catalogue simulé : des cartes réelles des trois sets du catalogue de référence du back
 * (fixtures TCGdex de `backend/prisma/fixtures/tcgdex`, licence MIT), avec des UUID fixes.
 * La base du back génère ses propres UUID : une carte simulée n'existe pas dans la vraie base.
 */

/** Licence Pokémon simulée. */
export const MOCK_LICENCE_ID = '88509b1d-1db6-4c0a-b9ac-26b5c07517ee';

/** Carte du catalogue simulé, avec son set et ses impressions. */
export interface MockCatalogueCard {
  card: CardView;
  set: SetView;
  variants: VariantView[];
}

const BASE_SET: SetView = {
  id: 'c48a896b-41c6-482f-8875-8431c08449f6',
  tcgdexId: 'base1',
  nameEn: 'Base Set',
  nameFr: 'Set de Base',
  abbreviationOfficial: 'BS',
};

const DARKNESS_ABLAZE: SetView = {
  id: 'eed80bdf-7305-403f-bd9d-f1ecdf9f9cf5',
  tcgdexId: 'swsh3',
  nameEn: 'Darkness Ablaze',
  nameFr: 'Ténèbres Embrasées',
  abbreviationOfficial: 'DAA',
};

const SET_151: SetView = {
  id: '812aa234-52e8-4000-9674-bba36bd9d1e6',
  tcgdexId: 'sv03.5',
  nameEn: '151',
  nameFr: '151',
  abbreviationOfficial: 'MEW',
};

/** Série TCGdex de chaque set, dans le chemin des images. */
const SERIES: Record<string, string> = { base1: 'base', swsh3: 'swsh', 'sv03.5': 'sv' };

interface CardSeed {
  id: string;
  set: SetView;
  number: string;
  nameEn: string;
  nameFr: string;
  rarity: string;
  variants: Array<Pick<VariantView, 'id' | 'type'> & Partial<VariantView>>;
}

function imageUrl(language: 'en' | 'fr', set: SetView, number: string): string {
  return `https://assets.tcgdex.net/${language}/${SERIES[set.tcgdexId]}/${set.tcgdexId}/${number}`;
}

function toCatalogueCard({ id, set, number, nameEn, nameFr, rarity, variants }: CardSeed) {
  return {
    card: {
      id,
      number,
      nameEn,
      nameFr,
      category: 'Pokemon',
      rarity,
      imageUrlEn: imageUrl('en', set, number),
      imageUrlFr: imageUrl('fr', set, number),
    },
    set,
    variants: variants.map((variant) => ({
      subtype: null,
      size: 'standard',
      stamps: [],
      foil: null,
      ...variant,
    })),
  } satisfies MockCatalogueCard;
}

const CARD_SEEDS: CardSeed[] = [
  {
    id: '09a987ad-21e7-45c5-9b66-e39e92ae5464',
    set: BASE_SET,
    number: '4',
    nameEn: 'Charizard',
    nameFr: 'Dracaufeu',
    rarity: 'Rare',
    variants: [{ id: '1f37930e-2688-49c9-8e94-e5d265bad764', type: 'holo', subtype: 'unlimited' }],
  },
  {
    id: '617559c7-285c-4ce4-9f75-3dd33ad96222',
    set: BASE_SET,
    number: '2',
    nameEn: 'Blastoise',
    nameFr: 'Tortank',
    rarity: 'Rare',
    variants: [{ id: '5a53b7c7-0a90-4a11-92a6-26f7a9a2fff3', type: 'holo', subtype: 'unlimited' }],
  },
  {
    id: '1b3dfb96-c51f-413b-9c53-bc1cbe1389a3',
    set: BASE_SET,
    number: '15',
    nameEn: 'Venusaur',
    nameFr: 'Florizarre',
    rarity: 'Rare',
    variants: [{ id: '0c4353cf-34e3-4167-9146-31bc970617ad', type: 'holo', subtype: 'unlimited' }],
  },
  {
    id: 'ad028ab5-1133-4ae7-92be-8ab2e1e00b9c',
    set: BASE_SET,
    number: '58',
    nameEn: 'Pikachu',
    nameFr: 'Pikachu',
    rarity: 'Common',
    variants: [
      { id: '08360273-6e4a-48d5-abec-a54c809790e4', type: 'normal', subtype: 'unlimited' },
    ],
  },
  {
    id: '8d0330d0-26da-49f7-8b94-04fe4047f29b',
    set: BASE_SET,
    number: '10',
    nameEn: 'Mewtwo',
    nameFr: 'Mewtwo',
    rarity: 'Rare',
    variants: [{ id: '914b7f9d-d8f3-424a-8c03-fb8fd5ea7c40', type: 'holo', subtype: 'unlimited' }],
  },
  {
    id: 'a31eb012-84b1-4408-af03-2244daea73ab',
    set: DARKNESS_ABLAZE,
    number: '20',
    nameEn: 'Charizard VMAX',
    nameFr: 'Dracaufeu VMAX',
    rarity: 'Holo Rare VMAX',
    variants: [{ id: '79e36b67-7fec-4822-a931-f46dc7c1a682', type: 'holo' }],
  },
  {
    id: 'f278d2b2-ee90-48d1-b319-e1019d4833ee',
    set: DARKNESS_ABLAZE,
    number: '136',
    nameEn: 'Furret',
    nameFr: 'Fouinar',
    rarity: 'Uncommon',
    variants: [
      { id: 'a535e68b-aebc-4240-9f09-524578eeb0ac', type: 'normal' },
      { id: 'ad99b701-d1b3-429a-bb53-287b8af9c23d', type: 'reverse' },
    ],
  },
  {
    id: 'eaf67609-9782-40b6-aa09-de288be64a0f',
    set: SET_151,
    number: '006',
    nameEn: 'Charizard ex',
    nameFr: 'Dracaufeu-ex',
    rarity: 'Double rare',
    variants: [{ id: 'f28833b3-ef40-4054-ab45-28c473e161fe', type: 'holo' }],
  },
  {
    id: 'e11a7aaf-11c1-4367-9b95-6c93590d911f',
    set: SET_151,
    number: '025',
    nameEn: 'Pikachu',
    nameFr: 'Pikachu',
    rarity: 'Common',
    variants: [{ id: '1bb6e89e-f8f0-4a19-ab18-f0e55ff4f16c', type: 'normal' }],
  },
  {
    id: '2f74eb1e-104b-4bf9-a359-37a07607e6a1',
    set: SET_151,
    number: '151',
    nameEn: 'Mew ex',
    nameFr: 'Mew-ex',
    rarity: 'Double rare',
    variants: [{ id: '7fa7f257-10d4-40cb-8974-daac1fd87720', type: 'holo' }],
  },
];

/** Cartes du catalogue simulé. */
export const MOCK_CATALOGUE: readonly MockCatalogueCard[] = CARD_SEEDS.map(toCatalogueCard);

/**
 * Carte du catalogue simulé.
 * @param cardId - Identifiant de la carte
 */
export function findMockCard(cardId: string): MockCatalogueCard | undefined {
  return MOCK_CATALOGUE.find(({ card }) => card.id === cardId);
}
