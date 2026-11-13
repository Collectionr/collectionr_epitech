import plugin from 'tailwindcss/plugin';
import type { Config } from 'tailwindcss';

import {
  aspectRatio,
  borders,
  breakpoints,
  colors,
  fonts,
  fontWeights,
  motion,
  opacity,
  radius,
  spacing,
  typography,
} from '../packages/shared/src/tokens';

type Platform = 'web' | 'native';
type TypographyToken = (typeof typography)[keyof typeof typography];

function withOpacity(hex: string, alpha: number): string {
  const rgb = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  return `rgba(${rgb.join(',')},${alpha})`;
}

function fontFamily(token: TypographyToken, platform: Platform): string {
  if (platform === 'web') return webFontFamily(token.family).join(', ');
  return token.family === 'sans'
    ? fonts.sans.native[token.weight]
    : fonts.mono.native[token.weight];
}

function webFontFamily(family: keyof typeof fonts): string[] {
  return [`"${fonts[family].family}"`, ...fonts[family].fallback];
}

function textStyle(token: TypographyToken, platform: Platform, size: number) {
  return {
    fontFamily: fontFamily(token, platform),
    fontSize: `${size}px`,
    ...('lineHeight' in token ? { lineHeight: `${size * token.lineHeight}px` } : {}),
    letterSpacing: `${token.tracking}em`,
    // Sur mobile chaque graisse est un fichier distinct, sans graisse synthétique.
    fontWeight: platform === 'native' ? 'normal' : String(token.weight),
    fontStyle: 'normal',
  };
}

/** Construit le mapping Tailwind/NativeWind depuis les mêmes tokens, sans recopier leurs valeurs. */
export function createDesignPreset(platform: Platform): Partial<Config> {
  const durations = Object.fromEntries(
    Object.entries(motion.duration).map(([name, value]) => [
      name,
      platform === 'web' ? `var(--duration-${name})` : `${value}ms`,
    ]),
  );
  return {
    theme: {
      colors: {
        ...colors,
        transparent: 'transparent',
        current: 'currentColor',
        inherit: 'inherit',
      },
      spacing: {
        0: '0px',
        ...Object.fromEntries(Object.entries(spacing).map(([key, value]) => [key, `${value}px`])),
      },
      borderRadius: Object.fromEntries(
        Object.entries(radius).map(([key, value]) => [key, `${value}px`]),
      ),
      borderWidth: { DEFAULT: `${borders.thin}px`, 0: '0px' },
      boxShadow: { none: 'none' },
      opacity: {
        0: '0',
        100: '1',
        ...Object.fromEntries(Object.entries(opacity).map(([key, value]) => [key, String(value)])),
      },
      screens: { desktop: `${breakpoints.desktop}px` },
      fontFamily: {
        sans: platform === 'web' ? webFontFamily('sans') : [fonts.sans.native[400]],
        mono: platform === 'web' ? webFontFamily('mono') : [fonts.mono.native[500]],
      },
      fontSize: {},
      fontWeight:
        platform === 'native'
          ? {}
          : Object.fromEntries(
              Object.entries(fontWeights).map(([name, weight]) => [name, String(weight)]),
            ),
      transitionDuration: {
        DEFAULT: platform === 'web' ? 'var(--duration-instant)' : `${motion.duration.instant}ms`,
        ...durations,
      },
      transitionTimingFunction: { DEFAULT: `cubic-bezier(${motion.easing.join(',')})` },
      animation: { none: 'none' },
      keyframes: {},
      aspectRatio,
      extend: {
        colors: {
          lisere: withOpacity(colors.archive, opacity.lisere),
          'lisere-hover': withOpacity(colors.archive, opacity['lisere-hover']),
          'lisere-active': withOpacity(colors.archive, opacity['lisere-active']),
        },
      },
    },
    plugins: [
      plugin(({ addBase, addUtilities }) => {
        addBase({
          ...(platform === 'web'
            ? {
                ':root': Object.fromEntries(
                  Object.entries(motion.duration).map(([key, value]) => [
                    `--duration-${key}`,
                    `${value}ms`,
                  ]),
                ),
                '@media (prefers-reduced-motion: reduce)': {
                  ':root': Object.fromEntries(
                    Object.keys(motion.duration).map((key) => [
                      `--duration-${key}`,
                      `${motion.reducedDuration}ms`,
                    ]),
                  ),
                },
                html: { colorScheme: 'dark' },
                body: {
                  backgroundColor: colors.ecrin,
                  color: colors.archive,
                  ...textStyle(typography.body, platform, typography.body.size),
                },
                ':focus-visible': {
                  outline: `${borders.focus.width}px solid ${borders.focus.color}`,
                  outlineOffset: `${borders.focus.offset}px`,
                },
              }
            : {}),
        });
        addUtilities(
          Object.fromEntries(
            Object.entries(typography).map(([name, token]) => {
              const compactSize = 'compactSize' in token ? token.compactSize : token.size;
              return [
                `.text-${name}`,
                {
                  ...textStyle(token, platform, compactSize),
                  ...(name === 'data' && platform === 'web'
                    ? { fontVariantNumeric: 'tabular-nums' }
                    : {}),
                  ...(name === 'button-label' ? { textTransform: 'uppercase' } : {}),
                  ...('compactSize' in token
                    ? {
                        [`@media (min-width: ${breakpoints.desktop}px)`]: textStyle(
                          token,
                          platform,
                          token.size,
                        ),
                      }
                    : {}),
                },
              ];
            }),
          ),
        );
        // Une classe sémantique sélectionne à la fois famille et graisse sur chaque plateforme.
        addUtilities(
          Object.fromEntries(
            Object.entries(fonts).flatMap(([family, font]) =>
              Object.entries(font.native).map(([weight, nativeFamily]) => {
                const weightName = Object.entries(fontWeights).find(
                  ([, value]) => value === Number(weight),
                )![0];
                return [
                  `.font-${family}-${weightName}`,
                  {
                    fontFamily:
                      platform === 'native'
                        ? nativeFamily
                        : webFontFamily(family as keyof typeof fonts).join(', '),
                    fontWeight: platform === 'native' ? 'normal' : weight,
                  },
                ];
              }),
            ),
          ),
        );
        if (platform === 'native') {
          // Les propriétés outline existent dans RN, mais NativeWind 4 nécessite le préfixe -rn.
          addUtilities({
            '.focus-indicator:focus': {
              '-rn-outline-width': String(borders.focus.width),
              '-rn-outline-offset': String(borders.focus.offset),
              '-rn-outline-color': borders.focus.color,
              '-rn-outline-style': 'solid',
            },
          });
          // NativeWind 4 ne résout pas les variables CSS de durée comme le navigateur.
          const selectors = [
            'transition',
            'transition-all',
            'transition-colors',
            'transition-opacity',
            'transition-shadow',
            'transition-transform',
            ...Object.keys(motion.duration).map((name) => `duration-${name}`),
          ];
          addUtilities({
            '@media (prefers-reduced-motion: reduce)': Object.fromEntries(
              selectors.map((name) => [
                `.${name}`,
                {
                  transitionDuration: `${motion.reducedDuration}ms`,
                  animationDuration: `${motion.reducedDuration}ms`,
                },
              ]),
            ),
          });
        }
      }),
    ],
  };
}
