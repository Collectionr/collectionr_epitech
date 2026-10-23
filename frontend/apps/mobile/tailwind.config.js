/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    // Design tokens partagés (couleurs, typographie, espacements) : emplacement réservé à
    // COLLR-573. Ils viendront de packages/shared/src/tokens, unique source de vérité visuelle.
    // Aucune valeur n'est définie en attendant.
    extend: {},
  },
  plugins: [],
};
