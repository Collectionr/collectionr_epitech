import { describe, expect, it } from 'vitest';

import {
  getPasswordStrength,
  meetsPasswordPolicy,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_STRENGTH_LABELS,
} from './passwordStrength';

describe('meetsPasswordPolicy', () => {
  it('reprend les valeurs du backend : 8 caractères minimum, 72 octets maximum', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_BYTES).toBe(72);
  });

  it.each([
    ['pikachu1', 'lettres et chiffre, 8 caractères'],
    ['パスワード123', 'écriture non latine (lettres \\p{L})'],
    ['motdepasse٣', 'chiffre arabo-indien (\\p{Nd})'],
    [`a1${'é'.repeat(35)}`, 'exactement 72 octets (é = 2 octets)'],
  ])('accepte %j : %s', (password) => {
    expect(meetsPasswordPolicy(password)).toBe(true);
  });

  it.each([
    ['pikach1', '7 caractères'],
    ['pikachuu', 'aucun chiffre'],
    ['12345678', 'aucune lettre'],
    ['motdepasse①', '① n’est pas un chiffre décimal'],
    ['pika\u0000chu1', 'caractère nul'],
    [`a1${'é'.repeat(36)}`, '74 octets (é = 2 octets)'],
    [`a1${'€'.repeat(24)}`, '74 octets (€ = 3 octets)'],
    [`a1${'😀'.repeat(18)}`, '74 octets (emoji = 4 octets)'],
  ])('refuse %j : %s', (password) => {
    expect(meetsPasswordPolicy(password)).toBe(false);
  });

  it('compte la longueur en unités UTF-16, comme le backend (un emoji compte 2)', () => {
    expect(meetsPasswordPolicy('a1😀😀😀')).toBe(true);
    expect(meetsPasswordPolicy('a1😀😀')).toBe(false);
  });

  it('accepte jusqu’à 72 octets avec des caractères de 3 et 4 octets', () => {
    expect(meetsPasswordPolicy(`a1${'€'.repeat(23)}`)).toBe(true);
    expect(meetsPasswordPolicy(`a1${'😀'.repeat(17)}`)).toBe(true);
  });
});

describe('getPasswordStrength', () => {
  it('ne renvoie aucun niveau tant que rien n’est saisi', () => {
    expect(getPasswordStrength('')).toBeNull();
  });

  it.each([
    ['p', 'un seul caractère'],
    ['   ', 'espaces seuls'],
    ['pikachuuuuuuuuuuuuuu', '20 lettres, aucun chiffre'],
    [`Aa1-${'é'.repeat(35)}`, '16 caractères ou plus mais au-delà de 72 octets'],
  ])('Faible pour %j : %s', (password) => {
    expect(getPasswordStrength(password)).toBe('faible');
  });

  it.each([
    ['pikachu1', '8 caractères, 2 familles'],
    ['Pikachu1234', '11 caractères, 3 familles : trop court pour Solide'],
    ['pikachu12345', '12 caractères, 2 familles seulement'],
    ['パスワード123', 'écriture sans casse, moins de 16 caractères'],
    ['aaaaaaaaaaaaaaa1', '16 caractères mais 2 caractères distincts seulement'],
    ['Aa1-Aa1-Aa1-Aa1-', '16 caractères, 4 familles, mais 4 caractères distincts'],
  ])('Correct pour %j : %s', (password) => {
    expect(getPasswordStrength(password)).toBe('correct');
  });

  it.each([
    ['Pikachu12345', '12 caractères : minuscules, majuscules, chiffres'],
    ['pikachu-1234', '12 caractères : minuscules, chiffres, autres'],
    ['PIKACHU-1234', '12 caractères : majuscules, chiffres, autres'],
    ['mon pikachu 2026', 'phrase de passe de 16 caractères'],
    ['パスワードパスワードパスワード1', 'écriture sans casse, 16 caractères'],
  ])('Solide pour %j : %s', (password) => {
    expect(getPasswordStrength(password)).toBe('solide');
  });

  it('compte les caractères distincts par point de code, pas en unités UTF-16', () => {
    // 😀 😁 😂 partagent la même première moitié UTF-16 (\uD83D) : 5 points de code, 6 unités.
    expect(getPasswordStrength('a1😀😁😂😀😁😂')).toBe('correct');
    // Un sixième point de code distinct (🤣) suffit pour Solide.
    expect(getPasswordStrength('a1😀😁😂🤣😀😁')).toBe('solide');
  });

  it('ne dépasse jamais Faible quand la politique n’est pas respectée', () => {
    const refused = ['Pikachu-Pikachu-Pikachu', '1234567890123456', 'Pika\u0000chu-12345678'];
    for (const password of refused) {
      expect(meetsPasswordPolicy(password)).toBe(false);
      expect(getPasswordStrength(password)).toBe('faible');
    }
  });
});

describe('PASSWORD_STRENGTH_LABELS', () => {
  it('fournit un libellé pour chaque niveau', () => {
    expect(PASSWORD_STRENGTH_LABELS).toEqual({
      faible: 'Faible',
      correct: 'Correct',
      solide: 'Solide',
    });
  });
});
