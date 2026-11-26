import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';

import { AddCardForm } from './AddCardForm';
import type { AddCardFormProps } from './AddCardForm';

const meta = {
  title: 'AddCardForm',
  component: AddCardForm,
  args: {
    collections: [
      { id: 'c1', name: 'Classeur Base' },
      { id: 'c2', name: 'Doubles à échanger' },
    ],
    values: { collectionId: 'c1', condition: '', language: 'fr', quantity: 1 },
    onChange: fn(),
    cardSelected: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
  render: function Render(args) {
    const [{ values }, updateArgs] = useArgs<AddCardFormProps>();
    return (
      <div className="max-w-form">
        <AddCardForm
          {...args}
          values={values}
          onChange={(nextValues) => {
            args.onChange(nextValues);
            updateArgs({ values: nextValues });
          }}
        />
      </div>
    );
  },
} satisfies Meta<typeof AddCardForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Aucune carte choisie : « Enregistrer » désactivé. */
export const Vide: Story = {};

export const Rempli: Story = {
  args: {
    cardSelected: true,
    values: { collectionId: 'c2', condition: 'NM', language: 'en', quantity: 3 },
  },
};

/** Envoi sans état choisi : le champ État est signalé et reçoit le focus. */
export const ErreurDeValidation: Story = {
  name: 'Erreur de validation',
  args: { cardSelected: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Enregistrer/ }));
  },
};

export const EnvoiEnCours: Story = {
  name: 'Envoi en cours',
  args: {
    cardSelected: true,
    submitting: true,
    values: { collectionId: 'c1', condition: 'NM', language: 'fr', quantity: 1 },
  },
};
