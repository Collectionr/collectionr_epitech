/**
 * In-memory implementations of the auth ports, for the e2e specs (which run without any
 * infrastructure). They are NOT trusted on faith: AuthPorts.contract.memory.spec.ts runs the same
 * behavioural contract against them as against the Prisma implementations, so an e2e that passes
 * against these exercises the behaviour the real adapters are held to.
 *
 * JavaScript is single-threaded and none of the methods awaits between reading and writing the store,
 * so each is atomic — the property the real adapters get from a transaction and a row lock.
 */
import { createHash, randomUUID } from 'node:crypto';
import { User } from '../modules/auth/domain/entities/User';
import { Email } from '../modules/auth/domain/value-objects/Email';
import {
  ConcurrentModificationError,
  EmailAlreadyUsedError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
} from '../modules/auth/application/errors/AuthErrors';
import type {
  AuthenticatedPrincipal,
  IAccessTokenVerifier,
} from '../modules/auth/application/ports/IAccessTokenVerifier';
import type {
  AuthTokenPair,
  IAuthTokenService,
} from '../modules/auth/application/ports/IAuthTokenService';
import type { ISessionPurger } from '../modules/auth/application/ports/ISessionPurger';
import type { IUserRepository } from '../modules/auth/application/ports/IUserRepository';
import { isUuid } from '../shared/infrastructure/IsUuid';
import type { JwtTokenCodec } from '../modules/auth/infrastructure/services/JwtTokenCodec';

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  consentGivenAt: Date;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredSession {
  id: string;
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  isRevoked: boolean;
  rotatedAt: Date | null;
  expiresAt: Date;
  absoluteExpiresAt: Date;
}

export class InMemoryAuthStore {
  readonly users = new Map<string, StoredUser>();
  readonly sessions = new Map<string, StoredSession>();

  revokeSessionsOf(userId: string): void {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        session.isRevoked = true;
      }
    }
  }

  liveSessionsOf(userId: string): number {
    return [...this.sessions.values()].filter((s) => s.userId === userId && !s.isRevoked).length;
  }
}

function toDomain(row: StoredUser): User {
  return User.restore({ ...row, email: Email.restore(row.email) });
}

export class InMemoryUserRepository implements IUserRepository {
  constructor(private readonly store: InMemoryAuthStore) {}

  save(user: User): Promise<User> {
    // Runs the whole critical section synchronously in one microtask, and turns a throw into a rejection.
    return Promise.resolve().then(() => this.persist(user));
  }

  findById(id: string): Promise<User | null> {
    const found = isUuid(id) ? this.store.users.get(id) : undefined;
    return Promise.resolve(found === undefined ? null : toDomain(found));
  }

  findByEmail(email: Email): Promise<User | null> {
    const found = [...this.store.users.values()].find((row) => row.email === email.value);
    return Promise.resolve(found === undefined ? null : toDomain(found));
  }

  private persist(user: User): User {
    const stored = this.store.users.get(user.id);
    const emailTaken = [...this.store.users.values()].some(
      (row) => row.email === user.email.value && row.id !== user.id,
    );
    if (emailTaken) {
      throw new EmailAlreadyUsedError(user.email.value);
    }

    if (stored === undefined) {
      if (user.version !== 0) {
        throw new ConcurrentModificationError();
      }
      return toDomain(this.write(user, 0));
    }
    if (stored.version !== user.version) {
      throw new ConcurrentModificationError();
    }

    const passwordChanged = stored.passwordHash !== user.passwordHash;
    const deactivated = stored.isActive && !user.isActive;
    const saved = this.write(user, stored.version + 1);
    if (passwordChanged || deactivated) {
      this.store.revokeSessionsOf(user.id);
    }
    return toDomain(saved);
  }

  private write(user: User, version: number): StoredUser {
    const row: StoredUser = {
      id: user.id,
      email: user.email.value,
      passwordHash: user.passwordHash,
      username: user.username,
      consentGivenAt: user.consentGivenAt,
      isActive: user.isActive,
      version,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    this.store.users.set(user.id, row);
    return row;
  }
}

const sha256 = (token: string): string => createHash('sha256').update(token).digest('hex');

export class InMemoryAuthTokenService
  implements IAuthTokenService, IAccessTokenVerifier, ISessionPurger
{
  constructor(
    private readonly store: InMemoryAuthStore,
    private readonly codec: JwtTokenCodec,
    private readonly accessTtlSeconds = 900,
    private readonly refreshTtlSeconds = 604800,
    private readonly sessionMaxLifetimeSeconds = 2592000,
  ) {}

  issueTokenPair(userId: string): Promise<AuthTokenPair> {
    const user = isUuid(userId) ? this.store.users.get(userId) : undefined;
    if (user === undefined || !user.isActive) {
      return Promise.reject(new InvalidCredentialsError());
    }
    const now = new Date();
    return Promise.resolve(
      this.open(
        userId,
        randomUUID(),
        new Date(now.getTime() + this.sessionMaxLifetimeSeconds * 1000),
        now,
      ),
    );
  }

  rotateRefreshToken(refreshToken: string): Promise<AuthTokenPair> {
    let claims: ReturnType<JwtTokenCodec['verifyRefreshToken']>;
    try {
      claims = this.codec.verifyRefreshToken(refreshToken);
    } catch {
      return Promise.reject(new InvalidRefreshTokenError());
    }
    const user = this.store.users.get(claims.sub);
    const session = this.store.sessions.get(claims.jti);
    const now = new Date();

    if (
      user === undefined ||
      !user.isActive ||
      session === undefined ||
      session.userId !== claims.sub ||
      session.familyId !== claims.fam ||
      session.refreshTokenHash !== sha256(refreshToken)
    ) {
      return Promise.reject(new InvalidRefreshTokenError());
    }
    if (session.rotatedAt !== null) {
      for (const sibling of this.store.sessions.values()) {
        if (sibling.familyId === session.familyId) {
          sibling.isRevoked = true;
        }
      }
      return Promise.reject(new InvalidRefreshTokenError());
    }
    if (session.isRevoked || session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      return Promise.reject(new InvalidRefreshTokenError());
    }

    session.isRevoked = true;
    session.rotatedAt = now;
    return Promise.resolve(
      this.open(session.userId, session.familyId, session.absoluteExpiresAt, now),
    );
  }

  revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const claims = this.codec.verifyRefreshToken(refreshToken);
      const session = this.store.sessions.get(claims.jti);
      if (session !== undefined && session.userId === claims.sub) {
        session.isRevoked = true;
      }
    } catch {
      // Not a refresh token: nothing to revoke.
    }
    return Promise.resolve();
  }

  revokeAllRefreshTokens(userId: string): Promise<void> {
    if (isUuid(userId)) {
      this.store.revokeSessionsOf(userId);
    }
    return Promise.resolve();
  }

  purgeExpiredSessions(cutoff: Date): Promise<number> {
    let purged = 0;
    for (const [id, session] of this.store.sessions) {
      if (session.expiresAt < cutoff) {
        this.store.sessions.delete(id);
        purged += 1;
      }
    }
    return Promise.resolve(purged);
  }

  verify(accessToken: string): Promise<AuthenticatedPrincipal | null> {
    let claims;
    try {
      claims = this.codec.verifyAccessToken(accessToken);
    } catch {
      return Promise.resolve(null);
    }
    const now = new Date();
    const live = [...this.store.sessions.values()].some(
      (session) =>
        session.familyId === claims.fam &&
        session.userId === claims.sub &&
        !session.isRevoked &&
        session.expiresAt > now &&
        session.absoluteExpiresAt > now,
    );
    const user = this.store.users.get(claims.sub);
    return Promise.resolve(
      live && user?.isActive === true ? { userId: claims.sub, familyId: claims.fam } : null,
    );
  }

  private open(
    userId: string,
    familyId: string,
    absoluteExpiresAt: Date,
    now: Date,
  ): AuthTokenPair {
    const sessionId = randomUUID();
    const expiresAt = new Date(
      Math.min(now.getTime() + this.refreshTtlSeconds * 1000, absoluteExpiresAt.getTime()),
    );
    const refreshTtl = Math.max(1, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    const refreshToken = this.codec.signRefreshToken(
      { sub: userId, jti: sessionId, fam: familyId },
      refreshTtl,
    );
    const accessToken = this.codec.signAccessToken(
      { sub: userId, fam: familyId },
      Math.min(this.accessTtlSeconds, refreshTtl),
    );
    this.store.sessions.set(sessionId, {
      id: sessionId,
      userId,
      familyId,
      refreshTokenHash: sha256(refreshToken),
      isRevoked: false,
      rotatedAt: null,
      expiresAt,
      absoluteExpiresAt,
    });
    return { accessToken, refreshToken };
  }
}
