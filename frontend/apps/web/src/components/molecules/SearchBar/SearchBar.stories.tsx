import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';

import { SearchBar } from './SearchBar';
import type { SearchBarProps } from './SearchBar';

const meta = {
  title: 'SearchBar',
  component: SearchBar,
  args: { value: '', onChange: fn() },
  render: function Render(args) {
    const [{ value }, updateArgs] = useArgs<SearchBarProps>();

    return (
      <SearchBar
        value={value}
        onChange={(nextValue) => {
          args.onChange(nextValue);
          updateArgs({ value: nextValue });
        }}
      />
    );
  },
} satisfies Meta<typeof SearchBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vide: Story = {};

export const Remplie: Story = {
  name: 'Remplie',
  args: { value: 'Pikachu' },
};
