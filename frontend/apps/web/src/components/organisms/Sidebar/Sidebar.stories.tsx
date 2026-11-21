import type { Meta, StoryObj } from '@storybook/react-vite';

import { Sidebar } from './Sidebar';

const destinations = {
  dashboard: '/dashboard',
  catalogue: '/catalogue',
  collection: '/collection',
  setProgression: '/sets/progression',
  addCard: '/collection/ajouter',
  preGrading: '/pre-gradage',
  profile: '/profil',
  settings: '/parametres',
};

const meta = {
  title: 'Sidebar',
  component: Sidebar,
  args: { destinations, currentPath: destinations.dashboard },
  argTypes: {
    currentPath: { control: 'select', options: Object.values(destinations) },
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = {};

export const AjouterUneCarte: Story = {
  name: 'Ajouter une carte',
  args: { currentPath: destinations.addCard },
};
