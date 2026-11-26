import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MOCK_CATALOGUE } from '@/mocks/data/catalogue';

import { CardPreviewPanel } from './CardPreviewPanel';

const [CHARIZARD, BLASTOISE] = MOCK_CATALOGUE;

function corners(panel: HTMLElement) {
  return panel.querySelectorAll('span.border-signal');
}

describe('CardPreviewPanel', () => {
  it('invite à choisir une carte dans un cadre vide au format de la carte', () => {
    render(<CardPreviewPanel selected={null} />);

    const panel = screen.getByRole('region', { name: 'Aperçu de la carte' });
    const message = within(panel).getByText('Choisissez une carte pour voir l’aperçu');
    expect(message.parentElement?.className).toContain('aspect-card');
    expect(corners(panel)).toHaveLength(0);
  });

  it('montre la carte choisie : vignette, nom en titre, set, numéro et rareté, prix « — »', () => {
    render(<CardPreviewPanel selected={CHARIZARD ?? null} />);

    const panel = screen.getByRole('region', { name: 'Aperçu de la carte' });
    expect(within(panel).getByRole('heading', { level: 2, name: 'Dracaufeu' })).toBeTruthy();
    expect(within(panel).getByText('Set de Base')).toBeTruthy();
    expect(within(panel).getByText('4').className).toContain('text-data');
    expect(within(panel).getByText('Rare').className).toContain('text-data');
    expect(within(panel).getByRole('img', { name: 'Dracaufeu — Set de Base 4' })).toBeTruthy();
    expect(within(panel).getByText('Prix indisponible')).toBeTruthy();
  });

  it('verrouille les coins du réticule sur la vignette, une fois par carte choisie', async () => {
    const { rerender } = render(<CardPreviewPanel selected={CHARIZARD ?? null} />);
    const panel = screen.getByRole('region', { name: 'Aperçu de la carte' });

    expect(corners(panel)).toHaveLength(4);
    expect(corners(panel)[0]?.className).toContain('opacity-0');
    expect(corners(panel)[0]?.className).toContain('duration-snap');
    await waitFor(() => expect(corners(panel)[0]?.className).toContain('opacity-100'));

    rerender(<CardPreviewPanel selected={BLASTOISE ?? null} />);

    expect(corners(panel)[0]?.className).toContain('opacity-0');
    await waitFor(() => expect(corners(panel)[0]?.className).toContain('opacity-100'));
  });
});
