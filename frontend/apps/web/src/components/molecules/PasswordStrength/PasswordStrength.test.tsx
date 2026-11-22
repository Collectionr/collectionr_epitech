import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PasswordStrength } from './PasswordStrength';

function getGauge(container: HTMLElement): HTMLElement {
  const gauge = container.querySelector<HTMLElement>('[role="progressbar"]');
  if (!gauge) {
    throw new Error('Jauge non rendue');
  }
  return gauge;
}

function getAnnouncement(container: HTMLElement): HTMLElement {
  const announcement = container.querySelector<HTMLElement>('[aria-live="polite"]');
  if (!announcement) {
    throw new Error('Région annoncée non rendue');
  }
  return announcement;
}

function getVisibleLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.grid > span:not(.invisible)')].map(
    (label) => label.textContent ?? '',
  );
}

describe('PasswordStrength', () => {
  it('champ vide : jauge vide, aucun libellé visible, rien d’annoncé', () => {
    const { container } = render(<PasswordStrength password="" />);

    expect(getGauge(container).getAttribute('aria-valuenow')).toBe('0');
    expect(getVisibleLabels(container)).toEqual([]);
    expect(getAnnouncement(container).textContent).toBe('');
  });

  it.each([
    ['pikachu', 'Faible', '1'],
    ['pikachu1', 'Correct', '2'],
    ['Pikachu-2026', 'Solide', '3'],
  ])('%j : libellé %s et jauge remplie à %s tiers sur 3', (password, label, thirds) => {
    const { container } = render(<PasswordStrength password={password} />);

    const gauge = getGauge(container);
    expect(gauge.getAttribute('aria-valuenow')).toBe(thirds);
    expect(gauge.getAttribute('aria-valuemax')).toBe('3');
    expect(getVisibleLabels(container)).toEqual([label]);
    expect(getAnnouncement(container).textContent).toBe(`Robustesse du mot de passe : ${label}`);
  });

  it('suit le calcul partagé : 16 caractères peu variés plafonnent à Correct', () => {
    const { container } = render(<PasswordStrength password="aaaaaaaaaaaaaaa1" />);

    expect(getVisibleLabels(container)).toEqual(['Correct']);
  });

  it('se met à jour à chaque frappe', () => {
    const { container, rerender } = render(<PasswordStrength password="p" />);
    expect(getVisibleLabels(container)).toEqual(['Faible']);

    rerender(<PasswordStrength password="pikachu1" />);
    expect(getVisibleLabels(container)).toEqual(['Correct']);

    rerender(<PasswordStrength password="Pikachu-2026" />);
    expect(getVisibleLabels(container)).toEqual(['Solide']);

    rerender(<PasswordStrength password="" />);
    expect(getVisibleLabels(container)).toEqual([]);
  });

  it('ne modifie pas la région annoncée tant que le niveau ne change pas', () => {
    const { container, rerender } = render(<PasswordStrength password="pikachu1" />);
    const textNode = getAnnouncement(container).firstChild;

    rerender(<PasswordStrength password="pikachu12" />);

    expect(getAnnouncement(container).firstChild).toBe(textNode);
    expect(getAnnouncement(container).textContent).toBe('Robustesse du mot de passe : Correct');
  });

  it('réserve la place des trois libellés et masque la jauge et les libellés aux lecteurs d’écran', () => {
    const { container } = render(<PasswordStrength password="pikachu1" />);

    const labels = container.querySelector('.grid');
    expect(labels?.getAttribute('aria-hidden')).toBe('true');
    expect(labels?.children).toHaveLength(3);
    expect(getGauge(container).parentElement?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('affiche le libellé en caption Archive, quel que soit le niveau', () => {
    render(<PasswordStrength password="pikachu" />);

    expect(screen.getByText('Faible').className).toBe('text-caption text-archive');
  });
});
