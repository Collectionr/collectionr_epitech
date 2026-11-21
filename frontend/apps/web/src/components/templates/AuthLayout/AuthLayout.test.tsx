import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthLayout } from './AuthLayout';

function renderLayout() {
  return render(
    <AuthLayout
      brandPanel={<p>Contenu de marque</p>}
      formPanel={<form aria-label="Formulaire de test" />}
    />,
  );
}

describe('AuthLayout', () => {
  it('place le contenu de marque dans un aside et le formulaire dans main', () => {
    renderLayout();

    expect(screen.getByRole('complementary').textContent).toBe('Contenu de marque');
    expect(screen.getByRole('main').contains(screen.getByRole('form'))).toBe(true);
  });

  it('suit l’ordre visuel : panneau de marque, puis formulaire', () => {
    renderLayout();

    const brandPanel = screen.getByRole('complementary');
    const formPanel = screen.getByRole('main');
    expect(brandPanel.nextElementSibling).toBe(formPanel);
  });

  it('masque le panneau de marque sous le seuil desktop, sans le compresser', () => {
    renderLayout();

    const classes = screen.getByRole('complementary').classList;
    expect(classes.contains('hidden')).toBe(true);
    expect(classes.contains('desktop:flex')).toBe(true);
    expect(classes.contains('desktop:w-1/2')).toBe(true);
  });

  it('occupe au moins la hauteur de l’écran', () => {
    const { container } = renderLayout();

    expect(container.firstElementChild?.classList.contains('min-h-dvh')).toBe(true);
  });
});
