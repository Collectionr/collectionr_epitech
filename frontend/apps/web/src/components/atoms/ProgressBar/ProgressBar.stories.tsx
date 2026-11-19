import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../Button';
import { Text } from '../Text';

import { ProgressBar } from './ProgressBar';

const meta = {
  title: 'ProgressBar',
  component: ProgressBar,
  args: { value: 45, max: 120, 'aria-label': 'Progression du set' },
  decorators: [
    (Story) => (
      <div className="w-1/2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une seule instance, pilotable depuis les contrôles. */
export const ParDefaut: Story = {
  name: 'Par défaut',
};

const LEVELS: { value: number; label: string }[] = [
  { value: 0, label: '0 / 120' },
  { value: 45, label: '45 / 120' },
  { value: 120, label: '120 / 120' },
];

/** Vide, partiel et complet. */
export const Niveaux: Story = {
  render: () => (
    <div className="space-y-space-24">
      {LEVELS.map(({ value, label }) => (
        <div key={label} className="space-y-space-8">
          <Text variant="data" color="acier-texte">
            {label}
          </Text>
          <ProgressBar value={value} max={120} aria-label={`Progression du set : ${label}`} />
        </div>
      ))}
    </div>
  ),
};

const STEP = 10;
const TOTAL = 120;

function AnimationDemo() {
  const [value, setValue] = useState(45);
  return (
    <div className="space-y-space-16">
      <Text variant="data" color="acier-texte">
        {`${value} / ${TOTAL}`}
      </Text>
      <ProgressBar value={value} max={TOTAL} aria-label="Progression du set" />
      <div className="flex gap-space-16">
        <Button
          variant="secondary"
          onClick={() => setValue((current) => Math.min(current + STEP, TOTAL))}
        >
          Ajouter 10 cartes
        </Button>
        <Button variant="ghost" onClick={() => setValue(0)}>
          Vider
        </Button>
      </div>
    </div>
  );
}

/** Le remplissage glisse vers sa nouvelle valeur, jamais de saut. */
export const Animation: Story = {
  render: () => <AnimationDemo />,
};
