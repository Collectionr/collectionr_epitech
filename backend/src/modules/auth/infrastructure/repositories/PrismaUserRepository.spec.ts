import { Prisma } from '../../../../generated/prisma/client.js';
import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { EmailAlreadyUsedError } from '../../application/errors/AuthErrors';
import { PrismaUserRepository } from './PrismaUserRepository';

function buildUser(): User {
  return User.register({
    email: Email.create('trainer@example.com'),
    passwordHash: '$2b$12$hashhashhashhashhashhashhashhashhashhashhashhashhashh',
    username: 'ash_ketchum',
    consentGivenAt: new Date('2026-09-01T00:00:00.000Z'),
  });
}

function buildPrismaRecord(user: User): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email.value,
    passwordHash: user.passwordHash,
    username: user.username,
    role: 'USER',
    consentGivenAt: user.consentGivenAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

describe('PrismaUserRepository', () => {
  describe('save', () => {
    it('upserts the user and returns the restored domain entity', async () => {
      const user = buildUser();
      const upsert = jest.fn().mockResolvedValue(buildPrismaRecord(user));
      const prismaClient = { user: { upsert } } as unknown as PrismaClient;
      const repository = new PrismaUserRepository(prismaClient);

      const saved = await repository.save(user);

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: user.id } }) as unknown,
      );
      expect(saved.id).toBe(user.id);
      expect(saved.email.value).toBe(user.email.value);
    });

    it('translates a unique constraint violation into EmailAlreadyUsedError', async () => {
      const user = buildUser();
      const conflict = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.0',
      });
      const upsert = jest.fn().mockRejectedValue(conflict);
      const prismaClient = { user: { upsert } } as unknown as PrismaClient;
      const repository = new PrismaUserRepository(prismaClient);

      await expect(repository.save(user)).rejects.toThrow(EmailAlreadyUsedError);
    });

    it('rethrows any other error as-is', async () => {
      const user = buildUser();
      const upsert = jest.fn().mockRejectedValue(new Error('connection lost'));
      const prismaClient = { user: { upsert } } as unknown as PrismaClient;
      const repository = new PrismaUserRepository(prismaClient);

      await expect(repository.save(user)).rejects.toThrow('connection lost');
    });
  });

  describe('findById', () => {
    it('returns the restored domain entity when found', async () => {
      const user = buildUser();
      const findUnique = jest.fn().mockResolvedValue(buildPrismaRecord(user));
      const prismaClient = { user: { findUnique } } as unknown as PrismaClient;
      const repository = new PrismaUserRepository(prismaClient);

      const found = await repository.findById(user.id);

      expect(findUnique).toHaveBeenCalledWith({ where: { id: user.id } });
      expect(found?.id).toBe(user.id);
    });

    it('returns null when not found', async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const prismaClient = { user: { findUnique } } as unknown as PrismaClient;
      const repository = new PrismaUserRepository(prismaClient);

      await expect(repository.findById('unknown-id')).resolves.toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('returns the restored domain entity when found', async () => {
      const user = buildUser();
      const findUnique = jest.fn().mockResolvedValue(buildPrismaRecord(user));
      const prismaClient = { user: { findUnique } } as unknown as PrismaClient;
      const repository = new PrismaUserRepository(prismaClient);

      const found = await repository.findByEmail(user.email);

      expect(findUnique).toHaveBeenCalledWith({ where: { email: user.email.value } });
      expect(found?.email.value).toBe(user.email.value);
    });

    it('returns null when not found', async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const prismaClient = { user: { findUnique } } as unknown as PrismaClient;
      const repository = new PrismaUserRepository(prismaClient);

      await expect(repository.findByEmail(Email.create('nobody@example.com'))).resolves.toBeNull();
    });
  });
});
