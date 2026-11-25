import { describe, expect, it } from 'vitest';

import {
  validateEmail,
  validateLoginPassword,
  validateNewPassword,
  validateUsername,
} from './authValidation';

describe('validateEmail', () => {
  it.each(['', '   '])('demande une adresse quand le champ est vide (%o)', (email) => {
    expect(validateEmail(email)).toBe('Saisissez votre adresse e-mail.');
  });

  it.each(['ash', 'ash@', '@exemple.fr', 'ash@exemple', 'ash ketchum@exemple.fr'])(
    'refuse une adresse mal formée (%s)',
    (email) => {
      expect(validateEmail(email)).toBe(
        'Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.',
      );
    },
  );

  it.each(['ash@exemple.fr', '  ash@exemple.fr  ', 'sacha.ketchum+tcg@bourg-palette.co.uk'])(
    'accepte une adresse bien formée (%s)',
    (email) => {
      expect(validateEmail(email)).toBeUndefined();
    },
  );
});

describe('validateLoginPassword', () => {
  it('demande le mot de passe quand le champ est vide', () => {
    expect(validateLoginPassword('')).toBe('Saisissez votre mot de passe.');
  });

  it('accepte tout mot de passe saisi, sans appliquer la politique de création', () => {
    expect(validateLoginPassword('court')).toBeUndefined();
  });
});

describe('validateNewPassword', () => {
  it.each(['', 'abc1', 'motdepasse', '12345678'])(
    'exige 8 caractères dont une lettre et un chiffre (%o)',
    (password) => {
      expect(validateNewPassword(password)).toBe(
        'Utilisez au moins 8 caractères, dont une lettre et un chiffre.',
      );
    },
  );

  it.each(['pikachu25', 'Évoli2026', 'motdepasse1'])('accepte %s', (password) => {
    expect(validateNewPassword(password)).toBeUndefined();
  });

  it('signale un mot de passe trop long ou un caractère interdit', () => {
    expect(validateNewPassword(`a1${'é'.repeat(40)}`)).toBe(
      'Ce mot de passe est trop long ou contient un caractère non autorisé.',
    );
    expect(validateNewPassword('pikachu25\u0000')).toBe(
      'Ce mot de passe est trop long ou contient un caractère non autorisé.',
    );
  });
});

describe('validateUsername', () => {
  it.each(['', '   '])('demande un pseudo quand le champ est vide (%o)', (username) => {
    expect(validateUsername(username)).toBe('Saisissez un pseudo.');
  });

  it.each(['as', '  as  ', 'a'.repeat(33)])('exige 3 à 32 caractères (%o)', (username) => {
    expect(validateUsername(username)).toBe('Votre pseudo doit contenir entre 3 et 32 caractères.');
  });

  it('refuse un caractère invisible', () => {
    expect(validateUsername('ash\u200bketchum')).toBe(
      'Votre pseudo contient un caractère non autorisé.',
    );
  });

  it.each(['ash', 'ash ketchum', '  ash  ', 'a'.repeat(32)])('accepte %o', (username) => {
    expect(validateUsername(username)).toBeUndefined();
  });
});
