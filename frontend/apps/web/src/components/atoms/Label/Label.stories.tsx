import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from '../Input';

import { Label } from './Label';

const meta = {
  title: 'Label',
  component: Label,
  args: { htmlFor: 'champ-par-defaut', children: 'Prénom' },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Une seule instance, pilotable depuis les contrôles. */
export const ParDefaut: Story = {
  name: 'Par défaut',
};

/** Astérisque en acier-texte, masqué aux lecteurs d'écran : l'obligation est portée par le champ. */
export const Requis: Story = {
  args: { htmlFor: 'champ-requis', children: 'Adresse e-mail', required: true },
};

/**
 * Avec un Input, à `space-8` : un clic sur l'intitulé place le focus dans le champ.
 * Les écrans n'assemblent pas Label et Input eux-mêmes : ils passent par FormField (COLLR-581).
 */
export const AssocieAUnInput: Story = {
  name: 'Associé à un Input',
  render: () => (
    <div className="flex w-1/2 flex-col gap-space-8">
      <Label htmlFor="story-label-email" required>
        Adresse e-mail
      </Label>
      <Input
        id="story-label-email"
        type="email"
        placeholder="email@exemple.com"
        autoComplete="email"
        required
      />
    </div>
  ),
};
