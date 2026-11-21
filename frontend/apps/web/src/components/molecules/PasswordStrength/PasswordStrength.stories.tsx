import { useState } from 'react';
import type { ChangeEvent } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Text } from '@/components/atoms';

import { FormField } from '../FormField';
import { PasswordField } from '../PasswordField';

import { PasswordStrength } from './PasswordStrength';

const meta = {
  title: 'PasswordStrength',
  component: PasswordStrength,
  args: { password: 'pikachu1' },
  decorators: [
    (Story) => (
      <div className="w-1/2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PasswordStrength>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une seule instance : modifier le mot de passe dans les contrôles met la jauge à jour. */
export const ParDefaut: Story = {
  name: 'Par défaut',
};

const SAMPLES = [
  { password: '', description: 'Champ vide : jauge vide, aucun libellé' },
  { password: 'pikachu', description: '« pikachu » : politique non respectée (pas de chiffre)' },
  { password: 'pikachu1', description: '« pikachu1 » : politique respectée' },
  { password: 'Pikachu-2026', description: '« Pikachu-2026 » : 12 caractères, 4 familles' },
];

/** Chaque niveau, avec son libellé : la jauge est monochrome, c'est le texte qui porte le sens. */
export const Niveaux: Story = {
  render: () => (
    <div className="space-y-space-24">
      {SAMPLES.map(({ password, description }) => (
        <div key={description} className="space-y-space-8">
          <Text variant="caption" color="acier-texte">
            {description}
          </Text>
          <PasswordStrength password={password} />
        </div>
      ))}
    </div>
  ),
};

function DansUnFormulaireDemo() {
  const [password, setPassword] = useState('');

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setPassword(event.target.value);
  }

  return (
    <div className="space-y-space-8">
      <FormField
        label="Mot de passe"
        required
        renderControl={(control) => (
          <PasswordField
            {...control}
            name="password"
            autoComplete="new-password"
            onChange={handleChange}
          />
        )}
      />
      <PasswordStrength password={password} />
    </div>
  );
}

/**
 * Sous le champ mot de passe de l'inscription : la jauge suit chaque frappe et se remplit
 * progressivement (durée `signature`), sans attendre la sortie du champ.
 */
export const DansUnFormulaire: Story = {
  name: 'Dans un formulaire (mise à jour à chaque frappe)',
  render: () => <DansUnFormulaireDemo />,
};
