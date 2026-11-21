import type { Meta, StoryObj } from '@storybook/react-vite';

import { NavItem } from './NavItem';

const meta = {
  title: 'NavItem',
  component: NavItem,
  args: { href: '#catalogue', label: 'Catalogue', icon: 'grid' },
} satisfies Meta<typeof NavItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ParDefaut: Story = { name: 'Par défaut' };

export const Survol: Story = {
  name: 'Survol',
  parameters: {
    docs: { description: { story: 'Survoler le lien pour afficher son état de survol.' } },
  },
};

export const Actif: Story = {
  name: 'Actif',
  args: { active: true },
};
