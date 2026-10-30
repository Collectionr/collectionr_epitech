import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    {
      directory: '../src/components/atoms',
      files: '**/*.@(mdx|stories.tsx)',
      titlePrefix: 'Atoms',
    },
    {
      directory: '../src/components/molecules',
      files: '**/*.@(mdx|stories.tsx)',
      titlePrefix: 'Molecules',
    },
    {
      directory: '../src/components/organisms',
      files: '**/*.@(mdx|stories.tsx)',
      titlePrefix: 'Organisms',
    },
    {
      directory: '../src/components/templates',
      files: '**/*.@(mdx|stories.tsx)',
      titlePrefix: 'Templates',
    },
  ],
  framework: '@storybook/react-vite',
  addons: ['@storybook/addon-docs'],
  core: { disableTelemetry: true },
};

export default config;
