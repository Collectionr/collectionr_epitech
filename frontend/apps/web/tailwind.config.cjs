const { createJiti } = require('jiti');
const { createDesignPreset } = createJiti(__filename)('../../styles/tailwindPreset.ts');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  presets: [createDesignPreset('web')],
};
