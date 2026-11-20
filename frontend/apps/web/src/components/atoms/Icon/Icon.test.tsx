import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { iconography } from '@shared/tokens';

import { Icon } from './Icon';
import type { IconName, IconSize } from './Icon';

const NAMES: IconName[] = ['eye', 'eye-off', 'search', 'bell', 'plus', 'sparkle', 'grid', 'list'];

const SIZES = Object.keys(iconography.sizes) as IconSize[];

describe('Icon', () => {
  it.each(NAMES)('rend %s en trait seul, angles vifs et terminaisons nettes', (name) => {
    const html = renderToStaticMarkup(<Icon name={name} />);

    expect(html).toMatch(/^<svg /);
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-linecap="butt"');
    expect(html).toContain('stroke-linejoin="miter"');
    expect(html).not.toContain('rx=');
    // Un segment quasi nul (h.01, v.01) disparaît avec des terminaisons nettes.
    expect(html).not.toMatch(/[hv]\.01/);
  });

  it('dessine les 3 puces de la liste, visibles avec des terminaisons nettes', () => {
    const html = renderToStaticMarkup(<Icon name="list" />);
    const bullets = html.match(/<rect [^>]*>/g) ?? [];

    expect(bullets).toHaveLength(3);
    for (const bullet of bullets) {
      expect(bullet).toContain('width="2"');
      expect(bullet).toContain('height="2"');
    }
    expect(html).toContain('d="M8 5h13M8 12h13M8 19h13"');
  });

  it('rend la taille md par défaut', () => {
    const html = renderToStaticMarkup(<Icon name="search" />);

    expect(html).toContain(`width="${iconography.sizes.md}"`);
    expect(html).toContain(`height="${iconography.sizes.md}"`);
  });

  it.each(SIZES)('garde un trait de 1,5 px à la taille %s', (size) => {
    const pixels = iconography.sizes[size];
    const html = renderToStaticMarkup(<Icon name="plus" size={size} />);

    // Le trait est exprimé dans les unités du viewBox (24) : ramené à la taille rendue, il fait 1,5 px.
    expect(html).toContain(`width="${pixels}"`);
    expect(html).toContain(`stroke-width="${(iconography.stroke * iconography.grid) / pixels}"`);
  });

  it('est décorative et masquée sans libellé', () => {
    const html = renderToStaticMarkup(<Icon name="eye" />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role=');
  });

  it('expose un libellé quand elle porte seule le sens', () => {
    const html = renderToStaticMarkup(<Icon name="bell" label="Notifications" />);

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Notifications"');
    expect(html).not.toContain('aria-hidden');
  });

  it('refuse une icône inconnue au niveau du typage', () => {
    const element = (
      // @ts-expect-error Seules les icônes du set sont disponibles.
      <Icon name="camera" />
    );

    expect(element).toBeDefined();
  });
});
