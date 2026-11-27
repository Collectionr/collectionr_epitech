import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { EmptyState } from './EmptyState';

const meta = {
  title: 'EmptyState',
  component: EmptyState,
  args: {
    icon: 'list',
    title: 'Aucune carte dans cette collection',
    description: 'Ajoutez votre première carte pour suivre sa valeur.',
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VideAvecAction: Story = {
  name: 'Vide, avec action',
  args: { action: { label: 'Ajouter une carte', onClick: fn() } },
};

export const VideSansAction: Story = { name: 'Vide, sans action' };

export const AucunResultatAvecAction: Story = {
  name: 'Aucun résultat, avec action',
  args: {
    variant: 'no-results',
    icon: 'search',
    title: 'Aucune carte trouvée pour “zzz”',
    description: 'Vérifiez l’orthographe ou cherchez le nom anglais.',
    onClearSearch: fn(),
  },
};

export const AucunResultatSansAction: Story = {
  name: 'Aucun résultat, sans action',
  args: {
    variant: 'no-results',
    icon: 'search',
    title: 'Aucune carte trouvée pour “zzz”',
    description: undefined,
  },
};
