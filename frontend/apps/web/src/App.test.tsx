// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { APP_NAME } from '@shared/constants';

import { App } from './App';

describe('App', () => {
  it("affiche le nom de l'application dans le titre principal", () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(APP_NAME);
  });
});
