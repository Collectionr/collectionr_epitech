import type { Meta, StoryObj } from '@storybook/react-vite';

import { MOCK_CATALOGUE } from '@/mocks/data/catalogue';

import { CardPreviewPanel } from './CardPreviewPanel';

const [CHARIZARD] = MOCK_CATALOGUE;

const meta = {
  title: 'CardPreviewPanel',
  component: CardPreviewPanel,
  args: { selected: null },
  decorators: [
    (Story) => (
      <div className="w-sidebar p-space-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CardPreviewPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vide: Story = {};

/** Les coins du réticule se verrouillent sur la vignette à la sélection. */
export const CarteChoisie: Story = { name: 'Carte choisie', args: { selected: CHARIZARD ?? null } };

export const ImageEnErreur: Story = {
  name: 'Image en erreur',
  args: {
    selected: CHARIZARD
      ? {
          ...CHARIZARD,
          card: {
            ...CHARIZARD.card,
            imageUrlFr: 'https://assets.tcgdex.net/fr/introuvable',
            imageUrlEn: null,
          },
        }
      : null,
  },
};
