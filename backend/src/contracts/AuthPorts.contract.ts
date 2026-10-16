/**
 * Reusable behavioural contracts for the auth ports (COLLR-414).
 * Pure functions: they register jest `describe`/`it` blocks against ANY implementation of the port
 * (in-memory fake, Prisma, ...). Imports are relative to src/ (file lives in src/contracts/).
 */
import { randomUUID } from 'node:crypto';
import { User } from '../modules/auth/domain/entities/User';
import { Email } from '../modules/auth/domain/value-objects/Email';
import {
  ConcurrentModificationError,
  EmailAlreadyUsedError,
  InvalidRefreshTokenError,
  UsernameAlreadyUsedError,
} from '../modules/auth/application/errors/AuthErrors';
import type { IUserRepository } from '../modules/auth/application/ports/IUserRepository';
import type { IPasswordHasher } from '../modules/auth/application/ports/IPasswordHasher';
import type { IAuthTokenService } from '../modules/auth/application/ports/IAuthTokenService';

const HASH = '$2b$12$7irbQ5LXMyoaQFmTLtzC1eySZGqAcpYWel1GwQEWJsTOh/ZWRtL7e';
export const newUser = (email = `c${randomUUID().slice(0, 8)}@example.com`): User =>
  User.register({
    email: Email.create(email),
    passwordHash: HASH,
    username: `contract-${randomUUID().slice(0, 8)}`,
    termsAcceptedAt: new Date(),
    termsVersion: '1',
  });

export function userRepositoryContract(name: string, make: () => IUserRepository): void {
  describe(`IUserRepository contract - ${name}`, () => {
    it('round-trips a saved user by id and by email', async () => {
      const repo = make();
      const u = newUser();
      await repo.save(u);
      expect((await repo.findById(u.id))?.email.value).toBe(u.email.value);
      expect((await repo.findByEmail(u.email))?.id).toBe(u.id);
    });

    it('returns null (never throws) for unknown ids/emails, including malformed ids', async () => {
      const repo = make();
      expect(await repo.findByEmail(Email.create('nobody@example.com'))).toBeNull();
      expect(await repo.findById(randomUUID())).toBeNull();
      await expect(repo.findById('not-a-uuid')).resolves.toBeNull();
    });

    it('rejects a second user with the same email with EmailAlreadyUsedError (sequential)', async () => {
      const repo = make();
      const a = newUser();
      await repo.save(a);
      await expect(repo.save(newUser(a.email.value))).rejects.toBeInstanceOf(EmailAlreadyUsedError);
    });

    it('under 15 concurrent saves of one email: exactly 1 wins, all others fail with EmailAlreadyUsedError', async () => {
      const repo = make();
      const email = `race${randomUUID().slice(0, 8)}@example.com`;
      const results = await Promise.allSettled(
        Array.from({ length: 15 }, () => repo.save(newUser(email))),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const other = results.filter(
        (r) => r.status === 'rejected' && !(r.reason instanceof EmailAlreadyUsedError),
      );
      expect(ok).toBe(1);
      expect(other).toHaveLength(0);
    });

    it('refuses a stale snapshot instead of silently undoing a concurrent password change (lost update)', async () => {
      const repo = make();
      const u = newUser();
      await repo.save(u);
      const stale = (await repo.findById(u.id)) as User; // snapshot 1 (old hash)
      await repo.save(
        u.withPasswordHash('$2b$12$NEWHASHNEWHASHNEWHASHNEWHASHNEWHASHNEWHASHNEWHASHNEWH'),
      ); // password change commits
      await expect(
        repo.save(stale.withUsername(`renamed-${randomUUID().slice(0, 8)}`)),
      ).rejects.toBeInstanceOf(ConcurrentModificationError); // unrelated profile update from stale snapshot
      const stored = await repo.findById(u.id);
      expect(stored?.passwordHash).toContain('NEWHASH');
      expect(stored?.username).toBe(u.username);
    });

    it('findByUsername finds a user whatever the case and spacing of the lookup', async () => {
      const repo = make();
      const key = `Pokemon${randomUUID().slice(0, 6)} Master`;
      const u = User.register({
        email: Email.create(`case${randomUUID().slice(0, 8)}@example.com`),
        passwordHash: HASH,
        username: key,
        termsAcceptedAt: new Date(),
        termsVersion: '1',
      });
      await repo.save(u);
      const variants = [key, key.toUpperCase(), `  ${key.toLowerCase().replace(' ', '   ')} `];
      for (const variant of variants) {
        expect((await repo.findByUsername(variant))?.id).toBe(u.id);
      }
      await expect(repo.findByUsername(`${key}-other`)).resolves.toBeNull();
    });

    it('rejects a username that differs only by case or spacing, with UsernameAlreadyUsedError', async () => {
      const repo = make();
      const suffix = randomUUID().slice(0, 8);
      const first = User.register({
        email: Email.create(`u1${randomUUID().slice(0, 8)}@example.com`),
        passwordHash: HASH,
        username: `Ash ${suffix}`,
        termsAcceptedAt: new Date(),
        termsVersion: '1',
      });
      await repo.save(first);
      const second = User.register({
        email: Email.create(`u2${randomUUID().slice(0, 8)}@example.com`),
        passwordHash: HASH,
        username: `  ASH   ${suffix.toUpperCase()}  `,
        termsAcceptedAt: new Date(),
        termsVersion: '1',
      });
      await expect(repo.save(second)).rejects.toBeInstanceOf(UsernameAlreadyUsedError);
    });

    it('tells a taken email and a taken username apart', async () => {
      const repo = make();
      const taken = User.register({
        email: Email.create(`tk${randomUUID().slice(0, 8)}@example.com`),
        passwordHash: HASH,
        username: `name${randomUUID().slice(0, 8)}`,
        termsAcceptedAt: new Date(),
        termsVersion: '1',
      });
      await repo.save(taken);
      const sameEmail = User.register({
        email: taken.email,
        passwordHash: HASH,
        username: `other${randomUUID().slice(0, 8)}`,
        termsAcceptedAt: new Date(),
        termsVersion: '1',
      });
      const sameName = User.register({
        email: Email.create(`fresh${randomUUID().slice(0, 8)}@example.com`),
        passwordHash: HASH,
        username: taken.username.toUpperCase(),
        termsAcceptedAt: new Date(),
        termsVersion: '1',
      });

      await expect(repo.save(sameEmail)).rejects.toBeInstanceOf(EmailAlreadyUsedError);
      await expect(repo.save(sameName)).rejects.toBeInstanceOf(UsernameAlreadyUsedError);
    });

    it('under 15 concurrent registrations of one username: exactly 1 wins, all others get UsernameAlreadyUsedError', async () => {
      const repo = make();
      const name = `race${randomUUID().slice(0, 8)}`;
      const results = await Promise.allSettled(
        Array.from({ length: 15 }, (_, i) =>
          repo.save(
            User.register({
              email: Email.create(`r${i}${randomUUID().slice(0, 8)}@example.com`),
              passwordHash: HASH,
              username: i % 2 === 0 ? name : name.toUpperCase(),
              termsAcceptedAt: new Date(),
              termsVersion: '1',
            }),
          ),
        ),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const unexpected = results.filter(
        (r) => r.status === 'rejected' && !(r.reason instanceof UsernameAlreadyUsedError),
      );
      expect(ok).toBe(1);
      expect(unexpected).toHaveLength(0);
    });

    it('refuses a stale snapshot instead of re-activating a deactivated account', async () => {
      const repo = make();
      const u = newUser();
      await repo.save(u);
      const stale = (await repo.findById(u.id)) as User;
      await repo.save(u.deactivate());
      await expect(
        repo.save(stale.withUsername(`renamed-${randomUUID().slice(0, 8)}`)),
      ).rejects.toBeInstanceOf(ConcurrentModificationError);
      expect((await repo.findById(u.id))?.isActive).toBe(false);
    });

    it('returns the new version, and saving that returned copy again works (a chain of updates is not a conflict)', async () => {
      const repo = make();
      const u = newUser();
      const created = await repo.save(u);
      const third = `third-${randomUUID().slice(0, 8)}`;
      const renamed = await repo.save(created.withUsername(`second-${randomUUID().slice(0, 8)}`));
      const renamedAgain = await repo.save(renamed.withUsername(third));
      expect(renamed.version).toBe(created.version + 1);
      expect(renamedAgain.version).toBe(renamed.version + 1);
      expect((await repo.findById(u.id))?.username).toBe(third);
    });

    it('under concurrent updates from the same base version: exactly one wins, the others get ConcurrentModificationError', async () => {
      const repo = make();
      const created = await repo.save(newUser());
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          repo.save(created.withUsername(`name-${i}-${randomUUID().slice(0, 8)}`)),
        ),
      );
      const won = results.filter((r) => r.status === 'fulfilled').length;
      const unexpected = results.filter(
        (r) => r.status === 'rejected' && !(r.reason instanceof ConcurrentModificationError),
      );
      expect(won).toBe(1);
      expect(unexpected).toHaveLength(0);
    });
  });
}

export function passwordHasherContract(name: string, make: () => IPasswordHasher): void {
  describe(`IPasswordHasher contract - ${name}`, () => {
    const cost = (h: string): number => Number(h.split('$')[2]);

    it('hash != plain, salted (two hashes differ), verify round-trips', async () => {
      const h = make();
      const a = await h.hash('Passw0rdAAA');
      const b = await h.hash('Passw0rdAAA');
      expect(a).not.toBe('Passw0rdAAA');
      expect(a).not.toBe(b);
      expect(await h.verify('Passw0rdAAA', a)).toBe(true);
      expect(await h.verify('Passw0rdAAA!', a)).toBe(false);
    });

    it('verify() never throws on a malformed / empty stored hash', async () => {
      const h = make();
      await expect(h.verify('x', '')).resolves.toBe(false);
      await expect(h.verify('x', 'not-a-hash')).resolves.toBe(false);
    });

    it('the dummy hash it provides has exactly the cost of the hashes it produces (so unknown accounts are not faster)', async () => {
      const h = make();
      expect(cost(h.getDummyHash())).toBe(cost(await h.hash('x1x1x1x1')));
    });

    it('the dummy hash is parseable by verify() and matches nothing', async () => {
      const h = make();
      await expect(h.verify('x1x1x1x1', h.getDummyHash())).resolves.toBe(false);
      await expect(h.verify('', h.getDummyHash())).resolves.toBe(false);
    });

    it('a suffix beyond byte 72 must NOT be silently ignored by verify (bcrypt truncation)', async () => {
      const h = make();
      const p = 'a1' + 'x'.repeat(70); // exactly 72 bytes
      const hash = await h.hash(p);
      expect(await h.verify(p + 'ANYTHING', hash)).toBe(false);
    });
  });
}

export interface TokenHarness {
  service: IAuthTokenService;
  /** Returns a persisted user id. */
  createUser: () => Promise<string>;
  liveSessionsOf: (userId: string) => Promise<number>;
  deactivate: (userId: string) => Promise<void>;
}

export function authTokenServiceContract(name: string, make: () => TokenHarness): void {
  describe(`IAuthTokenService contract - ${name}`, () => {
    it('rotate burns the old token (single use) and the new pair works', async () => {
      const { service, createUser } = make();
      const id = await createUser();
      const p1 = await service.issueTokenPair(id);
      const p2 = await service.rotateRefreshToken(p1.refreshToken);
      await expect(service.rotateRefreshToken(p2.refreshToken)).resolves.toBeDefined();
      await expect(service.rotateRefreshToken(p1.refreshToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
    });

    it('a token that was already rotated and is presented again means it leaked: the whole chain dies', async () => {
      const { service, createUser, liveSessionsOf } = make();
      const id = await createUser();
      const p1 = await service.issueTokenPair(id);
      const p2 = await service.rotateRefreshToken(p1.refreshToken);
      await expect(service.rotateRefreshToken(p1.refreshToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      await expect(service.rotateRefreshToken(p2.refreshToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      expect(await liveSessionsOf(id)).toBe(0);
    });

    it('20 concurrent rotations of ONE token: at most 1 succeeds', async () => {
      const { service, createUser } = make();
      const id = await createUser();
      const p = await service.issueTokenPair(id);
      const res = await Promise.allSettled(
        Array.from({ length: 20 }, () => service.rotateRefreshToken(p.refreshToken)),
      );
      expect(res.filter((r) => r.status === 'fulfilled').length).toBeLessThanOrEqual(1);
    });

    it('rotating an ACCESS token must reject with InvalidRefreshTokenError (not a raw error)', async () => {
      const { service, createUser } = make();
      const id = await createUser();
      const p = await service.issueTokenPair(id);
      await expect(service.rotateRefreshToken(p.accessToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
    });

    it('revokeRefreshToken is idempotent and never throws (garbage, empty, already revoked, access token)', async () => {
      const { service, createUser } = make();
      const id = await createUser();
      const p = await service.issueTokenPair(id);
      for (const t of ['', 'garbage', p.refreshToken, p.refreshToken, p.accessToken]) {
        await expect(service.revokeRefreshToken(t)).resolves.toBeUndefined();
      }
    });

    it("an access token passed as refreshToken to revokeRefreshToken must not revoke OTHER users' sessions", async () => {
      const { service, createUser, liveSessionsOf } = make();
      const attacker = await createUser();
      const victim = await createUser();
      const a = await service.issueTokenPair(attacker);
      await service.issueTokenPair(victim);
      await service.revokeRefreshToken(a.accessToken);
      expect(await liveSessionsOf(victim)).toBe(1);
      expect(await liveSessionsOf(attacker)).toBe(1); // not even the caller's own session
    });

    it('revokeAllRefreshTokens(userId) kills every session of that user and none of the others', async () => {
      const { service, createUser, liveSessionsOf } = make();
      const u = await createUser();
      const o = await createUser();
      await service.issueTokenPair(u);
      await service.issueTokenPair(u);
      await service.issueTokenPair(o);
      await service.revokeAllRefreshTokens(u);
      expect(await liveSessionsOf(u)).toBe(0);
      expect(await liveSessionsOf(o)).toBe(1);
    });

    it('refuses to rotate for a deactivated account', async () => {
      const { service, createUser, deactivate } = make();
      const u = await createUser();
      const p = await service.issueTokenPair(u);
      await deactivate(u);
      await expect(service.rotateRefreshToken(p.refreshToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
    });
  });
}
