import { useState } from 'react';
import type { FocusEvent } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Text } from '@/components/atoms';

import { FormField } from '../FormField';

import { PasswordField } from './PasswordField';

/** Mot de passe d'exemple, conforme à la politique (8 caractères, une lettre, un chiffre). */
const SAMPLE_PASSWORD = 'Pikachu2026';

/** Message d'exemple : en production, il vient toujours du formulaire. */
const PASSWORD_ERROR = 'Au moins 8 caractères, dont une lettre et un chiffre.';

const meta = {
  title: 'PasswordField',
  component: PasswordField,
  args: { id: 'motdepasse-par-defaut', autoComplete: 'new-password' },
  decorators: [
    (Story) => (
      <div className="w-1/2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PasswordField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une seule instance, pilotable depuis les contrôles. */
export const ParDefaut: Story = {
  name: 'Par défaut',
};

/** Mot de passe masqué ; la bascule se survole, se clique et s'atteint au clavier (Tab). */
export const Masque: Story = {
  name: 'Masqué',
  args: { id: 'motdepasse-masque', defaultValue: SAMPLE_PASSWORD },
};

/** Mot de passe affiché : la story clique sur la bascule au chargement. */
export const Affiche: Story = {
  name: 'Affiché',
  args: { id: 'motdepasse-affiche', defaultValue: SAMPLE_PASSWORD },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Afficher le mot de passe' }));
  },
};

/** Composé avec FormField par `renderControl` : intitulé, astérisque et erreur unique. */
export const AvecErreur: Story = {
  name: 'Avec erreur (dans un FormField)',
  render: () => (
    <FormField
      label="Mot de passe"
      required
      error={PASSWORD_ERROR}
      renderControl={(control) => (
        <PasswordField
          {...control}
          name="password"
          autoComplete="new-password"
          defaultValue="pika"
        />
      )}
    />
  ),
};

/** Règle d'exemple de la story : ni PasswordField ni FormField ne valident. */
function validatePassword(value: string): string | undefined {
  const isValid = value.length >= 8 && /\p{L}/u.test(value) && /\p{Nd}/u.test(value);
  return isValid ? undefined : PASSWORD_ERROR;
}

function FormulaireDemo() {
  const [error, setError] = useState<string>();

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    setError(validatePassword(event.target.value));
  }

  return (
    <div className="space-y-space-8">
      <FormField
        label="Mot de passe"
        required
        error={error}
        renderControl={(control) => (
          <PasswordField
            {...control}
            name="password"
            autoComplete="new-password"
            onBlur={handleBlur}
          />
        )}
      />
      <Text variant="body" color="acier-texte">
        Basculer l’affichage pendant la saisie ne déclenche pas la validation : le champ garde le
        focus. Elle arrive à la sortie du champ (Tab ou clic ailleurs).
      </Text>
    </div>
  );
}

/** Exemple de formulaire : la bascule ne fait pas sortir du champ, la validation reste au blur. */
export const DansUnFormulaire: Story = {
  name: 'Dans un formulaire (validation au blur)',
  render: () => <FormulaireDemo />,
};
