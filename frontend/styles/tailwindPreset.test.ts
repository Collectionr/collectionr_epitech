import { createRequire } from 'node:module';

import postcss from 'postcss';
import { cssToReactNativeRuntime } from 'react-native-css-interop/css-to-rn';
import tailwindcss from 'tailwindcss';
import type { Config } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

import {
  breakpoints,
  borders,
  colors,
  fonts,
  fontWeights,
  motion,
  opacity,
  spacing,
  typography,
} from '../packages/shared/src/tokens';

const require = createRequire(import.meta.url);
const classes =
  'text-display text-h1 text-data text-button-label bg-ecrin bg-lisere p-space-16 transition-opacity duration-snap focus-indicator font-bold font-sans font-mono font-sans-extrabold font-mono-semibold';

async function compile(platform: 'web' | 'mobile') {
  const config = require(
    `../apps/${platform}/tailwind.config.${platform === 'web' ? 'cjs' : 'js'}`,
  ) as Config;
  return postcss([tailwindcss({ ...config, content: [{ raw: classes }] })]).process(
    '@tailwind base; @tailwind utilities;',
    { from: undefined },
  );
}

describe('raccordement du design system', () => {
  it('génère les styles web, le breakpoint, le focus et les durées réduites depuis les tokens', async () => {
    const { root, css } = await compile('web');
    expect(css).toContain(`background-color: ${colors.ecrin}`);
    expect(css).toContain(`padding: ${spacing['space-16']}px`);
    expect(css).toContain(`font-size: ${typography.h1.compactSize}px`);
    expect(css).toContain(`@media (min-width: ${breakpoints.desktop}px)`);
    expect(css).toContain(`font-size: ${typography.h1.size}px`);
    expect(css).toContain('font-variant-numeric: tabular-nums');
    expect(css).toContain(':focus-visible');
    expect(css).toContain(`font-weight: ${fontWeights.bold}`);
    expect(css).toContain(`cubic-bezier(${motion.easing.join(',')})`);
    for (const [selector, family] of [
      ['.text-h1', 'sans'],
      ['.font-sans', 'sans'],
      ['.text-data', 'mono'],
      ['.font-mono', 'mono'],
    ] as const) {
      const declarations: string[] = [];
      root.walkRules(selector, (rule) => {
        rule.walkDecls('font-family', (declaration) => {
          declarations.push(declaration.value);
        });
      });
      expect(declarations.length).toBeGreaterThan(0);
      for (const value of declarations) {
        for (const fallback of fonts[family].fallback) expect(value).toContain(fallback);
      }
    }
    let lisere = '';
    root.walkRules('.bg-lisere', (rule) => {
      rule.walkDecls('background-color', (declaration) => {
        lisere = declaration.value;
      });
    });
    const rgb = [1, 3, 5].map((offset) =>
      Number.parseInt(colors.archive.slice(offset, offset + 2), 16),
    );
    expect(lisere.replaceAll(' ', '')).toBe(`rgba(${rgb.join(',')},${opacity.lisere})`);
    let overrideIndex = -1;
    let bodyIndex = -1;
    let index = 0;
    root.walkRules((rule) => {
      if (rule.selector === '.text-data') bodyIndex = index;
      if (rule.selector === '.font-mono-semibold') {
        overrideIndex = index;
        expect(rule.toString()).toContain(`font-weight: ${fontWeights.semibold}`);
      }
      index++;
    });
    expect(overrideIndex).toBeGreaterThan(bodyIndex);
    root.walkRules('.text-button-label', (rule) => {
      expect(rule.nodes.some((node) => node.type === 'decl' && node.prop === 'line-height')).toBe(
        false,
      );
    });
    let reducedDurations = 0;
    root.walkAtRules('media', (rule) => {
      if (rule.params !== '(prefers-reduced-motion: reduce)') return;
      rule.walkDecls(/^--duration-/, (declaration) => {
        expect(declaration.value).toBe(`${motion.reducedDuration}ms`);
        reducedDurations += 1;
      });
    });
    expect(reducedDurations).toBe(Object.keys(motion.duration).length);
  });

  it('produit des styles natifs exploitables avec les fontes embarquées et reduced motion', async () => {
    const { css } = await compile('mobile');
    const native = cssToReactNativeRuntime(css);
    const rules = native.rules;
    expect(rules?.['focus-indicator']).toMatchObject({
      focus: true,
      n: [
        expect.objectContaining({
          pseudoClasses: { focus: true },
          d: [
            [
              expect.objectContaining({
                outlineWidth: borders.focus.width,
                outlineOffset: borders.focus.offset,
                outlineColor: borders.focus.color.toLowerCase(),
                outlineStyle: 'solid',
              }),
            ],
          ],
        }),
      ],
    });
    expect(rules?.['text-data']?.warnings).toBeUndefined();
    expect(JSON.stringify(rules?.['text-data'])).toContain(fonts.mono.native[500]);
    expect(JSON.stringify(rules?.['text-h1'])).toContain(fonts.sans.native[700]);
    expect(rules?.['font-bold']).toBeUndefined();
    expect(JSON.stringify(rules?.['font-sans-extrabold'])).toContain(fonts.sans.native[800]);
    expect(JSON.stringify(rules?.['font-mono-semibold'])).toContain(fonts.mono.native[600]);
    const transitions = rules?.['duration-snap']?.n;
    expect(
      transitions?.some((rule) =>
        rule.transition?.duration?.some((duration) => duration.value === motion.duration.snap),
      ),
    ).toBe(true);
    expect(
      transitions?.some(
        (rule) =>
          JSON.stringify(rule.media ?? []).includes('prefers-reduced-motion') &&
          rule.transition?.duration?.some((duration) => duration.value === motion.reducedDuration),
      ),
    ).toBe(true);
  });
});
