import { randomUUID } from 'node:crypto';
import { Collection } from './Collection';
import { DomainValidationError } from '../errors/DomainValidationError';

const USER_ID = randomUUID();
const LICENCE_ID = randomUUID();

function buildProps() {
  return { userId: USER_ID, licenceTCGId: LICENCE_ID, name: 'Ma collection Pokémon' };
}

describe('Collection', () => {
  describe('create', () => {
    it('generates an id and sets createdAt/updatedAt to the same instant', () => {
      const collection = Collection.create(buildProps());

      expect(collection.id).toHaveLength(36);
      expect(collection.createdAt).toEqual(collection.updatedAt);
      expect(collection.userId).toBe(USER_ID);
      expect(collection.licenceTCGId).toBe(LICENCE_ID);
    });

    it('trims the name', () => {
      expect(Collection.create({ ...buildProps(), name: '  Cartes à vendre  ' }).name).toBe(
        'Cartes à vendre',
      );
    });

    it.each(['', '   ', 'x'.repeat(61)])('rejects the name "%s" for an invalid length', (name) => {
      expect(() => Collection.create({ ...buildProps(), name })).toThrow(DomainValidationError);
      expect(() => Collection.create({ ...buildProps(), name })).toThrow(/Collection name must be/);
    });

    it('accepts a name of exactly the maximum length', () => {
      expect(Collection.create({ ...buildProps(), name: 'x'.repeat(60) }).name).toHaveLength(60);
    });

    it('counts characters as a person does: 60 emoji fit, 61 do not', () => {
      expect(() => Collection.create({ ...buildProps(), name: '😀'.repeat(60) })).not.toThrow();
      expect(() => Collection.create({ ...buildProps(), name: '😀'.repeat(61) })).toThrow(
        /Collection name must be/,
      );
    });

    it.each([
      ['null byte', 'ma\u0000collection'],
      ['zero-width space', 'ma\u200Bcollection'],
      ['right-to-left override', 'ma\u202Ecollection'],
      ['line feed', 'ma\ncollection'],
      ['line separator', 'ma\u2028collection'],
      ['Hangul filler', 'ma\u3164collection'],
      ['blank braille pattern', 'ma\u2800collection'],
    ])('rejects a name containing a %s', (_label, name) => {
      expect(() => Collection.create({ ...buildProps(), name })).toThrow(/control or invisible/);
    });

    it('rejects a name made only of an invisible filler', () => {
      expect(() => Collection.create({ ...buildProps(), name: '\u3164' })).toThrow(
        DomainValidationError,
      );
    });

    it('accepts emoji in a name, including composed ones', () => {
      expect(Collection.create({ ...buildProps(), name: 'Dracaufeu ⚡\uFE0F' }).name).toBe(
        'Dracaufeu ⚡\uFE0F',
      );
      expect(Collection.create({ ...buildProps(), name: '❤\uFE0F 1\uFE0F⃣' }).name).toBe(
        '❤\uFE0F 1\uFE0F⃣',
      );
    });

    it('allows a regular space and accented letters inside a name', () => {
      expect(Collection.create({ ...buildProps(), name: 'Écarlate et Violet' }).name).toBe(
        'Écarlate et Violet',
      );
    });

    it('rejects a licence id that is not a UUID, as a validation error', () => {
      const create = () => Collection.create({ ...buildProps(), licenceTCGId: 'licence-1' });

      expect(create).toThrow(DomainValidationError);
      expect(create).toThrow('Licence id must be a valid UUID');
    });

    it('refuses a blank owner as a bug, not as a validation error', () => {
      const create = () => Collection.create({ ...buildProps(), userId: ' ' });

      expect(create).toThrow(/without an owner/);
      expect(create).not.toThrow(DomainValidationError);
    });
  });

  describe('restore', () => {
    it('rebuilds a collection without re-validating the stored name', () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const updatedAt = new Date('2026-02-01T00:00:00.000Z');

      const collection = Collection.restore({
        id: 'fixed-id',
        userId: USER_ID,
        licenceTCGId: LICENCE_ID,
        name: 'x'.repeat(200),
        createdAt,
        updatedAt,
      });

      expect(collection.id).toBe('fixed-id');
      expect(collection.name).toHaveLength(200);
      expect(collection.createdAt).toBe(createdAt);
      expect(collection.updatedAt).toBe(updatedAt);
    });
  });

  describe('isOwnedBy', () => {
    it('is true for the owner only', () => {
      const collection = Collection.create(buildProps());

      expect(collection.isOwnedBy(USER_ID)).toBe(true);
      expect(collection.isOwnedBy(randomUUID())).toBe(false);
    });
  });

  describe('rename', () => {
    it('returns a renamed copy, keeping identity, owner, licence and creation date', () => {
      const original = Collection.restore({
        ...buildProps(),
        id: 'fixed-id',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const renamed = original.rename('  Doubles  ');

      expect(renamed.name).toBe('Doubles');
      expect(renamed.id).toBe(original.id);
      expect(renamed.userId).toBe(original.userId);
      expect(renamed.licenceTCGId).toBe(original.licenceTCGId);
      expect(renamed.createdAt).toBe(original.createdAt);
      expect(renamed.updatedAt.getTime()).toBeGreaterThan(original.updatedAt.getTime());
      expect(original.name).toBe('Ma collection Pokémon');
    });

    it('rejects an invalid name', () => {
      expect(() => Collection.create(buildProps()).rename('   ')).toThrow(DomainValidationError);
    });
  });
});
