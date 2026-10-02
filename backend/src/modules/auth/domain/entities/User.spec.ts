import { User } from './User';
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
        isActive: true,
        createdAt,
        updatedAt,
      });

      expect(user.id).toBe('fixed-id');
      expect(user.createdAt).toEqual(createdAt);
      expect(user.updatedAt).toEqual(updatedAt);
    });

    it('keeps a deactivated account deactivated', () => {
      const user = User.restore({
        ...buildProps(),
        id: 'fixed-id',
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
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('never reactivates a deactivated account', () => {
      expect(deactivated.withPasswordHash('new-hash').isActive).toBe(false);
      expect(deactivated.withUsername('newname').isActive).toBe(false);
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
