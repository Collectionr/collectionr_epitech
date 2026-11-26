import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';

import { FormField } from '../../molecules';
import { Select } from './Select';
import type { SelectProps } from './Select';

const CONDITIONS = [
  { value: 'NM', label: 'Near Mint (NM)' },
  { value: 'LP', label: 'Lightly Played (LP)' },
  { value: 'MP', label: 'Moderately Played (MP)' },
  { value: 'HP', label: 'Heavily Played (HP)' },
  { value: 'DMG', label: 'Damaged (DMG)' },
];

const meta = {
  title: 'Select',
  component: Select,
  args: {
    id: 'etat',
    value: '',
    onChange: fn(),
    options: CONDITIONS,
    placeholder: 'Choisir un état',
  },
  render: function Render(args) {
    const [{ value }, updateArgs] = useArgs<SelectProps>();
    return (
      <div className="max-w-form">
        <Select
          {...args}
          value={value}
          onChange={(nextValue) => {
            args.onChange(nextValue);
            updateArgs({ value: nextValue });
          }}
        />
      </div>
    );
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Rien de choisi : l'option d'invite, désactivée, est affichée. */
export const Defaut: Story = { name: 'Défaut' };

export const Rempli: Story = { args: { value: 'NM' } };

export const EnErreur: Story = { name: 'En erreur', args: { error: 'Choisissez un état' } };

export const Desactive: Story = { name: 'Désactivé', args: { value: 'LP', disabled: true } };

/** Dans FormField, comme contrôle fourni : Label, champ et message en un bloc. */
export const DansFormField: Story = {
  name: 'Dans FormField',
  render: function Render(args) {
    const [{ value }, updateArgs] = useArgs<SelectProps>();
    return (
      <div className="max-w-form">
        <FormField
          label="État"
          required
          renderControl={(control) => (
            <Select
              {...args}
              {...control}
              value={value}
              onChange={(nextValue) => updateArgs({ value: nextValue })}
            />
          )}
        />
      </div>
    );
  },
};
