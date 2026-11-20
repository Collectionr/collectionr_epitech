// @vitest-environment jsdom
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { Avatar } from './Avatar';
import type { AvatarSize } from './Avatar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

function render(ui: ReactElement): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(ui));
  const avatar = container.firstElementChild;
  if (!(avatar instanceof HTMLElement)) {
    throw new Error('Avatar non rendu');
  }
  return avatar;
}

afterEach(() => {
  act(() => root?.unmount());
  document.body.replaceChildren();
});

const SIZES: [AvatarSize, string, string][] = [
  ['sm', 'h-space-24 w-space-24', 'text-caption'],
  ['md', 'h-space-32 w-space-32', 'text-body'],
  ['lg', 'h-space-48 w-space-48', 'text-h2'],
];

describe('Avatar', () => {
  it("affiche l'initiale en majuscule, libellée par le nom", () => {
    const avatar = render(<Avatar name="ash_ketchum" />);

    expect(avatar.getAttribute('role')).toBe('img');
    expect(avatar.getAttribute('aria-label')).toBe('ash_ketchum');
    expect(avatar.textContent).toBe('A');
  });

  it('prend la première lettre réelle, accent compris, sans les espaces de tête', () => {
    expect(render(<Avatar name="  émilie" />).textContent).toBe('É');
  });

  it('est carrée, sur fond élevé avec liséré', () => {
    const avatar = render(<Avatar name="Ash" />);

    expect(avatar.className).toContain('bg-ecrin-elevated');
    expect(avatar.className).toContain('border border-lisere');
    expect(avatar.className).not.toContain('rounded');
  });

  it.each(SIZES)('applique la taille %s et sa variante de texte', (size, boxClasses, textClass) => {
    const avatar = render(<Avatar name="Ash" size={size} />);

    expect(avatar.className).toContain(boxClasses);
    expect(avatar.querySelector(`.${textClass}`)).not.toBeNull();
  });

  it('rend la taille md par défaut, en graisse 700', () => {
    const avatar = render(<Avatar name="Ash" />);
    const initial = avatar.querySelector('.text-body');

    expect(avatar.className).toContain('h-space-32 w-space-32');
    expect(initial?.className).toContain('font-sans-bold');
  });

  it("superpose la photo à l'initiale, invisible tant qu'elle n'est pas chargée", () => {
    const avatar = render(<Avatar name="Ash" src="/photo.png" />);
    const image = avatar.querySelector('img');

    expect(image?.getAttribute('alt')).toBe('Ash');
    expect(image?.className).toContain('opacity-0');
    expect(avatar.getAttribute('role')).toBeNull();
    expect(avatar.textContent).toBe('A');
  });

  it('fait apparaître la photo une fois chargée', () => {
    const avatar = render(<Avatar name="Ash" src="/photo.png" />);
    const image = avatar.querySelector('img');

    act(() => image?.dispatchEvent(new Event('load')));

    expect(image?.className).toContain('opacity-100');
    expect(image?.className).toContain('duration-instant');
  });

  it("revient à l'initiale si la photo ne charge pas", () => {
    const avatar = render(<Avatar name="Ash" src="/introuvable.png" />);

    act(() => avatar.querySelector('img')?.dispatchEvent(new Event('error')));

    expect(avatar.querySelector('img')).toBeNull();
    expect(avatar.getAttribute('role')).toBe('img');
    expect(avatar.getAttribute('aria-label')).toBe('Ash');
  });

  it('refuse une taille libre au niveau du typage', () => {
    const element = (
      // @ts-expect-error Seules les tailles sm, md et lg sont autorisées.
      <Avatar name="Ash" size="xl" />
    );

    expect(element).toBeDefined();
  });
});
