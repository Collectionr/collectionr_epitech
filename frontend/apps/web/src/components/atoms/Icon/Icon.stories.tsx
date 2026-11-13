import type { Meta, StoryObj } from '@storybook/react-vite';

import { iconography } from '@shared/tokens';

import { Text } from '../Text';

import { Icon } from './Icon';
import type { IconName, IconSize } from './Icon';

const meta = {
  title: 'Icon',
  component: Icon,
  args: { name: 'search' },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une seule icône, pilotable depuis les contrôles. */
export const ParDefaut: Story = {
  name: 'Par défaut',
};

const NAMES: { name: IconName; usage: string }[] = [
  { name: 'eye', usage: 'Afficher le mot de passe' },
  { name: 'eye-off', usage: 'Masquer le mot de passe' },
  { name: 'search', usage: 'Recherche' },
  { name: 'bell', usage: 'Notifications' },
  { name: 'plus', usage: 'Ajouter' },
  { name: 'grid', usage: 'Catalogue' },
  { name: 'list', usage: 'Classeurs' },
];

const SIZES = Object.keys(iconography.sizes) as IconSize[];

/** Le set disponible, à chaque taille standard. */
export const JeuComplet: Story = {
  name: 'Jeu complet',
  render: () => (
    <div className="space-y-space-24">
      {NAMES.map(({ name, usage }) => (
        <div key={name} className="flex items-center gap-space-24">
          {SIZES.map((size) => (
            <Icon key={size} name={name} size={size} />
          ))}
          <Text variant="data">{name}</Text>
          <Text variant="caption" color="acier-texte">
            {usage}
          </Text>
        </div>
      ))}
    </div>
  ),
};

/** La couleur suit celle du texte parent (currentColor). */
export const CouleurHeritee: Story = {
  name: 'Couleur héritée',
  render: () => (
    <div className="space-y-space-16">
      <div className="flex items-center gap-space-8 text-archive">
        <Icon name="plus" size="sm" />
        <Text variant="body">Ajouter une carte</Text>
      </div>
      <div className="flex items-center gap-space-8 text-acier-texte">
        <Icon name="search" size="sm" />
        <Text variant="body" color="acier-texte">
          Nom, extension ou numéro
        </Text>
      </div>
      <div className="flex items-center gap-space-8 text-alerte">
        <Icon name="eye-off" size="sm" />
        <Text variant="body" color="alerte">
          Mot de passe trop court
        </Text>
      </div>
    </div>
  ),
};

/** Seule dans un bouton, l'icône porte un libellé pour les lecteurs d'écran. */
export const AvecLibelle: Story = {
  name: 'Avec libellé',
  render: () => (
    <div className="space-y-space-8">
      <Icon name="bell" label="Notifications" />
      <Text variant="caption" color="acier-texte">
        role="img" et aria-label="Notifications"
      </Text>
    </div>
  ),
};
