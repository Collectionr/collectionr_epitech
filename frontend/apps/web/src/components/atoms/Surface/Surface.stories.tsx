import type { Meta, StoryObj } from '@storybook/react-vite';

import { Text } from '../Text';

import { Surface } from './Surface';
import type { SurfacePadding } from './Surface';

const meta = {
  title: 'Surface',
  component: Surface,
  args: {
    padding: 'space-24',
    children: (
      <div className="space-y-space-8">
        <Text variant="h2">Ténèbres Embrasées</Text>
        <Text variant="data">201 cartes</Text>
        <Text variant="caption" color="acier-texte">
          Épée et Bouclier
        </Text>
      </div>
    ),
  },
} satisfies Meta<typeof Surface>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Fond élevé, arrondi de carte et liséré, avec un contenu d'exemple. */
export const ParDefaut: Story = {
  name: 'Par défaut',
};

const PADDINGS: SurfacePadding[] = ['space-12', 'space-16', 'space-24', 'space-32'];

/** Chaque espacement interne autorisé. */
export const Espacements: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-space-24">
      {PADDINGS.map((padding) => (
        <Surface key={padding} padding={padding}>
          <Text variant="data">{padding}</Text>
        </Surface>
      ))}
    </div>
  ),
};

/** Dans une liste de cartes, la surface porte la balise li. */
export const ListeDeCartes: Story = {
  name: 'Liste de cartes (as="li")',
  render: () => (
    <ul className="space-y-space-16">
      <Surface as="li" padding="space-16">
        <Text variant="body">Dracaufeu · 006/102</Text>
      </Surface>
      <Surface as="li" padding="space-16">
        <Text variant="body">Tortank · 009/102</Text>
      </Surface>
    </ul>
  ),
};
