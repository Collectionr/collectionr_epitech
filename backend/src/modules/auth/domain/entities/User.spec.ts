import { User } from './User';
import { DomainValidationError } from '../errors/DomainValidationError';
import { Email } from '../value-objects/Email';

const termsAcceptedAt = new Date('2026-01-01T00:00:00.000Z');
const termsVersion = '2026-01';

function buildProps() {
  return {
    email: Email.create('user@example.com'),
    passwordHash: 'hashed-password',
    username: 'trainer42',
    termsAcceptedAt,
    termsVersion,
  };
}

describe('User', () => {
  describe('register', () => {
    it('generates an id and sets createdAt/updatedAt to the same instant', () => {
      const user = User.register(buildProps());

      expect(user.id).toHaveLength(36);
      expect(user.createdAt).toEqual(user.updatedAt);
      expect(user.termsAcceptedAt).toEqual(termsAcceptedAt);
      expect(user.termsVersion).toBe(termsVersion);
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

    it('refuses to register a user without the terms version they accepted', () => {
      expect(() => User.register({ ...buildProps(), termsVersion: '  ' })).toThrow(/terms version/);
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
        isActive: true,
        deletedAt: null,
        isAnonymized: false,
        version: 0,
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
          isActive: true,
          deletedAt: null,
          isAnonymized: false,
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).not.toThrow();
    });

    it('keeps a deactivated account deactivated', () => {
      const user = User.restore({
        ...buildProps(),
        id: 'fixed-id',
        isActive: false,
        deletedAt: null,
        isAnonymized: false,
        version: 0,
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
      deletedAt: null,
      isAnonymized: false,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('never reactivates a deactivated account', () => {
      expect(deactivated.withPasswordHash('new-hash').isActive).toBe(false);
      expect(deactivated.withUsername('newname').isActive).toBe(false);
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
      expect(deactivated.updatedAt.getTime()).toBeGreaterThanOrEqual(user.updatedAt.getTime());
    });
  });

  describe('requestDeletion', () => {
    const requestedAt = new Date('2026-11-01T10:00:00.000Z');

    it('deactivates the account and schedules its purge 30 days later, from the start of the day', () => {
      const user = User.register(buildProps());

      const requested = user.requestDeletion(requestedAt);

      expect(requested.isActive).toBe(false);
      expect(requested.deletedAt).toEqual(new Date('2026-12-01T00:00:00.000Z'));
      expect(requested.isAnonymized).toBe(false);
      expect(user.deletedAt).toBeNull();
      expect(user.isActive).toBe(true);
    });

    it('does not restart the grace period when asked again', () => {
      const requested = User.register(buildProps()).requestDeletion(requestedAt);

      const again = requested.requestDeletion(new Date('2026-11-20T10:00:00.000Z'));

      expect(again).toBe(requested);
      expect(again.deletedAt).toEqual(new Date('2026-12-01T00:00:00.000Z'));
    });

    it('is not what an admin deactivation does: that one leaves deletedAt empty', () => {
      expect(User.register(buildProps()).deactivate().deletedAt).toBeNull();
    });

    it('refuses an anonymized account', () => {
      const anonymized = User.register(buildProps())
        .requestDeletion(requestedAt)
        .anonymize(new Date('2026-12-01T10:00:00.000Z'));

      expect(() => anonymized.requestDeletion()).toThrow('anonymized');
    });
  });

  describe('isDeletionDueAt', () => {
    const requestedAt = new Date('2026-11-01T10:00:00.000Z');
    const requested = User.register(buildProps()).requestDeletion(requestedAt);

    it('is false without an erasure request', () => {
      expect(User.register(buildProps()).isDeletionDueAt(new Date('2030-01-01'))).toBe(false);
    });

    it('is false until the end of day 29 and true from the start of day 30, whatever the hour of the request', () => {
      expect(requested.isDeletionDueAt(new Date('2026-11-30T23:59:59.999Z'))).toBe(false);
      expect(requested.isDeletionDueAt(new Date('2026-12-01T00:00:00.000Z'))).toBe(true);
    });
  });

  describe('anonymize', () => {
    const requestedAt = new Date('2026-11-01T10:00:00.000Z');
    const due = new Date('2026-12-01T10:00:00.000Z');

    it('replaces the personal data with values derived from the id alone', () => {
      const user = User.register(buildProps()).requestDeletion(requestedAt);

      const anonymized = user.anonymize(due);

      const handle = user.id.replaceAll('-', '');
      expect(anonymized.email.value).toBe(`deleted-${handle}@anonymized.invalid`);
      expect(anonymized.username).toBe(`deleted-${handle}`);
      expect(anonymized.passwordHash).not.toBe('hashed-password');
      expect(anonymized.isAnonymized).toBe(true);
      expect(anonymized.isActive).toBe(false);
      expect(anonymized.deletedAt).toEqual(new Date('2026-12-01T00:00:00.000Z'));
      expect(anonymized.updatedAt).toEqual(due);
    });

    it('keeps what identifies nobody: the id, the terms acceptance and the creation date', () => {
      const user = User.register(buildProps()).requestDeletion(requestedAt);

      const anonymized = user.anonymize(due);

      expect(anonymized.id).toBe(user.id);
      expect(anonymized.termsAcceptedAt).toEqual(termsAcceptedAt);
      expect(anonymized.termsVersion).toBe(termsVersion);
      expect(anonymized.createdAt).toEqual(user.createdAt);
      expect(anonymized.version).toBe(user.version);
    });

    it('gives two accounts two different usernames and emails', () => {
      const a = User.register(buildProps()).requestDeletion(requestedAt).anonymize(due);
      const b = User.register(buildProps()).requestDeletion(requestedAt).anonymize(due);

      expect(a.username).not.toBe(b.username);
      expect(a.email.value).not.toBe(b.email.value);
    });

    it('refuses an account whose erasure was never requested', () => {
      expect(() => User.register(buildProps()).anonymize(due)).toThrow('not requested');
    });

    it('refuses an account still inside its grace period', () => {
      const user = User.register(buildProps()).requestDeletion(requestedAt);

      expect(() => user.anonymize(new Date('2026-11-30T23:59:59.999Z'))).toThrow('grace period');
    });

    it('returns an already anonymized account unchanged', () => {
      const anonymized = User.register(buildProps()).requestDeletion(requestedAt).anonymize(due);

      expect(anonymized.anonymize(new Date('2027-01-01'))).toBe(anonymized);
    });
  });

  describe('usernameKey', () => {
    it.each([
      ['Pokemon', 'pokemon'],
      ['POKEMON', 'pokemon'],
      ['  Pokemon  ', 'pokemon'],
      ['ash   ketchum', 'ash ketchum'],
      ['Ash	Ketchum', 'ash ketchum'],
      ['Ｐokemon', 'pokemon'],
    ])('maps "%s" to "%s"', (raw, key) => {
      expect(User.usernameKey(raw)).toBe(key);
    });

    it('gives the same key to every spelling of one username', () => {
      expect(User.usernameKey('Pokemon')).toBe(User.usernameKey('pokemon'));
    });

    it('keeps genuinely different usernames apart', () => {
      expect(User.usernameKey('pokemon1')).not.toBe(User.usernameKey('pokemon2'));
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
