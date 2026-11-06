const { createJiti } = require('jiti');
const { createDesignPreset } = createJiti(__filename)('../../styles/tailwindPreset.ts');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset'), createDesignPreset('native')],
  plugins: [],
};
