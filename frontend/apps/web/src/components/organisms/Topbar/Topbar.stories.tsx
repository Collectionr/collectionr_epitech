import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';

import { Topbar } from './Topbar';
import type { TopbarProps } from './Topbar';

const meta = {
  title: 'Topbar',
  component: Topbar,
  args: {
    title: 'Dashboard',
    searchValue: '',
    onSearchChange: fn(),
    notificationCount: 0,
    avatar: { name: 'Camille' },
  },
  render: function Render(args) {
    const [{ searchValue }, updateArgs] = useArgs<TopbarProps>();

    return (
      <Topbar
        {...args}
        searchValue={searchValue ?? ''}
        onSearchChange={(nextValue) => {
          args.onSearchChange?.(nextValue);
          updateArgs({ searchValue: nextValue });
        }}
      />
    );
  },
} satisfies Meta<typeof Topbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = {};

export const PageImbriquee: Story = {
  name: 'Page imbriquée',
  args: {
    title: 'Détail de la carte',
    breadcrumbs: [{ label: 'Catalogue', href: '/catalogue' }],
    notificationCount: 3,
    searchValue: 'Pikachu',
  },
};

/** Sans recherche globale à brancher (Alpha) : pas de champ qui ne ferait rien. */
export const SansRecherche: Story = {
  name: 'Sans recherche',
  render: function Render({ title, breadcrumbs, notificationCount, avatar }) {
    return (
      <Topbar
        title={title}
        breadcrumbs={breadcrumbs}
        notificationCount={notificationCount}
        avatar={avatar}
      />
    );
  },
};
