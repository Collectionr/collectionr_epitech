import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Price } from './Price';

const NO_BREAK = '\u00A0';

/**
 * `getByText` normalise les espaces (insécables compris) : ses requêtes s'écrivent avec des espaces
 * simples, les comparaisons de `textContent` avec l'espace insécable.
 */

/** Partie affichée pour les yeux, masquée aux lecteurs d'écran. */
function visiblePart(container: HTMLElement) {
  return container.querySelector('[aria-hidden="true"]');
}

describe('Price', () => {
  it('affiche le montant en Data-Mono et le lit en toutes lettres', () => {
    const { container } = render(<Price amount={12.4} />);

    expect(visiblePart(container)?.textContent).toBe(`12,40${NO_BREAK}EUR`);
    expect(visiblePart(container)?.querySelector('.text-data')).not.toBeNull();
    expect(screen.getByText(`12,40 euros`).className).toBe('sr-only');
  });

  it('affiche une hausse en Archive avec ↗', () => {
    const { container } = render(<Price amount={12.4} change={0.032} />);

    const variation = screen.getByText(`↗ 3,2 %`);
    expect(variation.className).toContain('text-archive');
    expect(visiblePart(container)?.textContent).toContain('↗');
    expect(screen.getByText(`12,40 euros, en hausse de 3,2 %`)).toBeTruthy();
  });

  it('affiche une baisse en acier-texte avec ↘, jamais en rouge, vert ni Signal', () => {
    const { container } = render(<Price amount={12.4} change={-0.05} />);

    const variation = screen.getByText(`↘ 5 %`);
    expect(variation.className).toContain('text-acier-texte');
    expect(container.innerHTML).not.toMatch(/alerte|signal|green|red/);
    expect(screen.getByText(`12,40 euros, en baisse de 5 %`)).toBeTruthy();
  });

  it('signale une variation nulle sans flèche', () => {
    render(<Price amount={12.4} change={0} />);

    expect(screen.getByText(`0 %`).textContent).not.toMatch(/[↗↘]/);
    expect(screen.getByText(`12,40 euros, stable`)).toBeTruthy();
  });

  it('affiche « — » pour un prix absent, jamais 0 EUR', () => {
    const { container } = render(<Price amount={null} />);

    expect(visiblePart(container)?.textContent).toBe('—');
    expect(screen.getByText('Prix indisponible').className).toBe('sr-only');
    expect(container.textContent).not.toContain('EUR');
  });

  it('s’aligne à droite dans une colonne de montants', () => {
    const { container } = render(<Price amount={1240.5} align="end" />);

    expect(container.firstElementChild?.className).toContain('justify-end');
  });

  it('n’anime rien quand le prix change', () => {
    const { container, rerender } = render(<Price amount={12.4} />);
    rerender(<Price amount={13} change={0.048} />);

    expect(container.innerHTML).not.toMatch(/transition|animate|duration/);
  });
});
