import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Icon } from '../Icon';

import { Button } from './Button';
import type { ButtonVariant } from './Button';

/** Icône d'exemple : Button reçoit l'icône de l'appelant et n'importe aucun atome. */
const EXAMPLE_ICON = <Icon name="plus" />;

const meta = {
  title: 'Button',
  component: Button,
  args: { variant: 'primary', children: 'Scanner' },
  argTypes: { icon: { control: false } },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une seule instance, pilotable depuis les contrôles. */
export const ParDefaut: Story = {
  name: 'Par défaut',
};

/** Libellés de chargement au plus aussi longs que le libellé normal (règle de design-system.md). */
const VARIANTS: { variant: ButtonVariant; label: string; loadingLabel: string }[] = [
  { variant: 'primary', label: 'Ajouter la carte', loadingLabel: 'Ajout…' },
  { variant: 'secondary', label: 'Exporter', loadingLabel: 'Export…' },
  { variant: 'ghost', label: 'Charger la suite', loadingLabel: 'Chargement…' },
  { variant: 'danger', label: 'Supprimer la carte', loadingLabel: 'Suppression…' },
];

const STATES = ['Repos · survol · clic · Tab', 'Désactivé', 'Chargement'] as const;

function Matrix({ hasIcon }: { hasIcon: boolean }) {
  const icon = hasIcon ? EXAMPLE_ICON : undefined;
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-x-space-24 border-spacing-y-space-16">
        <thead>
          <tr>
            <th className="text-left text-caption text-acier-texte">Variante</th>
            {STATES.map((state) => (
              <th key={state} className="text-left text-caption text-acier-texte">
                {state}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {VARIANTS.map(({ variant, label, loadingLabel }) => (
            <tr key={variant}>
              <td className="text-data text-acier-texte">{variant}</td>
              <td>
                <Button variant={variant} icon={icon} loading={false} loadingLabel={loadingLabel}>
                  {label}
                </Button>
              </td>
              <td>
                <Button
                  variant={variant}
                  icon={icon}
                  disabled
                  loading={false}
                  loadingLabel={loadingLabel}
                >
                  {label}
                </Button>
              </td>
              <td>
                <Button variant={variant} icon={icon} loading loadingLabel={loadingLabel}>
                  {label}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Les 4 variantes croisées avec les états, sans icône.
 * Survol, clic et focus se vérifient sur la première colonne : le liséré se renforce au survol,
 * puis au clic ; Tab affiche le contour Signal.
 */
export const Matrice: Story = {
  name: 'Matrice des états',
  render: () => <Matrix hasIcon={false} />,
};

/** La même matrice avec une icône à gauche du libellé (espacement space-8). */
export const MatriceAvecIcone: Story = {
  name: 'Matrice des états, avec icône',
  render: () => <Matrix hasIcon />,
};

function LoadingDemo() {
  const [isLoading, setIsLoading] = useState(false);
  return (
    <div className="flex items-center gap-space-16">
      <Button variant="primary" icon={EXAMPLE_ICON} loading={isLoading} loadingLabel="Envoi…">
        Créer mon compte
      </Button>
      <Button variant="ghost" onClick={() => setIsLoading((value) => !value)}>
        {isLoading ? 'Arrêter le chargement' : 'Lancer le chargement'}
      </Button>
    </div>
  );
}

/**
 * Chargement sans saut de mise en page : le bouton garde sa largeur, l'icône et le libellé
 * laissent place au libellé de chargement, sans spinner. Le second bouton bascule l'état.
 */
export const Chargement: Story = {
  render: () => <LoadingDemo />,
};

/** Pleine largeur, pour un formulaire étroit (inscription, connexion). */
export const PleineLargeur: Story = {
  name: 'Pleine largeur (fullWidth)',
  render: () => (
    <div className="w-1/2 space-y-space-16">
      <Button variant="primary" type="submit" fullWidth>
        Créer mon compte
      </Button>
      <Button variant="secondary" fullWidth icon={EXAMPLE_ICON}>
        Ajouter une carte
      </Button>
      <Button variant="danger" fullWidth>
        Supprimer mon compte
      </Button>
    </div>
  ),
};
