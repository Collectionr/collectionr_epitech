import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Stepper } from './Stepper';

const SIGNUP_STEPS = ['Identité', 'Sécurité'] as const;
const FOUR_STEPS = ['Un', 'Deux', 'Trois', 'Quatre'] as const;

function getSegment(item: HTMLElement): Element {
  const segment = item.firstElementChild;
  if (!segment) {
    throw new Error('Segment non rendu');
  }
  return segment;
}

function getTitle(item: HTMLElement): HTMLElement {
  const title = item.querySelector<HTMLElement>('.text-caption');
  if (!title) {
    throw new Error('Intitulé non rendu');
  }
  return title;
}

describe('Stepper', () => {
  it('affiche « Étape X sur N » dans un paragraphe, d’après l’étape en cours et le total', () => {
    const { rerender } = render(<Stepper steps={SIGNUP_STEPS} currentStep={1} />);
    expect(screen.getByText('Étape 1 sur 2').tagName).toBe('P');

    rerender(<Stepper steps={SIGNUP_STEPS} currentStep={2} />);
    expect(screen.getByText('Étape 2 sur 2')).toBeTruthy();
    expect(screen.queryByText('Étape 1 sur 2')).toBeNull();
  });

  it('affiche un intitulé par étape, dans l’ordre, dans une liste', () => {
    render(<Stepper steps={SIGNUP_STEPS} currentStep={1} />);

    expect(screen.getByRole('list').tagName).toBe('OL');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Identité',
      'Sécurité',
    ]);
  });

  it('pose aria-current="step" sur la seule étape en cours', () => {
    render(<Stepper steps={FOUR_STEPS} currentStep={3} />);

    expect(
      screen.getAllByRole('listitem').map((item) => item.getAttribute('aria-current')),
    ).toEqual([null, null, 'step', null]);
  });

  it('déduit l’état de chaque étape de sa position : complétée, en cours, à venir', () => {
    render(<Stepper steps={FOUR_STEPS} currentStep={2} />);
    const items = screen.getAllByRole('listitem');

    expect(items.map((item) => getSegment(item).classList.contains('bg-archive'))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(items.map((item) => getSegment(item).classList.contains('bg-lisere'))).toEqual([
      false,
      false,
      true,
      true,
    ]);
    expect(items.map((item) => getTitle(item).className)).toEqual([
      'text-caption text-acier-texte',
      'text-caption text-archive font-sans-bold',
      'text-caption text-acier-texte',
      'text-caption text-acier-texte',
    ]);
  });

  it('signale aux lecteurs d’écran les seules étapes complétées', () => {
    render(<Stepper steps={FOUR_STEPS} currentStep={3} />);
    const items = screen.getAllByRole('listitem');

    expect(items.map((item) => item.textContent)).toEqual([
      'Un (complétée)',
      'Deux (complétée)',
      'Trois',
      'Quatre',
    ]);
    expect(screen.getAllByText('(complétée)', { exact: false })).toHaveLength(2);
    for (const suffix of screen.getAllByText('(complétée)', { exact: false })) {
      expect(suffix.className).toBe('sr-only');
    }
  });

  it('masque les segments aux lecteurs d’écran', () => {
    render(<Stepper steps={SIGNUP_STEPS} currentStep={1} />);

    for (const item of screen.getAllByRole('listitem')) {
      expect(getSegment(item).getAttribute('aria-hidden')).toBe('true');
    }
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it.each([
    [0, 1],
    [-2, 1],
    [Number.NaN, 1],
    [1.7, 1],
    [5, 2],
  ])('ramène l’étape %s entre 1 et le total (étape %s)', (requested, expected) => {
    render(<Stepper steps={SIGNUP_STEPS} currentStep={requested} />);

    expect(screen.getByText(`Étape ${expected} sur 2`)).toBeTruthy();
    expect(
      screen.getAllByRole('listitem').map((item) => item.getAttribute('aria-current')),
    ).toEqual(expected === 1 ? ['step', null] : [null, 'step']);
  });

  it('reste générique : le nombre d’étapes vient des intitulés', () => {
    render(<Stepper steps={['A', 'B', 'C', 'D', 'E']} currentStep={5} />);

    expect(screen.getByText('Étape 5 sur 5')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getAllByText('(complétée)', { exact: false })).toHaveLength(4);
  });

  it('reste purement visuel : ni bouton ni lien', () => {
    render(<Stepper steps={FOUR_STEPS} currentStep={2} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('exige au moins une étape (contrôle de type, sans rendu)', () => {
    // @ts-expect-error -- une liste d'étapes vide n'a pas de sens : le type exige une étape au moins.
    const element = <Stepper steps={[]} currentStep={1} />;
    expect(element.type).toBe(Stepper);
  });
});
