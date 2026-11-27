import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CardThumbnail } from './CardThumbnail';
import { cardThumbnailAlt } from './cardThumbnailAlt';

const CARD = {
  nameFr: 'Dracaufeu',
  nameEn: 'Charizard',
  number: '4',
  imageUrlFr: 'https://assets.tcgdex.net/fr/base/base1/4',
  imageUrlEn: 'https://assets.tcgdex.net/en/base/base1/4',
};
const SET = { nameFr: 'Set de Base', nameEn: 'Base Set' };
const ALT = 'Dracaufeu — Set de Base 4';

describe('CardThumbnail', () => {
  it('décrit la carte par son nom, son set et son numéro, en français de préférence', () => {
    expect(cardThumbnailAlt(CARD, SET)).toBe(ALT);
    expect(cardThumbnailAlt({ ...CARD, nameFr: null }, { ...SET, nameFr: null })).toBe(
      'Charizard — Base Set 4',
    );
  });

  it('charge l’image française en différé, en deux tailles, invisible tant qu’elle charge', () => {
    render(<CardThumbnail card={CARD} set={SET} sizes="48px" />);

    const image = screen.getByRole('img', { name: ALT });
    expect(image.getAttribute('src')).toBe(`${CARD.imageUrlFr}/high.webp`);
    expect(image.getAttribute('srcset')).toBe(
      `${CARD.imageUrlFr}/low.webp 245w, ${CARD.imageUrlFr}/high.webp 600w`,
    );
    expect(image.getAttribute('sizes')).toBe('48px');
    expect(image.getAttribute('loading')).toBe('lazy');
    expect(image.getAttribute('decoding')).toBe('async');
    expect(image.classList.contains('invisible')).toBe(true);
  });

  it('prend l’image anglaise quand la française manque', () => {
    render(<CardThumbnail card={{ ...CARD, imageUrlFr: null }} set={SET} />);

    expect(screen.getByRole('img', { name: ALT }).getAttribute('src')).toBe(
      `${CARD.imageUrlEn}/high.webp`,
    );
  });

  it('affiche l’image nette une fois chargée, sans fondu', () => {
    render(<CardThumbnail card={CARD} set={SET} />);
    const image = screen.getByRole('img', { name: ALT });

    fireEvent.load(image);

    expect(image.classList.contains('invisible')).toBe(false);
    expect(image.className).not.toMatch(/transition|duration|animate/);
  });

  it('garde le format physique de la carte, bordé d’un liséré, sur la largeur du parent', () => {
    render(<CardThumbnail card={CARD} set={SET} />);

    const frame = screen.getByRole('img', { name: ALT }).parentElement;
    expect(frame?.className).toContain('aspect-card');
    expect(frame?.className).toContain('w-full');
    expect(frame?.className).toContain('border-lisere');
    expect(frame?.className).toContain('bg-ecrin-elevated');
  });

  it('propose de réessayer quand l’image ne charge pas, puis relance le chargement', () => {
    render(<CardThumbnail card={CARD} set={SET} />);
    fireEvent.error(screen.getByRole('img', { name: ALT }));

    const retry = screen.getByRole('button', {
      name: `Réessayer le chargement de l’image : ${ALT}`,
    });
    expect(retry.textContent).toBe('Réessayer');

    fireEvent.click(retry);

    const image = screen.getByRole('img', { name: ALT });
    expect(image.classList.contains('invisible')).toBe(true);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('n’affiche que le glyphe en version compacte', () => {
    render(<CardThumbnail card={CARD} set={SET} compact />);
    fireEvent.error(screen.getByRole('img', { name: ALT }));

    expect(screen.getByRole('button').textContent).toBe('');
  });

  it('signale une carte sans image, sans proposer de réessayer', () => {
    render(<CardThumbnail card={{ ...CARD, imageUrlFr: null, imageUrlEn: null }} set={SET} />);

    expect(screen.getByRole('img', { name: `${ALT}, image indisponible` })).toBeTruthy();
    expect(screen.getByText('Image indisponible')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
