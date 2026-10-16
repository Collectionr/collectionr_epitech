import { Prisma } from '../../../../generated/prisma/client.js';
import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import {
  ConcurrentModificationError,
  EmailAlreadyUsedError,
  UsernameAlreadyUsedError,
} from '../../application/errors/AuthErrors';
import { PrismaUserRepository } from './PrismaUserRepository';

function buildUser(): User {
  return User.register({
    email: Email.create('trainer@example.com'),
    passwordHash: '$2b$12$hashhashhashhashhashhashhashhashhashhashhashhashhashh',
    username: 'ash_ketchum',
    termsAcceptedAt: new Date('2026-09-01T00:00:00.000Z'),
    termsVersion: '1',
  });
}

function recordOf(user: User, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email.value,
    passwordHash: user.passwordHash,
    username: user.username,
    role: 'USER',
    isActive: user.isActive,
    version: user.version,
    termsAcceptedAt: user.termsAcceptedAt,
    termsVersion: user.termsVersion,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    ...overrides,
  };
}

interface Harness {
  repository: PrismaUserRepository;
  lock: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  revokeSessions: jest.Mock;
  findUnique: jest.Mock;
}

/** `lock` is the `SELECT ... FOR UPDATE` row (or none) the transaction reads before writing. */
function harness(
  storedState: Record<string, unknown> | null,
  saved?: Record<string, unknown>,
): Harness {
  const lock = jest.fn().mockResolvedValue(storedState === null ? [] : [storedState]);
  const create = jest.fn().mockResolvedValue(saved);
  const update = jest.fn().mockResolvedValue(saved);
  const revokeSessions = jest.fn().mockResolvedValue({ count: 1 });
  const findUnique = jest.fn();
  const tx = { $queryRaw: lock, user: { create, update }, session: { updateMany: revokeSessions } };
  const prismaClient = {
    $transaction: (callback: (client: unknown) => Promise<unknown>) => callback(tx),
    user: { findUnique },
  } as unknown as PrismaClient;

  return {
    repository: new PrismaUserRepository(prismaClient),
    lock,
    create,
    update,
    revokeSessions,
    findUnique,
  };
}

describe('PrismaUserRepository', () => {
  describe('save — new account', () => {
    it('inserts the account when no row exists yet and returns the restored entity', async () => {
      const user = buildUser();
      const h = harness(null, recordOf(user));

      const saved = await h.repository.save(user);

      expect(h.create).toHaveBeenCalledTimes(1);
      expect(h.update).not.toHaveBeenCalled();
      expect(saved.id).toBe(user.id);
      expect(saved.version).toBe(0);
    });

    it('refuses a copy that claims a past version of a row that no longer exists', async () => {
      const stale = buildUser().withUsername('another');
      const loaded = User.restore({
        id: stale.id,
        email: stale.email,
        passwordHash: stale.passwordHash,
        username: stale.username,
        termsAcceptedAt: stale.termsAcceptedAt,
        termsVersion: stale.termsVersion,
        isActive: true,
        version: 3,
        createdAt: stale.createdAt,
        updatedAt: stale.updatedAt,
      });
      const h = harness(null);

      await expect(h.repository.save(loaded)).rejects.toBeInstanceOf(ConcurrentModificationError);
      expect(h.create).not.toHaveBeenCalled();
    });

    // The shape the driver adapter reports for a real violation (checked against PostgreSQL).
    function uniqueViolation(index: string | undefined): Prisma.PrismaClientKnownRequestError {
      return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: {
          driverAdapterError: {
            cause: {
              kind: 'UniqueConstraintViolation',
              table: 'users',
              constraint: index === undefined ? undefined : { index },
            },
          },
        },
      });
    }

    it('translates a unique email violation into EmailAlreadyUsedError', async () => {
      const h = harness(null);
      h.create.mockRejectedValue(uniqueViolation('users_email_key'));

      await expect(h.repository.save(buildUser())).rejects.toBeInstanceOf(EmailAlreadyUsedError);
    });

    it('translates a unique username-key violation into UsernameAlreadyUsedError', async () => {
      const h = harness(null);
      h.create.mockRejectedValue(uniqueViolation('users_usernameKey_key'));

      await expect(h.repository.save(buildUser())).rejects.toBeInstanceOf(UsernameAlreadyUsedError);
    });

    it('leaves a unique violation on another index as an internal error, not a duplicate', async () => {
      const h = harness(null);
      h.create.mockRejectedValue(uniqueViolation('users_some_other_key'));

      await expect(h.repository.save(buildUser())).rejects.toBeInstanceOf(
        Prisma.PrismaClientKnownRequestError,
      );
    });

    it('rethrows any other error as-is', async () => {
      const h = harness(null);
      h.create.mockRejectedValue(new Error('connection lost'));

      await expect(h.repository.save(buildUser())).rejects.toThrow('connection lost');
    });
  });

  describe('save — existing account (optimistic lock)', () => {
    function stored(user: User, overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return { version: 0, passwordHash: user.passwordHash, isActive: true, ...overrides };
    }

    it('locks the row, updates it and bumps the version', async () => {
      const user = buildUser();
      const h = harness(stored(user), recordOf(user, { version: 1 }));

      const saved = await h.repository.save(user.withUsername('renamed'));

      expect(h.lock).toHaveBeenCalledTimes(1);
      expect(h.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: expect.objectContaining({
            version: { increment: 1 },
            username: 'renamed',
          }) as unknown,
        }),
      );
      expect(saved.version).toBe(1);
    });

    it('rejects a stale copy without writing anything', async () => {
      const user = buildUser();
      const h = harness(stored(user, { version: 4 }));

      await expect(h.repository.save(user.withUsername('renamed'))).rejects.toBeInstanceOf(
        ConcurrentModificationError,
      );
      expect(h.update).not.toHaveBeenCalled();
      expect(h.revokeSessions).not.toHaveBeenCalled();
    });

    it('revokes every session of the user in the same transaction when the password changes', async () => {
      const user = buildUser();
      const h = harness(stored(user), recordOf(user, { version: 1 }));

      await h.repository.save(user.withPasswordHash('$2b$12$another'));

      expect(h.revokeSessions).toHaveBeenCalledWith({
        where: { userId: user.id, isRevoked: false },
        data: { isRevoked: true },
      });
    });

    it('revokes every session of the user when the account is deactivated', async () => {
      const user = buildUser();
      const h = harness(stored(user), recordOf(user, { version: 1, isActive: false }));

      await h.repository.save(user.deactivate());

      expect(h.revokeSessions).toHaveBeenCalledTimes(1);
    });

    it('leaves sessions alone for a change that is not security relevant', async () => {
      const user = buildUser();
      const h = harness(stored(user), recordOf(user, { version: 1 }));

      await h.repository.save(user.withUsername('renamed'));

      expect(h.revokeSessions).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns the restored domain entity when found', async () => {
      const user = buildUser();
      const h = harness(null);
      h.findUnique.mockResolvedValue(recordOf(user));

      const found = await h.repository.findById(user.id);

      expect(h.findUnique).toHaveBeenCalledWith({ where: { id: user.id } });
      expect(found?.id).toBe(user.id);
    });

    it('returns null when not found', async () => {
      const h = harness(null);
      h.findUnique.mockResolvedValue(null);

      await expect(
        h.repository.findById('0b1f6c1e-6c1e-4b1e-8b1e-1b1e6c1e4b1e'),
      ).resolves.toBeNull();
    });

    it('returns null for an id that is not a UUID, without querying (the column is a uuid)', async () => {
      const h = harness(null);

      await expect(h.repository.findById('pas-un-uuid')).resolves.toBeNull();
      expect(h.findUnique).not.toHaveBeenCalled();
    });

    it("loads an account whose stored email no longer passes today's validation (Email.restore, not create)", async () => {
      const user = buildUser();
      const h = harness(null);
      h.findUnique.mockResolvedValue(recordOf(user, { email: 'Legacy..Address@Example.COM' }));

      const found = await h.repository.findById(user.id);

      expect(found?.email.value).toBe('Legacy..Address@Example.COM');
    });
  });

  describe('findByEmail', () => {
    it('returns the restored domain entity when found', async () => {
      const user = buildUser();
      const h = harness(null);
      h.findUnique.mockResolvedValue(recordOf(user));

      const found = await h.repository.findByEmail(user.email);

      expect(h.findUnique).toHaveBeenCalledWith({ where: { email: user.email.value } });
      expect(found?.email.value).toBe(user.email.value);
    });

    it('returns null when not found', async () => {
      const h = harness(null);
      h.findUnique.mockResolvedValue(null);

      await expect(
        h.repository.findByEmail(Email.create('nobody@example.com')),
      ).resolves.toBeNull();
    });
  });
});
