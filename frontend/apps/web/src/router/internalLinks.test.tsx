import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { getInternalLinkPath, useInternalLinkNavigation } from './internalLinks';
import type { LinkClickEvent } from './internalLinks';

const ORIGIN = window.location.origin;

function createLink(href: string, attributes: Record<string, string> = {}): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = href;
  for (const [name, value] of Object.entries(attributes)) {
    link.setAttribute(name, value);
  }
  link.textContent = 'Lien';
  document.body.append(link);
  return link;
}

function click(target: EventTarget, init: Partial<LinkClickEvent> = {}): LinkClickEvent {
  return {
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target,
    ...init,
  };
}

describe('getInternalLinkPath', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('intercepte un clic simple sur un lien interne, paramètres et ancre compris', () => {
    const link = createLink('/collections?tri=nom#haut');

    expect(getInternalLinkPath(click(link), ORIGIN)).toBe('/collections?tri=nom#haut');
  });

  it('intercepte un clic sur un élément contenu dans le lien', () => {
    const link = createLink('/profil');
    const label = document.createElement('span');
    link.append(label);

    expect(getInternalLinkPath(click(label), ORIGIN)).toBe('/profil');
  });

  it.each([
    ['Cmd+clic', { metaKey: true }],
    ['Ctrl+clic', { ctrlKey: true }],
    ['Maj+clic', { shiftKey: true }],
    ['Alt+clic', { altKey: true }],
    ['clic du bouton du milieu', { button: 1 }],
    ['clic déjà traité', { defaultPrevented: true }],
  ])('laisse faire le navigateur sur un %s', (_label, init) => {
    const link = createLink('/collections');

    expect(getInternalLinkPath(click(link, init), ORIGIN)).toBeNull();
  });

  it.each([['_blank'], ['_parent'], ['cadre']])(
    'laisse faire le navigateur avec target="%s"',
    (target) => {
      expect(getInternalLinkPath(click(createLink('/collections', { target })), ORIGIN)).toBeNull();
    },
  );

  it('intercepte un lien avec target="_self"', () => {
    expect(
      getInternalLinkPath(click(createLink('/collections', { target: '_self' })), ORIGIN),
    ).toBe('/collections');
  });

  it('laisse faire le navigateur sur un lien de téléchargement', () => {
    expect(
      getInternalLinkPath(click(createLink('/export.csv', { download: '' })), ORIGIN),
    ).toBeNull();
  });

  it('laisse faire le navigateur sur un lien vers une autre origine', () => {
    expect(getInternalLinkPath(click(createLink('https://pokemon.com/cartes')), ORIGIN)).toBeNull();
  });

  it('laisse faire le navigateur sur un lien marqué rel="external"', () => {
    expect(
      getInternalLinkPath(click(createLink('/aide', { rel: 'noopener external' })), ORIGIN),
    ).toBeNull();
  });

  it('ignore un clic hors lien', () => {
    const button = document.createElement('button');
    document.body.append(button);

    expect(getInternalLinkPath(click(button), ORIGIN)).toBeNull();
    expect(getInternalLinkPath(click(document.createTextNode('texte')), ORIGIN)).toBeNull();
  });
});

describe('useInternalLinkNavigation', () => {
  function Root() {
    useInternalLinkNavigation();
    return <Outlet />;
  }

  function renderRouter() {
    const router = createMemoryRouter(
      [
        {
          element: <Root />,
          children: [
            {
              path: '/',
              element: (
                <a href="/collections">
                  <span>Voir mes collections</span>
                </a>
              ),
            },
            { path: '/collections', element: <h1>Mes collections</h1> },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);
    return router;
  }

  it('change de page par le routeur, sans laisser le navigateur recharger', async () => {
    const router = renderRouter();
    const link = screen.getByText('Voir mes collections');

    const notPrevented = fireEvent.click(link);

    expect(notPrevented).toBe(false);
    expect(await screen.findByRole('heading', { name: 'Mes collections' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/collections');
  });
});
