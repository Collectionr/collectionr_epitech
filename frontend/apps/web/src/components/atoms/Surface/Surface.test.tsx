import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Surface } from './Surface';
import type { SurfaceElement, SurfacePadding } from './Surface';

const PADDINGS: SurfacePadding[] = ['space-12', 'space-16', 'space-24', 'space-32'];

const ELEMENTS: SurfaceElement[] = ['section', 'article', 'li'];

describe('Surface', () => {
  it('rend une div avec le fond, l’arrondi et le liséré de carte', () => {
    const html = renderToStaticMarkup(<Surface>Contenu</Surface>);

    expect(html).toMatch(/^<div /);
    expect(html).toContain('bg-ecrin-elevated');
    expect(html).toContain('rounded-card');
    expect(html).toContain('border border-lisere');
  });

  it("n'ajoute ni ombre, ni hover, ni transition", () => {
    const html = renderToStaticMarkup(<Surface padding="space-16">Contenu</Surface>);

    expect(html).not.toContain('shadow');
    expect(html).not.toContain('hover:');
    expect(html).not.toContain('transition');
  });

  it("n'ajoute aucun padding par défaut", () => {
    const html = renderToStaticMarkup(<Surface>Contenu</Surface>);

    expect(html).not.toContain('p-space-');
  });

  it.each(PADDINGS)('applique le padding %s', (padding) => {
    const html = renderToStaticMarkup(<Surface padding={padding}>Contenu</Surface>);

    expect(html).toContain(`p-${padding}`);
  });

  it.each(ELEMENTS)('rend la balise %s avec as', (element) => {
    const html = renderToStaticMarkup(<Surface as={element}>Contenu</Surface>);

    expect(html).toMatch(new RegExp(`^<${element} `));
    expect(html).toContain('bg-ecrin-elevated');
  });

  it('refuse un padding hors tokens au niveau du typage', () => {
    const element = (
      // @ts-expect-error Seuls space-12, space-16, space-24 et space-32 sont autorisés.
      <Surface padding="space-8">Contenu</Surface>
    );

    expect(element).toBeDefined();
  });

  it('refuse une balise non prévue au niveau du typage', () => {
    const element = (
      // @ts-expect-error Seules div, section, article et li sont autorisées.
      <Surface as="span">Contenu</Surface>
    );

    expect(element).toBeDefined();
  });
});
