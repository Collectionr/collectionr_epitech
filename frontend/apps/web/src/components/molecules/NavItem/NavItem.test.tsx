// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NavItem } from '..';

describe('NavItem', () => {
  it('rend un lien natif focusable avec le libellé comme seul nom accessible', () => {
    render(<NavItem href="/catalogue" label="Catalogue" icon="grid" />);

    const link = screen.getByRole('link', { name: 'Catalogue' });
    expect(link).toBeInstanceOf(HTMLAnchorElement);
    expect(link.getAttribute('href')).toBe('/catalogue');
    expect(link.getAttribute('aria-current')).toBeNull();
    expect(link.tabIndex).toBe(0);
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('actualise aria-current et le libellé quand la page courante change', () => {
    const { rerender } = render(<NavItem href="/catalogue" label="Catalogue" icon="grid" />);
    const link = screen.getByRole('link', { name: 'Catalogue' });
    const label = within(link).getByText('Catalogue');
    expect(label.classList.contains('text-acier-texte')).toBe(true);

    rerender(<NavItem href="/catalogue" label="Catalogue" icon="grid" active />);
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(label.classList.contains('text-archive')).toBe(true);
    expect(link.classList.contains('border-signal')).toBe(true);

    rerender(<NavItem href="/catalogue" label="Catalogue" icon="grid" />);
    expect(link.getAttribute('aria-current')).toBeNull();
  });
});
