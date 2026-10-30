import { Collection } from './Collection';
import { DomainValidationError } from '../errors/DomainValidationError';

function buildProps() {
  return { userId: 'user-1', licenceTCGId: 'licence-1', name: 'Ma collection Pokémon' };
}

describe('Collection', () => {
  describe('create', () => {
    it('generates an id and sets createdAt/updatedAt to the same instant', () => {
      const collection = Collection.create(buildProps());

      expect(collection.id).toHaveLength(36);
      expect(collection.createdAt).toEqual(collection.updatedAt);
      expect(collection.userId).toBe('user-1');
      expect(collection.licenceTCGId).toBe('licence-1');
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

    it.each([
      ['null byte', 'ma\u0000collection'],
      ['zero-width space', 'ma​collection'],
      ['right-to-left override', 'ma‮collection'],
      ['line feed', 'ma\ncollection'],
      ['line separator', 'ma collection'],
    ])('rejects a name containing a %s', (_label, name) => {
      expect(() => Collection.create({ ...buildProps(), name })).toThrow(/control or invisible/);
    });

    it('allows a regular space and accented letters inside a name', () => {
      expect(Collection.create({ ...buildProps(), name: 'Écarlate et Violet' }).name).toBe(
        'Écarlate et Violet',
      );
    });

    it.each([
      ['owner', { userId: ' ' }],
      ['licence', { licenceTCGId: '' }],
    ])('refuses a blank %s as a bug, not as a validation error', (_label, override) => {
      const create = () => Collection.create({ ...buildProps(), ...override });

      expect(create).toThrow(/without an owner and a licence/);
      expect(create).not.toThrow(DomainValidationError);
    });
  });

  describe('restore', () => {
    it('rebuilds a collection without re-validating the stored name', () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const updatedAt = new Date('2026-02-01T00:00:00.000Z');

      const collection = Collection.restore({
        id: 'fixed-id',
        userId: 'user-1',
        licenceTCGId: 'licence-1',
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

      expect(collection.isOwnedBy('user-1')).toBe(true);
      expect(collection.isOwnedBy('user-2')).toBe(false);
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
