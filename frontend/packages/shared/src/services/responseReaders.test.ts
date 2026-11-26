import { describe, expect, it } from 'vitest';

import {
  readField,
  readNullableNumber,
  readNullableString,
  readNumber,
  readOneOf,
  readString,
  readStringArray,
  requireFields,
  unexpectedResponse,
} from './responseReaders';

describe('lecture des réponses', () => {
  it('lit un champ d’un objet, sans rien supposer d’une autre valeur', () => {
    expect(readField({ name: 'Base' }, 'name')).toBe('Base');
    expect(readField(null, 'name')).toBeUndefined();
    expect(readField('texte', 'length')).toBeUndefined();
  });

  it('lit un texte, éventuellement nul', () => {
    expect(readString({ name: 'Base' }, 'name')).toBe('Base');
    expect(readString({ name: 3 }, 'name')).toBeUndefined();
    expect(readNullableString({ name: null }, 'name')).toBeNull();
    expect(readNullableString({ name: 'Base' }, 'name')).toBe('Base');
    expect(readNullableString({}, 'name')).toBeUndefined();
  });

  it('lit un nombre fini, éventuellement nul', () => {
    expect(readNumber({ total: 3 }, 'total')).toBe(3);
    expect(readNumber({ total: Number.NaN }, 'total')).toBeUndefined();
    expect(readNumber({ total: '3' }, 'total')).toBeUndefined();
    expect(readNullableNumber({ note: null }, 'note')).toBeNull();
    expect(readNullableNumber({ note: 9.5 }, 'note')).toBe(9.5);
    expect(readNullableNumber({}, 'note')).toBeUndefined();
  });

  it('lit une liste de textes', () => {
    expect(readStringArray({ stamps: ['1st-edition'] }, 'stamps')).toEqual(['1st-edition']);
    expect(readStringArray({ stamps: [1] }, 'stamps')).toBeUndefined();
    expect(readStringArray({ stamps: '1st-edition' }, 'stamps')).toBeUndefined();
  });

  it('lit une valeur parmi celles autorisées', () => {
    expect(readOneOf({ condition: 'NM' }, 'condition', ['NM', 'LP'])).toBe('NM');
    expect(readOneOf({ condition: 'Mint' }, 'condition', ['NM', 'LP'])).toBeUndefined();
  });

  it('accepte des champs tous lus, nuls compris', () => {
    expect(requireFields({ name: 'Base', notes: null }, '/collections')).toEqual({
      name: 'Base',
      notes: null,
    });
  });

  it('refuse une réponse dont un champ manque, en citant l’endpoint', () => {
    expect(() => requireFields({ name: undefined }, '/collections')).toThrow(
      unexpectedResponse('/collections'),
    );
    expect(unexpectedResponse('/collections')).toBeInstanceOf(TypeError);
  });
});
