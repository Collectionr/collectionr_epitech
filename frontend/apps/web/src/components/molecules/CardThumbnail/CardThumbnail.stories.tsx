import type { Meta, StoryObj } from '@storybook/react-vite';

import { spacing } from '@shared/tokens';

import { CardThumbnail } from './CardThumbnail';

const CARD = {
  nameFr: 'Dracaufeu',
  nameEn: 'Charizard',
  number: '4',
  imageUrlFr: 'https://assets.tcgdex.net/fr/base/base1/4',
  imageUrlEn: 'https://assets.tcgdex.net/en/base/base1/4',
};

const SET = { nameFr: 'Set de Base', nameEn: 'Base Set' };

const meta = {
  title: 'CardThumbnail',
  component: CardThumbnail,
  args: { card: CARD, set: SET },
  decorators: [
    (Story) => (
      <div className="w-sidebar">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CardThumbnail>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Image chargée (TCGdex). */
export const Chargee: Story = { name: 'Chargée' };

/** Adresse injoignable : le chargement ne finit jamais, le cadre plein reste affiché. */
export const EnChargement: Story = {
  name: 'En chargement',
  args: { card: { ...CARD, imageUrlFr: 'https://10.255.255.1/carte', imageUrlEn: null } },
};

/** Image introuvable : glyphe et « Réessayer ». */
export const EnErreur: Story = {
  name: 'En erreur',
  args: {
    card: { ...CARD, imageUrlFr: 'https://assets.tcgdex.net/fr/introuvable', imageUrlEn: null },
  },
};

/** Trois largeurs fixées par le parent : la hauteur suit le format de la carte. */
export const TroisLargeurs: Story = {
  name: 'Trois largeurs',
  decorators: [
    () => (
      <div className="flex items-start gap-space-16">
        <div className="w-space-32">
          <CardThumbnail card={CARD} set={SET} sizes={`${spacing['space-32']}px`} compact />
        </div>
        <div className="w-space-64">
          <CardThumbnail card={CARD} set={SET} sizes={`${spacing['space-64']}px`} />
        </div>
        <div className="w-sidebar">
          <CardThumbnail card={CARD} set={SET} />
        </div>
      </div>
    ),
  ],
};
