import { useState } from 'react';
import type { FocusEvent } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Text } from '@/components/atoms';

import { FormField } from './FormField';
import type { FormFieldProps } from './FormField';

/**
 * Storybook ne sait pas dériver les contrôles d'une union de propriétés : les stories portent
 * sur le champ standard (Input). `renderControl` est montré dans la story de PasswordField.
 */
type FormFieldWithInputProps = Extract<FormFieldProps, { renderControl?: undefined }>;

const meta = {
  title: 'FormField',
  component: FormField,
  args: { label: 'Prénom', placeholder: 'Votre prénom', autoComplete: 'given-name' },
  decorators: [
    (Story) => (
      <div className="w-1/2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<FormFieldWithInputProps>;

export default meta;
type Story = StoryObj<FormFieldWithInputProps>;

/** Une seule instance, pilotable depuis les contrôles. */
export const ParDefaut: Story = {
  name: 'Par défaut',
};

/** Label au-dessus du champ, à `space-8` ; un clic sur l'intitulé place le focus dans le champ. */
export const SansErreur: Story = {
  name: 'Sans erreur',
  args: {
    label: 'Adresse e-mail',
    type: 'email',
    placeholder: 'email@exemple.com',
    autoComplete: 'email',
    defaultValue: 'sacha@bourg-palette.fr',
  },
};

/** Message d'exemple : en production, il vient toujours du formulaire. */
export const AvecErreur: Story = {
  name: 'Avec erreur',
  args: {
    label: 'Adresse e-mail',
    type: 'email',
    placeholder: 'email@exemple.com',
    autoComplete: 'email',
    defaultValue: 'sacha@bourg-palette',
    error: 'Adresse e-mail invalide.',
  },
};

/** Astérisque sur le Label (décoratif) et attribut `required` sur le champ. */
export const Requis: Story = {
  args: {
    label: 'Adresse e-mail',
    type: 'email',
    placeholder: 'email@exemple.com',
    autoComplete: 'email',
    required: true,
  },
};

/** Règle d'exemple de la story : FormField ne valide rien, c'est le formulaire qui le fait. */
function validateEmail(value: string): string | undefined {
  if (value === '') {
    return 'Indiquez votre adresse e-mail.';
  }
  return value.includes('@') ? undefined : 'Adresse e-mail invalide.';
}

function ValidationAuBlurDemo() {
  const [error, setError] = useState<string>();

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    setError(validateEmail(event.target.value));
  }

  return (
    <div className="space-y-space-8">
      <FormField
        label="Adresse e-mail"
        type="email"
        placeholder="email@exemple.com"
        autoComplete="email"
        required
        error={error}
        onBlur={handleBlur}
      />
      <Text variant="body" color="acier-texte">
        Ce paragraphe ne bouge pas quand le message apparaît : sa place est réservée.
      </Text>
    </div>
  );
}

/**
 * Comportement attendu dans un formulaire : l'erreur arrive à la sortie du champ (Tab ou clic
 * ailleurs), en fondu, et la valeur saisie est conservée.
 */
export const ValidationAuBlur: Story = {
  name: 'Validation au blur (exemple de formulaire)',
  render: () => <ValidationAuBlurDemo />,
};
