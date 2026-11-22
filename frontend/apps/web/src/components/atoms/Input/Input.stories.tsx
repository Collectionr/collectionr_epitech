import { useState } from 'react';
import type { FocusEvent } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Text } from '../Text';

import { Input } from './Input';
import type { InputType } from './Input';

const meta = {
  title: 'Input',
  component: Input,
  args: { id: 'input-par-defaut', placeholder: 'Votre prénom' },
  argTypes: { trailing: { control: false } },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une seule instance, pilotable depuis les contrôles. */
export const ParDefaut: Story = {
  name: 'Par défaut',
};

interface TypeSample {
  type: InputType;
  placeholder: string;
  value: string;
  error: string;
  autoComplete: 'given-name' | 'email';
}

/** Messages d'exemple : en production, ils viennent toujours du formulaire. */
const TYPES: TypeSample[] = [
  {
    type: 'text',
    placeholder: 'Votre prénom',
    value: 'Sacha',
    error: 'Indiquez votre prénom.',
    autoComplete: 'given-name',
  },
  {
    type: 'email',
    placeholder: 'email@exemple.com',
    value: 'sacha@bourg-palette',
    error: 'Adresse e-mail invalide.',
    autoComplete: 'email',
  },
];

const STATES = ['Vide', 'Rempli · survol · Tab', 'Erreur', 'Désactivé'] as const;

/**
 * Tous les états, en text et en email. Survol et focus se vérifient à la souris et au clavier (Tab) :
 * bordure renforcée au survol (liséré 90 %), contour Signal au focus clavier.
 */
export const Etats: Story = {
  name: 'États',
  render: () => (
    <div className="space-y-space-32">
      {TYPES.map(({ type, placeholder, value, error, autoComplete }) => (
        <div key={type} className="space-y-space-16">
          <Text variant="data" color="acier-texte">
            {`type="${type}"`}
          </Text>
          <div className="grid grid-cols-1 gap-space-24 desktop:grid-cols-4">
            {STATES.map((state) => (
              <div key={state} className="space-y-space-8">
                <Text variant="caption" color="acier-texte">
                  {state}
                </Text>
                {state === 'Vide' && (
                  <Input
                    id={`${type}-vide`}
                    type={type}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                  />
                )}
                {state === 'Rempli · survol · Tab' && (
                  <Input
                    id={`${type}-rempli`}
                    type={type}
                    placeholder={placeholder}
                    defaultValue={value}
                    autoComplete={autoComplete}
                  />
                )}
                {state === 'Erreur' && (
                  <Input
                    id={`${type}-erreur`}
                    type={type}
                    placeholder={placeholder}
                    defaultValue={value}
                    autoComplete={autoComplete}
                    error={error}
                  />
                )}
                {state === 'Désactivé' && (
                  <Input
                    id={`${type}-desactive`}
                    type={type}
                    placeholder={placeholder}
                    defaultValue={value}
                    disabled
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};

/** Règle d'exemple de la story : Input ne valide rien, c'est le formulaire qui le fait. */
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
    <div className="w-1/2 space-y-space-8">
      <Input
        id="email-blur"
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
 * ailleurs), en fondu, sans décaler la suite, et la valeur saisie est conservée.
 */
export const ValidationAuBlur: Story = {
  name: 'Validation au blur (exemple de formulaire)',
  render: () => <ValidationAuBlurDemo />,
};
