// @vitest-environment jsdom
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button } from './Button';
import type { ButtonVariant } from './Button';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

function render(ui: ReactElement): HTMLButtonElement {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(ui));
  const button = container.querySelector('button');
  if (!button) {
    throw new Error('Button non rendu');
  }
  return button;
}

afterEach(() => {
  act(() => root?.unmount());
  document.body.replaceChildren();
});

const VARIANTS: [ButtonVariant, string, string][] = [
  [
    'primary',
    'border-transparent bg-signal text-archive',
    'hover:border-lisere-hover active:border-lisere-active',
  ],
  [
    'secondary',
    'border-acier-texte bg-transparent text-archive',
    'hover:border-lisere-active active:border-archive',
  ],
  [
    'ghost',
    'border-transparent bg-transparent text-archive',
    'hover:border-lisere-hover active:border-lisere-active',
  ],
  [
    'danger',
    'border-alerte/lisere-active bg-transparent text-alerte',
    'hover:border-alerte active:border-alerte',
  ],
];

describe('Button (rendu)', () => {
  it('rend un button natif de type button par défaut', () => {
    const html = renderToStaticMarkup(<Button variant="primary">Scanner</Button>);

    expect(html).toMatch(/^<button type="button" /);
    expect(html).toContain('Scanner');
  });

  it('accepte le type submit', () => {
    const html = renderToStaticMarkup(
      <Button variant="primary" type="submit">
        Créer mon compte
      </Button>,
    );

    expect(html).toMatch(/^<button type="submit" /);
  });

  it('applique la hauteur de contrôle, le padding, le token button-label et la transition', () => {
    const html = renderToStaticMarkup(<Button variant="secondary">Annuler</Button>);

    for (const className of [
      'h-control',
      'px-space-16',
      'text-button-label',
      'rounded-none',
      'border ',
      'transition-colors',
      'duration-instant',
    ]) {
      expect(html).toContain(className);
    }
  });

  it("n'ajoute ni ombre, ni pression, ni animation, et ne retire pas le focus global", () => {
    const html = renderToStaticMarkup(<Button variant="primary">Scanner</Button>);

    expect(html).not.toContain('shadow');
    expect(html).not.toContain('scale');
    expect(html).not.toContain('animate');
    expect(html).not.toContain('outline');
    expect(html).not.toMatch(/rounded-(?!none)/);
    expect(html).not.toContain('style=');
  });

  it("n'utilise pas l'atome Text pour le libellé", () => {
    const html = renderToStaticMarkup(<Button variant="ghost">Voir</Button>);

    expect(html).not.toMatch(/text-(body|caption|data|h1|h2|display)\b/);
  });

  it.each(VARIANTS)(
    'applique les couleurs et le liséré de la variante %s',
    (variant, restClasses, feedbackClasses) => {
      const html = renderToStaticMarkup(<Button variant={variant}>Action</Button>);

      expect(html).toContain(restClasses);
      expect(html).toContain(feedbackClasses);
    },
  );

  it('occupe toute la largeur avec fullWidth uniquement', () => {
    expect(renderToStaticMarkup(<Button variant="primary">Scanner</Button>)).not.toContain(
      'w-full',
    );
    expect(
      renderToStaticMarkup(
        <Button variant="primary" fullWidth>
          Scanner
        </Button>,
      ),
    ).toContain('w-full');
  });

  it('désactive avec l’attribut natif et l’opacité disabled, sans retour de survol', () => {
    const html = renderToStaticMarkup(
      <Button variant="danger" disabled>
        Supprimer
      </Button>,
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain('opacity-disabled');
    expect(html).not.toContain('hover:');
    expect(html).not.toContain('active:');
  });

  it("place l'icône à gauche du libellé, masquée aux lecteurs d'écran", () => {
    const html = renderToStaticMarkup(
      <Button variant="secondary" icon={<svg data-testid="icone" />}>
        Filtrer
      </Button>,
    );

    expect(html).toContain('gap-space-8');
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*"><svg data-testid="icone"/);
    expect(html.indexOf('icone')).toBeLessThan(html.indexOf('Filtrer'));
  });

  it("n'ajoute aucun conteneur d'icône sans icône", () => {
    const html = renderToStaticMarkup(<Button variant="secondary">Filtrer</Button>);

    expect(html).not.toContain('aria-hidden');
  });

  it('remplace le contenu pendant le chargement, sans spinner, à largeur figée', () => {
    const html = renderToStaticMarkup(
      <Button variant="primary" loading loadingLabel="Envoi…" icon={<svg data-testid="icone" />}>
        Envoyer
      </Button>,
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/<span class="[^"]*\binvisible\b[^"]*"><span aria-hidden="true"/);
    expect(html).toContain('<span class="col-start-1 row-start-1 text-center">Envoi…</span>');
    expect(html).not.toContain('truncate');
    expect(html).not.toContain('animate');
  });

  it('réserve la place du libellé de chargement, masqué hors chargement', () => {
    const html = renderToStaticMarkup(
      <Button variant="primary" loading={false} loadingLabel="Annulation…" icon={<svg />}>
        Annuler
      </Button>,
    );

    expect(html).not.toContain('aria-busy');
    expect(html).toContain(
      '<span class="col-start-1 row-start-1 text-center invisible">Annulation…</span>',
    );
    expect(html).toMatch(/<span class="[^"]*gap-space-8"><span aria-hidden="true"/);
  });

  it('ne rend aucune couche de chargement sans loadingLabel', () => {
    const html = renderToStaticMarkup(<Button variant="primary">Scanner</Button>);

    expect(html).not.toContain('invisible');
    expect(html).not.toContain('text-center');
  });

  it('coupe le retour de survol pendant le chargement', () => {
    const html = renderToStaticMarkup(
      <Button variant="secondary" loading loadingLabel="Envoi…">
        Envoyer
      </Button>,
    );

    expect(html).not.toContain('hover:');
    expect(html).not.toContain('opacity-disabled');
  });

  it('exige un libellé de chargement au niveau du typage', () => {
    const element = (
      // @ts-expect-error loadingLabel est obligatoire avec loading.
      <Button variant="primary" loading>
        Envoyer
      </Button>
    );

    expect(element).toBeDefined();
  });

  it('refuse une variante ou un type non prévus au niveau du typage', () => {
    const variant = (
      // @ts-expect-error Seules primary, secondary, ghost et danger existent.
      <Button variant="link">Voir</Button>
    );
    const type = (
      // @ts-expect-error Seuls button et submit sont autorisés.
      <Button variant="primary" type="reset">
        Vider
      </Button>
    );

    expect(variant).toBeDefined();
    expect(type).toBeDefined();
  });
});

describe('Button (interactions)', () => {
  it('appelle onClick au clic', () => {
    const onClick = vi.fn();
    const button = render(
      <Button variant="primary" onClick={onClick}>
        Scanner
      </Button>,
    );

    act(() => button.click());

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('ignore les clics pendant le chargement, en restant focalisable', () => {
    const onClick = vi.fn();
    const button = render(
      <Button variant="primary" loading loadingLabel="Envoi…" onClick={onClick}>
        Envoyer
      </Button>,
    );

    act(() => button.click());
    act(() => button.focus());

    expect(onClick).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(button);
  });

  it('ne soumet pas le formulaire pendant le chargement', () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const form = document.createElement('form');
    form.addEventListener('submit', onSubmit);
    document.body.append(form);
    root = createRoot(form);
    const ui = (loading: boolean) => (
      <Button variant="primary" type="submit" loading={loading} loadingLabel="Envoi…">
        Envoyer
      </Button>
    );

    act(() => root?.render(ui(true)));
    act(() => form.querySelector('button')?.click());
    expect(onSubmit).not.toHaveBeenCalled();

    act(() => root?.render(ui(false)));
    act(() => form.querySelector('button')?.click());
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('ne réagit pas au clic une fois désactivé', () => {
    const onClick = vi.fn();
    const button = render(
      <Button variant="secondary" disabled onClick={onClick}>
        Annuler
      </Button>,
    );

    act(() => button.click());

    expect(onClick).not.toHaveBeenCalled();
  });

  it('reçoit le focus clavier', () => {
    const button = render(<Button variant="ghost">Voir</Button>);

    act(() => button.focus());

    expect(document.activeElement).toBe(button);
    expect(button.tabIndex).toBe(0);
  });
});
