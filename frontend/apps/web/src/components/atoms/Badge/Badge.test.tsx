// @vitest-environment jsdom
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { Badge } from './Badge';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement;

function render(ui: ReactElement): Element | null {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(ui));
  return container.firstElementChild;
}

afterEach(() => {
  act(() => root?.unmount());
  document.body.replaceChildren();
});

describe('Badge', () => {
  it('affiche le compteur, libellé pour les lecteurs d’écran', () => {
    const badge = render(<Badge count={3} aria-label="3 notifications non lues" />);

    expect(badge?.getAttribute('role')).toBe('img');
    expect(badge?.getAttribute('aria-label')).toBe('3 notifications non lues');
    expect(badge?.textContent).toBe('3');
  });

  it('est carré, fond Archive, chiffre Écrin en variante data', () => {
    const badge = render(<Badge count={7} aria-label="7 doublons" />);

    for (const className of [
      'h-badge',
      'min-w-badge',
      'px-space-4',
      'bg-archive',
      'rounded-none',
    ]) {
      expect(badge?.className).toContain(className);
    }
    const text = badge?.querySelector('.text-data');
    expect(text?.className).toContain('text-ecrin');
    expect(badge?.outerHTML).not.toContain('style=');
  });

  it.each([
    [42, '42'],
    [99, '99'],
    [100, '99+'],
    [1500, '99+'],
    [4.8, '4'],
  ])('affiche %s comme « %s »', (count, expected) => {
    expect(render(<Badge count={count} aria-label="Notifications" />)?.textContent).toBe(expected);
  });

  it.each([0, -2, 0.5, Number.NaN])('ne rend rien pour %s (pas de badge vide)', (count) => {
    render(<Badge count={count} aria-label="Notifications" />);

    expect(container.innerHTML).toBe('');
  });

  it('apparaît en fondu et rejoue le fondu du chiffre à chaque changement de valeur', () => {
    const badge = render(<Badge count={1} aria-label="1 notification" />);
    const before = badge?.firstElementChild;

    act(() => root?.render(<Badge count={2} aria-label="2 notifications" />));
    const after = container.firstElementChild?.firstElementChild;

    expect(badge?.className).toContain('animate-fade-in');
    expect(after?.className).toContain('animate-fade-in');
    expect(after).not.toBe(before);
    expect(container.firstElementChild).toBe(badge);
  });

  it('exige un libellé accessible au niveau du typage', () => {
    // @ts-expect-error aria-label est obligatoire.
    const element = <Badge count={3} />;

    expect(element).toBeDefined();
  });
});
