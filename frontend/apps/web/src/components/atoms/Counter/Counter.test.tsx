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

function render(ui: ReactElement): HTMLElement {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(ui));
  const status = container.querySelector<HTMLElement>('[role="status"]');
  if (!status) {
    throw new Error('Counter non rendu');
  }
  return status;
}

function rerender(ui: ReactElement) {
  act(() => root?.render(ui));
}

function status(): string {
  return container.querySelector('[role="status"]')?.textContent ?? '';
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
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('Counter', () => {
  it('affiche la progression en cours, annoncée poliment', () => {
    const element = render(<Counter ready={2} total={3} />);

    expect(element.textContent).toBe('[ 2 / 3 prêtes ]');
    expect(element.getAttribute('aria-live')).toBe('polite');
    expect(element.getAttribute('aria-atomic')).toBe('true');
  });

  it('affiche la durée totale une fois tout prêt', () => {
    render(<Counter ready={3} total={3} durationMs={1234} />);

    expect(status()).toBe(`[ 3 / 3 prêtes ] · 1,2${NO_BREAK_SPACE}s`);
  });

  it("n'affiche pas la durée tant que le lot n'est pas fini", () => {
    render(<Counter ready={2} total={3} durationMs={1234} />);

    expect(status()).toBe('[ 2 / 3 prêtes ]');
  });

  it("signale l'échec partiel par un glyphe et un texte, avec la reprise hors de l'annonce", () => {
    const element = render(<Counter ready={2} total={3} failed={1} retryAction={RETRY} />);

    expect(element.textContent).toBe(`[ 2 / 3 prêtes ] · × 1${NO_BREAK_SPACE}échec`);
    expect(element.getAttribute('aria-live')).toBe('assertive');
    expect(element.querySelector('[aria-hidden="true"]')?.textContent).toBe('× ');
    expect(element.querySelector('.text-alerte')?.textContent).toContain('échec');
    expect(element.contains(container.querySelector('button'))).toBe(false);
    expect(container.querySelector('button')?.textContent).toBe('Réessayer');
  });

  it('accorde les échecs au pluriel', () => {
    render(<Counter ready={1} total={3} failed={2} retryAction={RETRY} />);

    expect(status()).toContain(`2${NO_BREAK_SPACE}échecs`);
  });

  it("n'affiche ni échec ni reprise à 0 échec", () => {
    render(<Counter ready={3} total={3} failed={0} retryAction={RETRY} />);

    expect(status()).not.toContain('échec');
    expect(container.querySelector('button')).toBeNull();
  });

  it('garde une largeur fixe : chiffres complétés par des espaces de chiffre', () => {
    render(<Counter ready={9} total={12} />);

    expect(status()).toBe(`[ ${FIGURE_SPACE}9 / 12 prêtes ]`);
    expect(container.querySelector('.text-data')).not.toBeNull();
  });

  it('avance d’une carte par pas au lieu de sauter', () => {
    render(<Counter ready={0} total={3} />);

    rerender(<Counter ready={3} total={3} />);
    expect(status()).toBe('[ 0 / 3 prêtes ]');

    act(() => vi.advanceTimersByTime(motion.duration.snap));
    expect(status()).toBe('[ 1 / 3 prêtes ]');

    act(() => vi.advanceTimersByTime(motion.duration.snap));
    expect(status()).toBe('[ 2 / 3 prêtes ]');

    act(() => vi.advanceTimersByTime(motion.duration.snap));
    expect(status()).toBe('[ 3 / 3 prêtes ]');
  });

  it('recule sans délai (nouveau lot)', () => {
    render(<Counter ready={3} total={3} />);

    rerender(<Counter ready={0} total={3} />);

    expect(status()).toBe('[ 0 / 3 prêtes ]');
  });

  it('saute directement à la valeur avec la réduction de mouvement', () => {
    mockReducedMotion(true);
    render(<Counter ready={0} total={3} />);

    rerender(<Counter ready={3} total={3} durationMs={900} />);

    expect(status()).toBe(`[ 3 / 3 prêtes ] · 0,9${NO_BREAK_SPACE}s`);
  });

  it('ramène des valeurs incohérentes dans les bornes', () => {
    render(<Counter ready={5} total={3} />);

    expect(status()).toBe('[ 3 / 3 prêtes ]');
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
