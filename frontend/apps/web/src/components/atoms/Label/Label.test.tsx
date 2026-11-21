import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Label } from './Label';

describe('Label', () => {
  it('rend un <label> natif relié au champ par htmlFor', () => {
    const { container } = render(<Label htmlFor="email">Adresse e-mail</Label>);

    const label = container.querySelector('label');
    expect(label?.getAttribute('for')).toBe('email');
    expect(label?.textContent).toBe('Adresse e-mail');
  });

  it('affiche l’intitulé en caption Archive', () => {
    render(<Label htmlFor="email">Adresse e-mail</Label>);

    expect(screen.getByText('Adresse e-mail').className).toBe('text-caption text-archive');
  });

  it('donne son intitulé au champ associé', () => {
    render(
      <>
        <Label htmlFor="email">Adresse e-mail</Label>
        <input id="email" />
      </>,
    );

    expect(screen.getByRole('textbox', { name: 'Adresse e-mail' })).toBeTruthy();
  });

  it('sans required, n’affiche pas d’astérisque', () => {
    const { container } = render(<Label htmlFor="email">Adresse e-mail</Label>);

    expect(container.textContent).not.toContain('*');
  });

  it('avec required, affiche un astérisque acier-texte masqué aux lecteurs d’écran', () => {
    const { container } = render(
      <Label htmlFor="email" required>
        Adresse e-mail
      </Label>,
    );

    const mark = screen.getByText('*');
    expect(mark.className).toBe('text-caption text-acier-texte');
    expect(mark.parentElement?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('label')?.contains(mark)).toBe(true);
  });

  it('avec required, n’ajoute pas l’astérisque au nom accessible du champ', () => {
    render(
      <>
        <Label htmlFor="email" required>
          Adresse e-mail
        </Label>
        <input id="email" required />
      </>,
    );

    expect(screen.getByRole('textbox', { name: 'Adresse e-mail' })).toBeTruthy();
  });

  it('refuse à la compilation un label sans htmlFor', () => {
    // @ts-expect-error htmlFor est obligatoire : un label orphelin ne doit pas compiler.
    render(<Label>Adresse e-mail</Label>);

    expect(screen.getByText('Adresse e-mail')).toBeTruthy();
  });
});
