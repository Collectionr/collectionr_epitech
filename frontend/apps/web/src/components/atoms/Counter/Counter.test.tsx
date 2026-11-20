// @vitest-environment jsdom
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { motion } from '@shared/tokens';

import { Counter } from './Counter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGURE_SPACE = '\u2007';
const NO_BREAK_SPACE = '\u00A0';
const RETRY = <button type="button">Réessayer</button>;

let root: Root | undefined;
let container: HTMLDivElement;

function render(ui: ReactElement) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(ui));
}

function rerender(ui: ReactElement) {
  act(() => root?.render(ui));
}

function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

/** Avance milliseconde par milliseconde : chaque pas planifie le suivant après son rendu. */
function elapse(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 1) {
    advance(1);
  }
}

/** Région annoncée par les lecteurs d'écran. */
function statusElement(): HTMLElement {
  const element = container.querySelector<HTMLElement>('[role="status"]');
  if (!element) {
    throw new Error('Counter non rendu');
  }
  return element;
}

function status(): string {
  return statusElement().textContent ?? '';
}

/** Partie visible, masquée aux lecteurs d'écran. */
function visible(): string {
  return container.querySelector('[role="status"] + [aria-hidden="true"]')?.textContent ?? '';
}

function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers();
  mockReducedMotion(false);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('Counter', () => {
  it('affiche la progression en cours, annoncée poliment', () => {
    render(<Counter ready={2} total={3} />);

    expect(status()).toBe('[ 2 / 3 prêtes ]');
    expect(visible()).toBe('[ 2 / 3 prêtes ]');
    expect(statusElement().getAttribute('aria-live')).toBe('polite');
    expect(statusElement().getAttribute('aria-atomic')).toBe('true');
    expect(statusElement().className).toContain('sr-only');
  });

  it('affiche la durée totale une fois tout prêt', () => {
    render(<Counter ready={3} total={3} durationMs={1234} />);

    expect(status()).toBe(`[ 3 / 3 prêtes ] · 1,2${NO_BREAK_SPACE}s`);
    expect(visible()).toBe(`[ 3 / 3 prêtes ] · 1,2${NO_BREAK_SPACE}s`);
  });

  it("n'affiche pas la durée tant que le lot n'est pas fini", () => {
    render(<Counter ready={2} total={3} durationMs={1234} />);

    expect(status()).toBe('[ 2 / 3 prêtes ]');
    expect(visible()).toBe('[ 2 / 3 prêtes ]');
  });

  it("signale l'échec partiel par un glyphe et un texte, et l'annonce avec insistance", () => {
    render(<Counter ready={2} total={3} failed={1} retryAction={RETRY} />);

    expect(status()).toBe(`[ 2 / 3 prêtes ] · 1${NO_BREAK_SPACE}échec`);
    expect(statusElement().getAttribute('aria-live')).toBe('assertive');
    expect(visible()).toBe(`[ 2 / 3 prêtes ] · × 1${NO_BREAK_SPACE}échec`);
    expect(container.querySelector('.text-alerte')?.textContent).toContain('échec');
  });

  it('laisse la reprise accessible : ni dans la région annoncée, ni masquée', () => {
    render(<Counter ready={2} total={3} failed={1} retryAction={RETRY} />);
    const button = container.querySelector('button');

    expect(button?.textContent).toBe('Réessayer');
    expect(statusElement().contains(button)).toBe(false);
    expect(button?.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('accorde les échecs au pluriel', () => {
    render(<Counter ready={1} total={3} failed={2} retryAction={RETRY} />);

    expect(status()).toContain(`2${NO_BREAK_SPACE}échecs`);
  });

  it("n'affiche ni échec ni reprise à 0 échec", () => {
    render(<Counter ready={3} total={3} failed={0} retryAction={RETRY} />);

    expect(status()).not.toContain('échec');
    expect(visible()).not.toContain('échec');
    expect(container.querySelector('button')).toBeNull();
  });

  it('garde une largeur fixe : chiffres complétés par des espaces de chiffre', () => {
    render(<Counter ready={9} total={12} />);

    expect(visible()).toBe(`[ ${FIGURE_SPACE}9 / 12 prêtes ]`);
    expect(container.querySelector('.text-data')).not.toBeNull();
  });

  it('garde des pas de 180 ms pour un écart de 1 ou 2', () => {
    render(<Counter ready={0} total={3} />);

    rerender(<Counter ready={2} total={3} />);
    advance(motion.duration.snap - 1);
    expect(visible()).toBe('[ 0 / 3 prêtes ]');
    advance(1);
    expect(visible()).toBe('[ 1 / 3 prêtes ]');
    advance(motion.duration.snap);
    expect(visible()).toBe('[ 2 / 3 prêtes ]');

    rerender(<Counter ready={3} total={3} />);
    advance(motion.duration.snap - 1);
    expect(visible()).toBe('[ 2 / 3 prêtes ]');
    advance(1);
    expect(visible()).toBe('[ 3 / 3 prêtes ]');
  });

  it('rattrape un grand écart (0 → 40) en `sequence` au plus, en passant par chaque valeur', () => {
    const gap = 40;
    render(<Counter ready={0} total={gap} />);

    rerender(<Counter ready={gap} total={gap} />);
    const seen: number[] = [0];
    for (let elapsed = 0; elapsed < motion.duration.sequence; elapsed += 1) {
      advance(1);
      const value = Number(visible().match(/\d+/)?.[0]);
      if (seen.at(-1) !== value) {
        seen.push(value);
      }
    }

    expect(seen).toEqual(Array.from({ length: gap + 1 }, (_, index) => index));
  });

  it('n’annonce qu’une fois un grand écart : la région contient directement la valeur finale', () => {
    render(<Counter ready={0} total={40} />);

    rerender(<Counter ready={40} total={40} />);
    const announcements = new Set([status()]);
    for (let step = 0; step < 40; step += 1) {
      advance(motion.duration.sequence / 40);
      announcements.add(status());
    }

    expect([...announcements]).toEqual(['[ 40 / 40 prêtes ]']);
    expect(visible()).toBe('[ 40 / 40 prêtes ]');
  });

  it('recalcule le rattrapage depuis la valeur affichée si la cible change en cours de route', () => {
    render(<Counter ready={0} total={60} />);

    rerender(<Counter ready={40} total={60} />);
    elapse(motion.duration.sequence / 2);
    expect(visible()).toBe('[ 20 / 60 prêtes ]');

    // Nouvel écart de 40 depuis 20 : de nouveau au plus `sequence`.
    rerender(<Counter ready={60} total={60} />);
    elapse(motion.duration.sequence);
    expect(visible()).toBe('[ 60 / 60 prêtes ]');
  });

  it('annonce la durée et les échecs dès que les vraies valeurs les justifient', () => {
    render(<Counter ready={0} total={3} />);

    rerender(<Counter ready={3} total={3} durationMs={900} />);
    expect(status()).toBe(`[ 3 / 3 prêtes ] · 0,9${NO_BREAK_SPACE}s`);
    expect(visible()).toBe('[ 0 / 3 prêtes ]');

    elapse(motion.duration.sequence);
    expect(visible()).toBe(`[ 3 / 3 prêtes ] · 0,9${NO_BREAK_SPACE}s`);

    rerender(<Counter ready={0} total={3} />);
    rerender(<Counter ready={2} total={3} failed={1} retryAction={RETRY} />);
    expect(status()).toBe(`[ 2 / 3 prêtes ] · 1${NO_BREAK_SPACE}échec`);
  });

  it('recule sans délai (nouveau lot)', () => {
    render(<Counter ready={3} total={3} />);

    rerender(<Counter ready={0} total={3} />);

    expect(visible()).toBe('[ 0 / 3 prêtes ]');
    expect(status()).toBe('[ 0 / 3 prêtes ]');
  });

  it('saute directement à la valeur avec la réduction de mouvement', () => {
    mockReducedMotion(true);
    render(<Counter ready={0} total={40} />);

    rerender(<Counter ready={40} total={40} durationMs={900} />);

    expect(visible()).toBe(`[ 40 / 40 prêtes ] · 0,9${NO_BREAK_SPACE}s`);
    expect(status()).toBe(`[ 40 / 40 prêtes ] · 0,9${NO_BREAK_SPACE}s`);
  });

  it('nettoie son minuteur au démontage', () => {
    render(<Counter ready={0} total={40} />);
    rerender(<Counter ready={40} total={40} />);
    expect(vi.getTimerCount()).toBe(1);

    act(() => root?.unmount());
    root = undefined;

    expect(vi.getTimerCount()).toBe(0);
  });

  it('ramène des valeurs incohérentes dans les bornes', () => {
    render(<Counter ready={5} total={3} />);

    expect(status()).toBe('[ 3 / 3 prêtes ]');
    expect(visible()).toBe('[ 3 / 3 prêtes ]');
  });

  it('ne dessine ni spinner, ni animation, ni style inline', () => {
    render(<Counter ready={1} total={3} failed={1} retryAction={RETRY} />);

    expect(container.innerHTML).not.toContain('animate');
    expect(container.innerHTML).not.toContain('style=');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('exige une reprise dès qu’un échec est possible, au niveau du typage', () => {
    const failed: number = 1;
    // @ts-expect-error retryAction est obligatoire avec failed.
    const element = <Counter ready={2} total={3} failed={failed} />;

    expect(element).toBeDefined();
  });
});
