import type { Meta, StoryObj } from '@storybook/react-vite';

import { fontWeights } from '@shared/tokens';

import { Text } from './Text';
import type { TextVariant, TextWeight } from './Text';

const meta = {
  title: 'Text',
  component: Text,
  args: { variant: 'body', children: 'Dracaufeu' },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une seule instance, pilotable depuis les contrôles. */
export const ParDefaut: Story = {
  name: 'Par défaut',
};

const VARIANTS: { variant: TextVariant; label: string; sample: string }[] = [
  { variant: 'display', label: 'display · 96 px, 48 px sous 1280 px', sample: 'Collectionr' },
  { variant: 'h1', label: 'h1 · 56 px, 36 px sous 1280 px', sample: 'Ma collection' },
  { variant: 'h2', label: 'h2 · 32 px', sample: 'Ténèbres Embrasées' },
  { variant: 'body', label: 'body · 16 px', sample: 'Ajoutez une carte depuis le catalogue.' },
  { variant: 'caption', label: 'caption · 12 px', sample: 'Ajoutée le 13 novembre 2026' },
  { variant: 'data', label: 'data · IBM Plex Mono 14 px', sample: '247 cartes · 1 234,56 EUR' },
];

/** Les 6 variantes de l'échelle typographique, avec leur balise par défaut. */
export const Variantes: Story = {
  render: () => (
    <div className="space-y-space-24">
      {VARIANTS.map(({ variant, label, sample }) => (
        <div key={variant} className="space-y-space-4">
          <Text variant="caption" color="acier-texte">
            {label}
          </Text>
          <Text variant={variant}>{sample}</Text>
        </div>
      ))}
    </div>
  ),
};

/** Couleurs autorisées. Signal n'existe que sur display, h1 et h2 ; Écrin se pose sur Archive. */
export const Couleurs: Story = {
  render: () => (
    <div className="space-y-space-16">
      <Text variant="body">archive · texte principal (défaut)</Text>
      <Text variant="body" color="acier-texte">
        acier-texte · texte secondaire
      </Text>
      <Text variant="body" color="alerte">
        alerte · impossible de charger la collection
      </Text>
      <Text variant="h2" color="signal">
        signal · titres uniquement
      </Text>
      <div className="bg-archive p-space-8">
        <Text variant="caption" color="ecrin">
          ecrin · texte posé sur fond Archive
        </Text>
      </div>
    </div>
  ),
};

const WEIGHTS: { name: string; weight: TextWeight }[] = [
  { name: 'normal', weight: fontWeights.normal },
  { name: 'medium', weight: fontWeights.medium },
  { name: 'bold', weight: fontWeights.bold },
  { name: 'extrabold', weight: fontWeights.extrabold },
  { name: 'black', weight: fontWeights.black },
];

/** Graisses Schibsted Grotesk chargées par l'application ; sans effet sur data. */
export const Graisses: Story = {
  render: () => (
    <div className="space-y-space-8">
      {WEIGHTS.map(({ name, weight }) => (
        <Text key={name} variant="body" weight={weight}>
          {`${name} · ${weight}`}
        </Text>
      ))}
    </div>
  ),
};

/** Même rendu, autre balise : `as` garde une hiérarchie de titres correcte dans la page. */
export const BaliseAs: Story = {
  name: 'Balise (as)',
  render: () => (
    <div className="space-y-space-16">
      <Text variant="h2">Style h2, balise h2</Text>
      <Text variant="h2" as="h3">
        Style h2, balise h3
      </Text>
    </div>
  ),
};

/** Noms de cartes longs dans une colonne étroite : une ligne et une ellipse. */
export const Troncature: Story = {
  render: () => (
    <div className="w-1/2 space-y-space-16">
      <div className="space-y-space-4">
        <Text variant="caption" color="acier-texte">
          Sans truncate
        </Text>
        <Text variant="body">Dracaufeu VMAX Arc-en-ciel · Ténèbres Embrasées · 020/189</Text>
      </div>
      <div className="space-y-space-4">
        <Text variant="caption" color="acier-texte">
          Avec truncate
        </Text>
        <Text variant="body" truncate>
          Dracaufeu VMAX Arc-en-ciel · Ténèbres Embrasées · 020/189
        </Text>
      </div>
    </div>
  ),
};
