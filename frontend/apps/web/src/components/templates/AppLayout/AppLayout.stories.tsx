import type { Meta, StoryObj } from '@storybook/react-vite';

import { Text } from '@/components/atoms';

import { AppLayout } from './AppLayout';

const destinations = {
  dashboard: '/',
  catalogue: '/catalogue',
  collection: '/collections',
  setProgression: '/progression',
  addCard: '/cartes/ajouter',
  preGrading: '/pre-gradage',
  profile: '/profil',
  settings: '/parametres',
};

/** Repère neutre : chaque page fournit son vrai contenu. */
const SLOT_CLASSES =
  'flex flex-col items-center justify-center gap-space-8 border border-dashed border-lisere-hover p-space-24';

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

const CONTENT = (
  <div className="p-space-24">
    <Slot name="Contenu de la page" description="Seule zone qui varie d'un écran à l'autre" />
  </div>
);

/** Contenu plus haut que la fenêtre : il défile seul, la Sidebar et la Topbar restent en place. */
const LONG_CONTENT = (
  <div className="flex flex-col gap-space-24 p-space-24">
    {Array.from({ length: 12 }, (_, index) => (
      <Slot key={index} name={`Bloc ${index + 1}`} description="Contenu de la page" />
    ))}
  </div>
);

const meta = {
  title: 'AppLayout',
  component: AppLayout,
  args: {
    title: 'Ajouter une carte',
    currentPath: destinations.addCard,
    destinations,
    user: { name: 'Camille' },
    children: CONTENT,
  },
  argTypes: {
    currentPath: { control: 'select', options: Object.values(destinations) },
    children: { control: false },
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Seuil desktop atteint (1280 px) : Sidebar toujours visible. */
export const Desktop: Story = {
  name: 'Desktop (1280 px)',
  globals: { viewport: { value: 'desktop', isRotated: false } },
};

/** Sous le seuil desktop (834 px) : Sidebar masquée, ouverte par « Menu » par-dessus le contenu. */
export const SousLeSeuil: Story = {
  name: 'Sous le seuil desktop (834 px)',
  globals: { viewport: { value: 'tablet', isRotated: false } },
};

/** Contenu plus haut que la fenêtre, sur desktop. */
export const ContenuLong: Story = {
  name: 'Contenu plus haut que la fenêtre',
  args: { children: LONG_CONTENT },
  globals: { viewport: { value: 'desktop', isRotated: false } },
};
