import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import type { PrismaClient, User as PrismaUser } from '../../../../generated/prisma/client.js';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import {
  ConcurrentModificationError,
  EmailAlreadyUsedError,
  UsernameAlreadyUsedError,
} from '../../application/errors/AuthErrors';
import type { IUserRepository } from '../../application/ports/IUserRepository';
import { PRISMA_CLIENT } from '../../../../shared/infrastructure/database/PrismaModule';
import { isUuid } from '../../../../shared/infrastructure/IsUuid';
import type { RoleName } from '../../../../shared/config/AppConstants';

/** Unique constraint violation (Prisma error code). */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/** The unique indexes of the users table, as PostgreSQL names them (see the migrations). */
const EMAIL_INDEX = 'users_email_key';
const USERNAME_KEY_INDEX = 'users_usernameKey_key';

/** Role of every account created by registration. Linked by name, never by UUID (ADR-013). */
const REGISTRATION_ROLE: RoleName = 'USER';

/** What the write path needs to know about the stored row, read under a row lock. */
interface StoredSecurityState {
  readonly version: number;
  readonly passwordHash: string;
  readonly isActive: boolean;
}

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prismaClient: PrismaClient) {}

  async save(user: User): Promise<User> {
    try {
      const saved = await this.prismaClient.$transaction((tx) => this.persist(tx, user));
      return toDomain(saved);
    } catch (error) {
      // The applicative findByEmail() check in RegisterUserUseCase is only a UX
      // shortcut — this unique constraint is what actually guarantees no two
      // concurrent registrations create the same email twice (IUserRepository.save doc).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        const index = uniqueIndexOf(error);
        if (index === USERNAME_KEY_INDEX) {
          throw new UsernameAlreadyUsedError();
        }
        if (index === EMAIL_INDEX) {
          throw new EmailAlreadyUsedError();
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    // The column is a uuid: anything else cannot exist, and would otherwise surface as a database error.
    if (!isUuid(id)) {
      return null;
    }
    const found = await this.prismaClient.user.findUnique({ where: { id } });
    return found === null ? null : toDomain(found);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const found = await this.prismaClient.user.findUnique({ where: { email: email.value } });
    return found === null ? null : toDomain(found);
  }

  async findByUsername(username: string): Promise<User | null> {
    const found = await this.prismaClient.user.findUnique({
      where: { usernameKey: User.usernameKey(username) },
    });
    return found === null ? null : toDomain(found);
  }

  /**
   * One transaction, one row lock. `SELECT ... FOR UPDATE` serialises every writer of this user
   * (this save, a token rotation, a bulk revocation — they all take the same lock), which is what
   * makes "the version I read is still the version I overwrite" and "revoke the sessions that exist
   * at commit time" true rather than hopeful.
   */
  private async persist(tx: Prisma.TransactionClient, user: User): Promise<PrismaUser> {
    const rows = await tx.$queryRaw<StoredSecurityState[]>`
      SELECT "version", "passwordHash", "isActive" FROM "users" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
    const stored = rows[0];

    if (stored === undefined) {
      // A copy loaded at version N > 0 whose row has vanished is not a creation: it is stale.
      if (user.version !== 0) {
        throw new ConcurrentModificationError();
      }
      return tx.user.create({
        data: {
          id: user.id,
          email: user.email.value,
          passwordHash: user.passwordHash,
          username: user.username,
          usernameKey: User.usernameKey(user.username),
          termsAcceptedAt: user.termsAcceptedAt,
          termsVersion: user.termsVersion,
          isActive: user.isActive,
          version: 0,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          role: { connect: { name: REGISTRATION_ROLE } },
        } satisfies Prisma.UserCreateInput,
      });
    }

    if (stored.version !== user.version) {
      throw new ConcurrentModificationError();
    }

    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        email: user.email.value,
        passwordHash: user.passwordHash,
        username: user.username,
        usernameKey: User.usernameKey(user.username),
        isActive: user.isActive,
        updatedAt: user.updatedAt,
        version: { increment: 1 },
      } satisfies Prisma.UserUncheckedUpdateInput,
    });

    const passwordChanged = stored.passwordHash !== user.passwordHash;
    const deactivated = stored.isActive && !user.isActive;
    if (passwordChanged || deactivated) {
      await tx.session.updateMany({
        where: { userId: user.id, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    return updated;
  }
}

/**
 * The unique index a violation was raised on, read from the driver's own report (the constraint name
 * PostgreSQL gives, e.g. `users_usernameKey_key`). Anything else — another table, another kind of
 * violation, an unexpected shape — yields nothing, so the error stays a 500 instead of being taken for
 * a duplicate.
 */
function uniqueIndexOf(error: Prisma.PrismaClientKnownRequestError): string | null {
  const driverError: unknown = error.meta?.driverAdapterError;
  if (!isRecord(driverError) || !isRecord(driverError.cause)) {
    return null;
  }
  const { cause } = driverError;
  if (cause.kind !== 'UniqueConstraintViolation' || cause.table !== 'users') {
    return null;
  }
  return isRecord(cause.constraint) && typeof cause.constraint.index === 'string'
    ? cause.constraint.index
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toDomain(record: PrismaUser): User {
  return User.restore({
    id: record.id,
    // restore, not create: stored data was valid under the rules of its time, and a rule tightened
    // since must not turn an existing account into a 500.
    email: Email.restore(record.email),
    passwordHash: record.passwordHash,
    username: record.username,
    termsAcceptedAt: record.termsAcceptedAt,
    termsVersion: record.termsVersion,
    isActive: record.isActive,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}
