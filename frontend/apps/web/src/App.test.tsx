import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('restaure la session puis envoie un visiteur sans session vers la connexion', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeDefined();
  });
});
