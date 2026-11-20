import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../Button';
import { Icon } from '../Icon';
import { Text } from '../Text';

import { Badge } from './Badge';

const meta = {
  title: 'Badge',
  component: Badge,
  args: { count: 3, 'aria-label': '3 notifications non lues' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une seule instance, pilotable depuis les contrôles. */
export const ParDefaut: Story = {
  name: 'Par défaut',
};

const CASES: { count: number; label: string }[] = [
  { count: 3, label: '1 chiffre' },
  { count: 42, label: '2 chiffres' },
  { count: 128, label: 'Au-delà de 99' },
  { count: 0, label: 'Compteur à 0 (masqué)' },
];

/** Les 4 cas du ticket ; à 0, rien n'est rendu. */
export const Cas: Story = {
  name: 'Cas',
  render: () => (
    <div className="flex items-end gap-space-24">
      {CASES.map(({ count, label }) => (
        <div key={label} className="space-y-space-8">
          <div className="h-badge">
            <Badge count={count} aria-label={`${count} notifications non lues`} />
          </div>
          <Text variant="caption" color="acier-texte">
            {label}
          </Text>
        </div>
      ))}
    </div>
  ),
};

function NotificationDemo() {
  const [count, setCount] = useState(3);
  return (
    <div className="flex items-center gap-space-24">
      <span className="relative inline-flex text-archive">
        <Icon name="bell" size="lg" label="Notifications" />
        <span className="absolute -right-space-12 -top-space-12">
          <Badge count={count} aria-label={`${count} notifications non lues`} />
        </span>
      </span>
      <Button variant="secondary" onClick={() => setCount((value) => value + 1)}>
        Ajouter
      </Button>
      <Button variant="ghost" onClick={() => setCount(0)}>
        Tout lire
      </Button>
    </div>
  );
}

/**
 * Placé par le parent dans le coin de l'icône. Chaque changement de valeur rejoue le fondu ;
 * à 0, le badge disparaît.
 */
export const SurUneIcone: Story = {
  name: 'Sur une icône',
  render: () => <NotificationDemo />,
};
