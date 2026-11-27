import type { Meta, StoryObj } from '@storybook/react-vite';

import { Price } from './Price';

const meta = {
  title: 'Price',
  component: Price,
  args: { amount: 12.4 },
} satisfies Meta<typeof Price>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MontantSimple: Story = { name: 'Montant simple' };

export const Hausse: Story = { args: { change: 0.032 } };

export const Baisse: Story = { args: { change: -0.05 } };

/** Aucune cote (pricing en Beta) : « — », jamais « 0 EUR ». */
export const Absent: Story = { args: { amount: null } };

export const TresGrandMontant: Story = {
  name: 'Très grand montant',
  args: { amount: 1234567.89, change: 0.125 },
};

/** Colonne de montants alignés à droite, chiffres tabulaires. */
export const Colonne: Story = {
  render: () => (
    <div className="flex w-sidebar flex-col gap-space-8">
      <Price amount={12.4} align="end" />
      <Price amount={1240.5} change={0.032} align="end" />
      <Price amount={null} align="end" />
    </div>
  ),
};
