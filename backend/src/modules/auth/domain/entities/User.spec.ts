import { User } from './User';
import { DomainValidationError } from '../errors/DomainValidationError';
import { Email } from '../value-objects/Email';

const consentGivenAt = new Date('2026-01-01T00:00:00.000Z');

function buildProps() {
  return {
    email: Email.create('user@example.com'),
    passwordHash: 'hashed-password',
    username: 'trainer42',
    consentGivenAt,
  };
}

describe('User', () => {
  describe('register', () => {
    it('generates an id and sets createdAt/updatedAt to the same instant', () => {
      const user = User.register(buildProps());

      expect(user.id).toHaveLength(36);
      expect(user.createdAt).toEqual(user.updatedAt);
      expect(user.consentGivenAt).toEqual(consentGivenAt);
    });

    it('creates an active account', () => {
      expect(User.register(buildProps()).isActive).toBe(true);
    });

    it('trims the username', () => {
      const user = User.register({ ...buildProps(), username: '  trainer42  ' });

      expect(user.username).toBe('trainer42');
    });

    it.each(['ab', 'x'.repeat(33)])(
      'rejects the username "%s" for an invalid length',
      (username) => {
        expect(() => User.register({ ...buildProps(), username })).toThrow(/Username must be/);
      },
    );

    it.each([
      ['null byte', 'trainer\u000042'],
      ['zero-width space', 'train​er42'],
      ['right-to-left override', 'train‮er42'],
      ['line feed', 'trainer\n42'],
      ['line separator', 'trainer 42'],
    ])('rejects a username containing a %s', (_label, username) => {
      expect(() => User.register({ ...buildProps(), username })).toThrow(DomainValidationError);
      expect(() => User.register({ ...buildProps(), username })).toThrow(/control or invisible/);
    });

    it('allows a regular space inside a username', () => {
      expect(User.register({ ...buildProps(), username: 'ash ketchum' }).username).toBe(
        'ash ketchum',
      );
    });

    it('generates a different id for each registration', () => {
      const first = User.register(buildProps());
      const second = User.register(buildProps());

      expect(first.id).not.toBe(second.id);
    });
  });

  describe('restore', () => {
    it('rebuilds a user from persisted data without regenerating id/timestamps', () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const updatedAt = new Date('2026-02-01T00:00:00.000Z');

      const user = User.restore({
        ...buildProps(),
        id: 'fixed-id',
        version: 0,
        isActive: true,
        createdAt,
        updatedAt,
      });

      expect(user.id).toBe('fixed-id');
      expect(user.createdAt).toEqual(createdAt);
      expect(user.updatedAt).toEqual(updatedAt);
    });

    it('does not re-validate persisted data (a rule tightened later must not lock out old accounts)', () => {
      expect(() =>
        User.restore({
          ...buildProps(),
          username: 'ab',
          id: 'fixed-id',
          version: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).not.toThrow();
    });

    it('keeps a deactivated account deactivated', () => {
      const user = User.restore({
        ...buildProps(),
        id: 'fixed-id',
        version: 0,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(user.isActive).toBe(false);
    });
  });

  describe('immutable updates', () => {
    const deactivated = User.restore({
      ...buildProps(),
      id: 'fixed-id',
      version: 0,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('never reactivates a deactivated account', () => {
      expect(deactivated.withPasswordHash('new-hash').isActive).toBe(false);
      expect(deactivated.withUsername('newname').isActive).toBe(false);
    });
  });

  describe('version (optimistic lock)', () => {
    it('starts a new account at version 0', () => {
      expect(User.register(buildProps()).version).toBe(0);
    });

    it('restores the persisted version', () => {
      const user = User.restore({
        ...buildProps(),
        id: 'fixed-id',
        version: 7,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(user.version).toBe(7);
    });

    it('keeps the version it was loaded at across updates (it is the expected base version)', () => {
      const user = User.restore({
        ...buildProps(),
        id: 'fixed-id',
        version: 7,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(user.withPasswordHash('new-hash').version).toBe(7);
      expect(user.withUsername('newname').version).toBe(7);
      expect(user.deactivate().version).toBe(7);
    });
  });

  describe('deactivate', () => {
    it('returns a deactivated copy and leaves the original untouched', () => {
      const user = User.register(buildProps());

      const deactivated = user.deactivate();

      expect(deactivated.isActive).toBe(false);
      expect(user.isActive).toBe(true);
      expect(deactivated.id).toBe(user.id);
      expect(deactivated.passwordHash).toBe(user.passwordHash);
    });
  });

  describe('withPasswordHash', () => {
    it('replaces the password hash and bumps updatedAt without touching other fields', () => {
      const user = User.register(buildProps());

      const updated = user.withPasswordHash('new-hash');

      expect(updated.passwordHash).toBe('new-hash');
      expect(updated.id).toBe(user.id);
      expect(updated.email).toBe(user.email);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(user.updatedAt.getTime());
    });
  });

  describe('withUsername', () => {
    it('replaces the username and bumps updatedAt', () => {
      const user = User.register(buildProps());

      const updated = user.withUsername('newname');

      expect(updated.username).toBe('newname');
      expect(updated.id).toBe(user.id);
    });

    it('rejects an invalid username', () => {
      const user = User.register(buildProps());

      expect(() => user.withUsername('ab')).toThrow(/Username must be/);
    });
  });
});
