import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';

import { MOCK_CATALOGUE } from '@/mocks/data/catalogue';
import type { CatalogSearchState } from '@shared/hooks';

import { CatalogSearch } from './CatalogSearch';
import type { CatalogSearchProps } from './CatalogSearch';

function searchState(overrides: Partial<CatalogSearchState> = {}): CatalogSearchState {
  return {
    canSearch: true,
    results: [],
    searchedTerm: '',
    isSearching: false,
    error: null,
    retry: fn(),
    ...overrides,
  };
}

const meta = {
  title: 'CatalogSearch',
  component: CatalogSearch,
  args: {
    value: '',
    onValueChange: fn(),
    onSelect: fn(),
    search: searchState({ canSearch: false }),
    autoFocus: true,
  },
  argTypes: { search: { control: false } },
  render: function Render(args) {
    const [{ value }, updateArgs] = useArgs<CatalogSearchProps>();
    return (
      <div className="max-w-form pb-space-64">
        <CatalogSearch
          {...args}
          value={value}
          onValueChange={(nextValue) => {
            args.onValueChange(nextValue);
            updateArgs({ value: nextValue });
          }}
        />
      </div>
    );
  },
} satisfies Meta<typeof CatalogSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Champ vide : aide sous le champ. */
export const Vide: Story = {};

/** Suggestions (focus dans le champ) : ↓ ↑ pour parcourir, Entrée pour choisir. */
export const Suggestions: Story = {
  args: {
    value: 'dra',
    search: searchState({
      results: MOCK_CATALOGUE.filter(({ card }) => card.nameFr?.includes('Dracaufeu')),
      searchedTerm: 'dra',
    }),
  },
};

export const AucunResultat: Story = {
  name: 'Aucun résultat',
  args: { value: 'zzz', search: searchState({ searchedTerm: 'zzz' }) },
};

export const Erreur: Story = {
  args: { value: 'pika', search: searchState({ error: new Error('Réseau') }) },
};
