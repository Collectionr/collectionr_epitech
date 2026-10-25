import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Text } from './Text';
import type { TextVariant } from './Text';

const DEFAULT_TAGS: [TextVariant, string][] = [
  ['display', 'h1'],
  ['h1', 'h1'],
  ['h2', 'h2'],
  ['body', 'p'],
  ['caption', 'span'],
  ['data', 'span'],
];

describe('Text', () => {
  it.each(DEFAULT_TAGS)('rend la variante %s dans la balise %s avec sa classe', (variant, tag) => {
    const html = renderToStaticMarkup(<Text variant={variant}>Pikachu</Text>);

    expect(html).toContain(`<${tag} `);
    expect(html).toContain(`text-${variant}`);
    expect(html).toContain('text-archive');
  });

  it('remplace la balise par défaut avec as', () => {
    const html = renderToStaticMarkup(
      <Text variant="h2" as="h3">
        Sets
      </Text>,
    );

    expect(html).toMatch(/^<h3 /);
    expect(html).toContain('text-h2');
  });

  it('applique la couleur demandée', () => {
    const html = renderToStaticMarkup(
      <Text variant="caption" color="alerte">
        Erreur
      </Text>,
    );

    expect(html).toContain('text-alerte');
    expect(html).not.toContain('text-archive');
  });

  it('autorise Signal sur display, h1 et h2', () => {
    const html = renderToStaticMarkup(
      <Text variant="h1" color="signal">
        Titre
      </Text>,
    );

    expect(html).toContain('text-signal');
  });

  it('refuse Signal sur le texte courant au niveau du typage', () => {
    const element = (
      // @ts-expect-error Signal n'est pas autorisé sous 18 px.
      <Text variant="body" color="signal">
        Texte
      </Text>
    );

    expect(element).toBeDefined();
  });

  it('applique la graisse demandée sur une variante Schibsted', () => {
    const html = renderToStaticMarkup(
      <Text variant="body" weight={700}>
        Gras
      </Text>,
    );

    expect(html).toContain('font-weight:700');
  });

  it('ignore la graisse sur la variante data', () => {
    const html = renderToStaticMarkup(
      <Text variant="data" weight={900}>
        247
      </Text>,
    );

    expect(html).not.toContain('font-weight');
  });

  it('ne force aucune graisse par défaut', () => {
    const html = renderToStaticMarkup(<Text variant="h1">Titre</Text>);

    expect(html).not.toContain('style=');
  });

  it('tronque sur une ligne avec truncate', () => {
    const html = renderToStaticMarkup(
      <Text variant="body" truncate>
        Un nom de carte très très long
      </Text>,
    );

    expect(html).toContain('truncate');
    expect(html).toContain('block');
  });

  it("n'ajoute pas de troncature par défaut", () => {
    const html = renderToStaticMarkup(<Text variant="body">Court</Text>);

    expect(html).not.toContain('truncate');
  });
});
