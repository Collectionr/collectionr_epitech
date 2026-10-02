import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import type { PrismaClient, User as PrismaUser } from '../../../../generated/prisma/client.js';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { EmailAlreadyUsedError } from '../../application/errors/AuthErrors';
import type { IUserRepository } from '../../application/ports/IUserRepository';
import { PRISMA_CLIENT } from '../../../../shared/infrastructure/database/PrismaModule';

/** Unique constraint violation (Prisma error code), e.g. the `users.email` unique index. */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prismaClient: PrismaClient) {}

  async save(user: User): Promise<User> {
    try {
      const saved = await this.prismaClient.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email.value,
          passwordHash: user.passwordHash,
          username: user.username,
          consentGivenAt: user.consentGivenAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        } satisfies Prisma.UserUncheckedCreateInput,
        update: {
          email: user.email.value,
          passwordHash: user.passwordHash,
          username: user.username,
          updatedAt: user.updatedAt,
        } satisfies Prisma.UserUncheckedUpdateInput,
      });

      return toDomain(saved);
    } catch (error) {
      // The applicative findByEmail() check in RegisterUserUseCase is only a UX
      // shortcut — this unique constraint is what actually guarantees no two
      // concurrent registrations create the same email twice (IUserRepository.save doc).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new EmailAlreadyUsedError(user.email.value);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    const found = await this.prismaClient.user.findUnique({ where: { id } });
    return found === null ? null : toDomain(found);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const found = await this.prismaClient.user.findUnique({ where: { email: email.value } });
    return found === null ? null : toDomain(found);
  }
}

function toDomain(record: PrismaUser): User {
  return User.restore({
    id: record.id,
    email: Email.create(record.email),
    passwordHash: record.passwordHash,
    username: record.username,
    consentGivenAt: record.consentGivenAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}
