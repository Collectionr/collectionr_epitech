import type { Preview } from '@storybook/react-vite';
import { themes } from 'storybook/theming';

import { colors } from '@shared/tokens';

import '@/styles/fonts';
import '@/styles/globals.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    backgrounds: { options: { ecrin: { name: 'Écrin', value: colors.ecrin } } },
    docs: { theme: themes.dark },
    options: { storySort: { order: ['Atoms', 'Molecules', 'Organisms', 'Templates'] } },
  },
  initialGlobals: { backgrounds: { value: 'ecrin' } },
};

export default preview;
