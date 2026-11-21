import type { Meta, StoryObj } from '@storybook/react-vite';

import { Text } from '@/components/atoms';

import { AuthLayout } from './AuthLayout';

/** Repère neutre : la page fournit le vrai contenu (COLLR-588 pour l'inscription). */
const SLOT_CLASSES =
  'flex flex-1 flex-col items-center justify-center gap-space-8 border border-dashed border-lisere-hover p-space-24';

interface SlotProps {
  name: string;
  description: string;
}

function Slot({ name, description }: SlotProps) {
  return (
    <div className={SLOT_CLASSES}>
      <Text variant="data">{name}</Text>
      <Text variant="caption" color="acier-texte">
        {description}
      </Text>
    </div>
  );
}

const BRAND_PANEL = (
  <Slot name="BrandPanel" description="Argumentaire de l'inscription ou contenu de la connexion" />
);

const FORM_PANEL = (
  <Slot name="FormPanel" description="SignupForm ou LoginForm, largeur max sizing.form (480 px)" />
);

/** Formulaire plus haut que la fenêtre : la page défile, le panneau de marque suit sa hauteur. */
const LONG_FORM_PANEL = (
  <div className="flex flex-col gap-space-24">
    {Array.from({ length: 12 }, (_, index) => (
      <Slot key={index} name={`Bloc ${index + 1}`} description="Contenu de formulaire" />
    ))}
  </div>
);

const meta = {
  title: 'AuthLayout',
  component: AuthLayout,
  args: { brandPanel: BRAND_PANEL, formPanel: FORM_PANEL },
  argTypes: {
    brandPanel: { control: false },
    formPanel: { control: false },
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AuthLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Seuil desktop atteint (1280 px) : deux colonnes, panneau de marque à gauche. */
export const Desktop: Story = {
  name: 'Desktop (1280 px)',
  globals: { viewport: { value: 'desktop', isRotated: false } },
};

/** Sous le seuil desktop (834 px) : le panneau de marque disparaît, le formulaire occupe l'écran. */
export const SousLeSeuil: Story = {
  name: 'Sous le seuil desktop (834 px)',
  globals: { viewport: { value: 'tablet', isRotated: false } },
};

/** Formulaire plus haut que la fenêtre, sur desktop. */
export const FormulaireLong: Story = {
  name: 'Formulaire plus haut que la fenêtre',
  args: { formPanel: LONG_FORM_PANEL },
  globals: { viewport: { value: 'desktop', isRotated: false } },
};
