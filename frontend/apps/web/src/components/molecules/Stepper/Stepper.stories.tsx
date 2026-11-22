import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '@/components/atoms';

import { Stepper } from './Stepper';
import type { StepperProps } from './Stepper';

/** Intitulés neutres : ces stories montrent le composant, pas un parcours prévu au produit. */
const FOUR_STEPS: StepperProps['steps'] = [
  'Premier intitulé',
  'Deuxième intitulé',
  'Troisième intitulé',
  'Quatrième intitulé',
];

const meta = {
  title: 'Stepper',
  component: Stepper,
  args: { steps: ['Identité', 'Sécurité'], currentStep: 1 },
  argTypes: { currentStep: { control: { type: 'number', min: 1 } } },
  decorators: [
    (Story) => (
      <div className="w-1/2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Inscription (COLLR-588) : première étape en cours, la seconde à venir. */
export const ParDefaut: Story = {
  name: 'Inscription, étape 1 sur 2',
};

/** Inscription (COLLR-590) : première étape complétée, seconde en cours. */
export const InscriptionEtape2: Story = {
  name: 'Inscription, étape 2 sur 2',
  args: { currentStep: 2 },
};

/** Quatre étapes, l'étape en cours au début, au milieu puis à la fin de la séquence. */
export const Positions: Story = {
  name: 'Positions dans la séquence (4 étapes)',
  render: () => (
    <div className="space-y-space-32">
      {FOUR_STEPS.map((title, index) => (
        <Stepper key={title} steps={FOUR_STEPS} currentStep={index + 1} />
      ))}
    </div>
  ),
};

/** Le nombre d'étapes vient des intitulés : 3 et 6 étapes, en plus des 2 de l'inscription. */
export const NombreVariable: Story = {
  name: "Nombre d'étapes variable",
  render: () => (
    <div className="space-y-space-32">
      <Stepper
        steps={['Premier intitulé', 'Deuxième intitulé', 'Troisième intitulé']}
        currentStep={2}
      />
      <Stepper steps={['Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six']} currentStep={4} />
    </div>
  ),
};

function PiloteParLeFormulaireDemo() {
  const [currentStep, setCurrentStep] = useState(1);
  const total = FOUR_STEPS.length;

  function handlePrevious() {
    setCurrentStep((step) => step - 1);
  }

  function handleNext() {
    setCurrentStep((step) => step + 1);
  }

  return (
    <div className="space-y-space-24">
      <Stepper steps={FOUR_STEPS} currentStep={currentStep} />
      <div className="flex gap-space-12">
        <Button variant="ghost" onClick={handlePrevious} disabled={currentStep === 1}>
          Précédent
        </Button>
        <Button variant="primary" onClick={handleNext} disabled={currentStep === total}>
          Continuer
        </Button>
      </div>
    </div>
  );
}

/**
 * Le Stepper n'a aucun bouton : ici, c'est la story qui joue le rôle du formulaire et fait avancer
 * l'étape. Le remplissage d'un segment suit la durée `snap`, ramenée à zéro en mouvement réduit.
 */
export const PiloteParLeFormulaire: Story = {
  name: 'Piloté par le formulaire',
  render: () => <PiloteParLeFormulaireDemo />,
};
