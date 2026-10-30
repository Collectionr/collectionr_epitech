/** Graisses disponibles ; semibold est réservé à IBM Plex Mono / Button. */
export const fontWeights = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
} as const;

/** Familles web et identifiants des fichiers statiques chargés par Expo. */
export const fonts = {
  sans: {
    family: 'Schibsted Grotesk',
    native: {
      [fontWeights.normal]: 'SchibstedGrotesk_400Regular',
      [fontWeights.medium]: 'SchibstedGrotesk_500Medium',
      [fontWeights.bold]: 'SchibstedGrotesk_700Bold',
      [fontWeights.extrabold]: 'SchibstedGrotesk_800ExtraBold',
      [fontWeights.black]: 'SchibstedGrotesk_900Black',
    },
  },
  mono: {
    family: 'IBM Plex Mono',
    native: {
      [fontWeights.medium]: 'IBMPlexMono_500Medium',
      [fontWeights.semibold]: 'IBMPlexMono_600SemiBold',
    },
  },
} as const;

/** Tailles en px, interlignes en ratio, crénages en em. Aucun style italique. */
export const typography = {
  display: {
    family: 'sans',
    size: 96,
    compactSize: 48,
    lineHeight: 1,
    tracking: -0.03,
    weight: fontWeights.black,
  },
  h1: {
    family: 'sans',
    size: 56,
    compactSize: 36,
    lineHeight: 1.07,
    tracking: -0.02,
    weight: fontWeights.bold,
  },
  h2: { family: 'sans', size: 32, lineHeight: 1.19, tracking: -0.01, weight: fontWeights.bold },
  body: { family: 'sans', size: 16, lineHeight: 26 / 16, tracking: 0, weight: fontWeights.normal },
  caption: {
    family: 'sans',
    size: 12,
    lineHeight: 16 / 12,
    tracking: 0.02,
    weight: fontWeights.medium,
  },
  data: {
    family: 'mono',
    size: 14,
    lineHeight: 20 / 14,
    tracking: 0.01,
    weight: fontWeights.medium,
  },
  // Aucun interligne spécifié par le ticket : ne pas inventer de token.
  'button-label': { family: 'mono', size: 14, tracking: 0.14, weight: fontWeights.semibold },
} as const;
