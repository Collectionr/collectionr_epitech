import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('affiche la page correspondant à l’adresse du navigateur', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined();
  });
});
