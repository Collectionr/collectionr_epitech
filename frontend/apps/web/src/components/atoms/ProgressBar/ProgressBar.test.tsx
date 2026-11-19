import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProgressBar } from './ProgressBar';

function fillTransform(html: string): string | undefined {
  return /style="transform:([^"]*)"/.exec(html)?.[1];
}

describe('ProgressBar', () => {
  it('expose la progression aux lecteurs d’écran', () => {
    const html = renderToStaticMarkup(
      <ProgressBar value={45} max={120} aria-label="Progression du set" />,
    );

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Progression du set"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="120"');
    expect(html).toContain('aria-valuenow="45"');
  });

  it('remplit en proportion de la valeur, depuis la gauche', () => {
    const html = renderToStaticMarkup(
      <ProgressBar value={45} max={120} aria-label="Progression du set" />,
    );

    expect(fillTransform(html)).toBe('scaleX(0.375)');
    expect(html).toContain('origin-left');
  });

  it('se lit en pourcentage par défaut', () => {
    const html = renderToStaticMarkup(<ProgressBar value={60} aria-label="Progression" />);

    expect(html).toContain('aria-valuemax="100"');
    expect(fillTransform(html)).toBe('scaleX(0.6)');
  });

  it.each([
    [-10, '0', 'scaleX(0)'],
    [150, '100', 'scaleX(1)'],
    [Number.NaN, '0', 'scaleX(0)'],
  ])('ramène %s entre 0 et max', (value, now, transform) => {
    const html = renderToStaticMarkup(<ProgressBar value={value} aria-label="Progression" />);

    expect(html).toContain(`aria-valuenow="${now}"`);
    expect(fillTransform(html)).toBe(transform);
  });

  it('reste vide si max est nul ou négatif', () => {
    const html = renderToStaticMarkup(<ProgressBar value={3} max={0} aria-label="Progression" />);

    expect(html).toContain('aria-valuemax="0"');
    expect(fillTransform(html)).toBe('scaleX(0)');
  });

  it('suit les tokens : 8 px, fond liséré, remplissage Archive, transition, sans arrondi', () => {
    const html = renderToStaticMarkup(<ProgressBar value={1} aria-label="Progression" />);

    for (const className of [
      'h-space-8',
      'bg-lisere',
      'bg-archive',
      'rounded-none',
      'transition-transform',
      'duration-signature',
    ]) {
      expect(html).toContain(className);
    }
    expect(html).not.toMatch(/rounded-(?!none)/);
    expect(html).not.toContain('signal');
    expect(html.match(/style="/g)).toHaveLength(1);
  });

  it('exige un libellé accessible au niveau du typage', () => {
    // @ts-expect-error aria-label est obligatoire.
    const element = <ProgressBar value={3} />;

    expect(element).toBeDefined();
  });
});
