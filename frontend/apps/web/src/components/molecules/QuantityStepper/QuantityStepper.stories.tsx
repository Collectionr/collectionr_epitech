import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';

import { QuantityStepper } from './QuantityStepper';
import type { QuantityStepperProps } from './QuantityStepper';

const meta = {
  title: 'QuantityStepper',
  component: QuantityStepper,
  args: { value: 1, onChange: fn() },
  render: function Render(args) {
    const [{ value }, updateArgs] = useArgs<QuantityStepperProps>();
    return (
      <QuantityStepper
        {...args}
        value={value}
        onChange={(nextValue) => {
          args.onChange(nextValue);
          updateArgs({ value: nextValue });
        }}
      />
    );
  },
} satisfies Meta<typeof QuantityStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Valeur 1 : − désactivé au minimum. */
export const ValeurUn: Story = { name: 'Valeur 1' };

/** Valeur au maximum (9999, borne du back) : + désactivé. */
export const ValeurAuMaximum: Story = { name: 'Valeur au maximum', args: { value: 9999 } };

export const Desactive: Story = { name: 'Désactivé', args: { value: 3, disabled: true } };
