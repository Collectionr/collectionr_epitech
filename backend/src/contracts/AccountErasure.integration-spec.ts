import { randomUUID } from 'node:crypto';
import { PrismaAuditLogRepository } from '../modules/audit/infrastructure/repositories/PrismaAuditLogRepository';
import { RecordAuditEntryUseCase } from '../modules/audit/application/use-cases/RecordAuditEntryUseCase';
import { AnonymizeDueAccountsUseCase } from '../modules/auth/application/use-cases/AnonymizeDueAccountsUseCase';
import { RequestAccountDeletionUseCase } from '../modules/auth/application/use-cases/RequestAccountDeletionUseCase';
import { User } from '../modules/auth/domain/entities/User';
import { ACCOUNT_DELETION_GRACE_DAYS } from '../modules/auth/domain/rules/AccountDeletionPolicy';
import { Email } from '../modules/auth/domain/value-objects/Email';
import { PrismaAccountDataEraser } from '../modules/auth/infrastructure/repositories/PrismaAccountDataEraser';
import { PrismaUserRepository } from '../modules/auth/infrastructure/repositories/PrismaUserRepository';
import { AuditAccountErasureTrail } from '../modules/auth/infrastructure/services/AuditAccountErasureTrail';
import { JwtAuthTokenService } from '../modules/auth/infrastructure/services/JwtAuthTokenService';
import { createIntegrationPrisma, createTestCodec } from './IntegrationDatabase';

/**
 * COLLR-762 against a real PostgreSQL: what the unit specs cannot prove — the raw SQL that strips the
 * audit emails, the cascades, the CHECK constraint, and the whole request -> anonymization path.
 */
const prisma = createIntegrationPrisma();
const users = new PrismaUserRepository(prisma);
const tokens = new JwtAuthTokenService(createTestCodec(), prisma, 900, 604800, 2592000);
const audit = new AuditAccountErasureTrail(
  new RecordAuditEntryUseCase(new PrismaAuditLogRepository(prisma), 90),
);
const request = new RequestAccountDeletionUseCase(users, tokens, audit);
const anonymize = new AnonymizeDueAccountsUseCase(
  users,
  new PrismaAccountDataEraser(prisma),
  audit,
);

const DAY = 24 * 60 * 60 * 1000;

afterAll(async () => {
  await prisma.$disconnect();
});

async function registerWithData(): Promise<User> {
  const suffix = randomUUID().slice(0, 8);
  const user = await users.save(
    User.register({
      email: Email.create(`erase${suffix}@example.com`),
      passwordHash: '$2b$12$7irbQ5LXMyoaQFmTLtzC1eySZGqAcpYWel1GwQEWJsTOh/ZWRtL7e',
      username: `erase-${suffix}`,
      termsAcceptedAt: new Date(),
      termsVersion: '1',
    }),
  );
  await tokens.issueTokenPair(user.id);
  const licence = await prisma.licenceTCG.create({ data: { slug: `erase-${suffix}`, name: 'x' } });
  await prisma.collection.create({
    data: { userId: user.id, licenceTCGId: licence.id, name: 'Ma collection' },
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'auth.login.failed',
      metadata: { email: user.email.value, reason: 'bad password' },
      expiresAt: new Date(Date.now() + 90 * DAY),
    },
  });
  return user;
}

/** Moves the erasure request back in time, as if the grace period had run. */
async function ageRequest(userId: string, days: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date(Date.now() - days * DAY) },
  });
}

/** Other accounts due from earlier runs share the database: run until ours is done. */
async function runUntilAnonymized(userId: string): Promise<void> {
  for (let run = 0; run < 50; run += 1) {
    await anonymize.execute();
    if ((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).isAnonymized) {
      return;
    }
  }
  throw new Error('the account was never anonymized');
}

describe('Account erasure (real PostgreSQL)', () => {
  it('does not touch an account still inside its grace period', async () => {
    const user = await registerWithData();
    await request.execute({ userId: user.id });
    await ageRequest(user.id, ACCOUNT_DELETION_GRACE_DAYS - 1);

    await anonymize.execute();

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.isAnonymized).toBe(false);
    expect(stored.email).toBe(user.email.value);
    expect(await prisma.collection.count({ where: { userId: user.id } })).toBe(1);
  });

  it('deactivates at the request, then anonymizes and erases once the grace period is over', async () => {
    const user = await registerWithData();

    const profile = await request.execute({ userId: user.id });

    expect(profile.isActive).toBe(false);
    expect(profile.deletedAt).toBeInstanceOf(Date);
    expect(await prisma.session.count({ where: { userId: user.id, isRevoked: false } })).toBe(0);

    await ageRequest(user.id, ACCOUNT_DELETION_GRACE_DAYS + 1);
    await runUntilAnonymized(user.id);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const handle = user.id.replaceAll('-', '');
    expect(stored.isAnonymized).toBe(true);
    expect(stored.isActive).toBe(false);
    expect(stored.email).toBe(`deleted-${handle}@anonymized.invalid`);
    expect(stored.username).toBe(`deleted-${handle}`);
    expect(stored.passwordHash).not.toBe(user.passwordHash);
    expect(await users.findByEmail(user.email)).toBeNull();

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.collection.count({ where: { userId: user.id } })).toBe(0);
  });

  it('keeps the audit entries but strips the email they carried', async () => {
    const user = await registerWithData();
    await request.execute({ userId: user.id });
    await ageRequest(user.id, ACCOUNT_DELETION_GRACE_DAYS + 1);
    await runUntilAnonymized(user.id);

    const entries = await prisma.auditLog.findMany({ where: { userId: user.id } });
    const failedLogin = entries.find((entry) => entry.action === 'auth.login.failed');

    expect(failedLogin?.metadata).toEqual({ reason: 'bad password' });
    expect(entries.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['auth.account.deletion_requested', 'auth.account.anonymized']),
    );
    const anonymized = entries.find((entry) => entry.action === 'auth.account.anonymized');
    expect(anonymized?.targetId).toBe(user.id);
    expect(JSON.stringify(entries)).not.toContain(user.email.value);
  });

  it('refuses, in the database itself, an anonymized account whose erasure was never requested', async () => {
    const user = await registerWithData();

    await expect(
      prisma.user.update({ where: { id: user.id }, data: { isAnonymized: true } }),
    ).rejects.toThrow();
  });

  it('lets the email and the username be registered again once the account is anonymized', async () => {
    const user = await registerWithData();
    await request.execute({ userId: user.id });
    await ageRequest(user.id, ACCOUNT_DELETION_GRACE_DAYS + 1);
    await runUntilAnonymized(user.id);

    await expect(
      users.save(
        User.register({
          email: user.email,
          passwordHash: user.passwordHash,
          username: user.username,
          termsAcceptedAt: new Date(),
          termsVersion: '1',
        }),
      ),
    ).resolves.toBeDefined();
  });
});
