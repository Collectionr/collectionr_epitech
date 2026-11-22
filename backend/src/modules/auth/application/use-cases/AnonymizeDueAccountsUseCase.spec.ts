import { Logger } from '@nestjs/common';
import {
  ANONYMIZATION_BATCH_SIZE,
  AnonymizeDueAccountsUseCase,
} from './AnonymizeDueAccountsUseCase';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import type { IAccountErasureAudit } from '../ports/IAccountErasureAudit';
import type { IAccountDataEraser } from '../ports/IAccountDataEraser';
import type { IUserRepository } from '../ports/IUserRepository';

const NOW = new Date('2026-12-15T10:00:00.000Z');
const REQUESTED_LONG_AGO = new Date('2026-11-01T10:00:00.000Z');

function pendingUser(id: string, deletedAt: Date = REQUESTED_LONG_AGO): User {
  return User.restore({
    email: Email.create(`${id}@example.com`),
    passwordHash: 'hashed-password',
    username: `trainer-${id}`,
    termsAcceptedAt: new Date('2026-01-01'),
    termsVersion: '1',
    id,
    isActive: false,
    deletedAt,
    isAnonymized: false,
    version: 2,
    createdAt: new Date('2026-01-01'),
    updatedAt: deletedAt,
  });
}

describe('AnonymizeDueAccountsUseCase', () => {
  const findDeletionDue = jest.fn();
  const save = jest.fn<Promise<User>, [User]>();
  const eraseAccountData = jest.fn();
  const recordAnonymized = jest.fn();

  function build(): AnonymizeDueAccountsUseCase {
    const userRepository: IUserRepository = {
      save,
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      findDeletionDue,
    };
    const eraser: IAccountDataEraser = { eraseAccountData };
    const erasureAudit: IAccountErasureAudit = {
      recordDeletionRequested: jest.fn(),
      recordAnonymized,
    };
    return new AnonymizeDueAccountsUseCase(userRepository, eraser, erasureAudit);
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    findDeletionDue.mockResolvedValue([]);
    save.mockImplementation((user: User) => Promise.resolve(user));
    eraseAccountData.mockResolvedValue(undefined);
    recordAnonymized.mockResolvedValue(undefined);
  });

  it('asks for the accounts requested 30 days ago or more, one batch at a time', async () => {
    await build().execute(NOW);

    expect(findDeletionDue).toHaveBeenCalledWith(
      new Date('2026-11-15T10:00:00.000Z'),
      ANONYMIZATION_BATCH_SIZE,
    );
  });

  it('does nothing when no account is due', async () => {
    await expect(build().execute(NOW)).resolves.toEqual({ anonymized: 0, failed: 0 });
    expect(eraseAccountData).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('erases the data of each due account, then saves it anonymized', async () => {
    findDeletionDue.mockResolvedValue([pendingUser('a'), pendingUser('b')]);

    const result = await build().execute(NOW);

    expect(result).toEqual({ anonymized: 2, failed: 0 });
    expect(eraseAccountData).toHaveBeenNthCalledWith(1, 'a');
    expect(eraseAccountData).toHaveBeenNthCalledWith(2, 'b');
    const saved = save.mock.calls.map(([user]) => user);
    expect(saved.map((user) => user.id)).toEqual(['a', 'b']);
    expect(saved.every((user) => user.isAnonymized && user.email.value.endsWith('.invalid'))).toBe(
      true,
    );
  });

  it('erases, then traces, then anonymizes: the row is only changed once its data is gone and the erasure is on record', async () => {
    findDeletionDue.mockResolvedValue([pendingUser('a')]);
    const order: string[] = [];
    recordAnonymized.mockImplementation(() => {
      order.push('audit');
      return Promise.resolve();
    });
    eraseAccountData.mockImplementation(() => {
      order.push('erase');
      return Promise.resolve();
    });
    save.mockImplementation((user: User) => {
      order.push('save');
      return Promise.resolve(user);
    });

    await build().execute(NOW);

    expect(order).toEqual(['erase', 'audit', 'save']);
  });

  it('does not anonymize an account whose data could not be erased, and goes on with the others', async () => {
    findDeletionDue.mockResolvedValue([pendingUser('a'), pendingUser('b')]);
    eraseAccountData.mockRejectedValueOnce(new Error('deadlock'));

    const result = await build().execute(NOW);

    expect(result).toEqual({ anonymized: 1, failed: 1 });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].id).toBe('b');
  });

  it('counts an account modified concurrently as failed, to be picked up by the next run', async () => {
    findDeletionDue.mockResolvedValue([pendingUser('a'), pendingUser('b')]);
    save.mockRejectedValueOnce(new Error('ConcurrentModificationError'));

    await expect(build().execute(NOW)).resolves.toEqual({ anonymized: 1, failed: 1 });
  });

  it('never logs the error message, which could echo personal data', async () => {
    findDeletionDue.mockResolvedValue([pendingUser('a')]);
    eraseAccountData.mockRejectedValue(new Error('duplicate key value (email)=(x@y.z)'));
    const error = jest.spyOn(Logger.prototype, 'error');

    await build().execute(NOW);

    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error.mock.calls)).not.toContain('x@y.z');
  });

  it('counts a failure that is not an Error too, and uses the current time by default', async () => {
    findDeletionDue.mockResolvedValue([pendingUser('a')]);
    eraseAccountData.mockRejectedValue('boom');

    const before = Date.now();
    await expect(build().execute()).resolves.toEqual({ anonymized: 0, failed: 1 });

    const [cutoff] = findDeletionDue.mock.calls[0] as [Date];
    expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 30 * 24 * 60 * 60 * 1000);
  });

  it('traces each anonymization with the id and the date of the request, nothing personal', async () => {
    findDeletionDue.mockResolvedValue([pendingUser('a'), pendingUser('b')]);

    await build().execute(NOW);

    expect(recordAnonymized).toHaveBeenCalledTimes(2);
    expect(recordAnonymized).toHaveBeenNthCalledWith(1, 'a', REQUESTED_LONG_AGO);
    expect(recordAnonymized).toHaveBeenNthCalledWith(2, 'b', REQUESTED_LONG_AGO);
  });

  it('leaves the row untouched, and the account due, when the erasure cannot be traced', async () => {
    findDeletionDue.mockResolvedValue([pendingUser('a'), pendingUser('b')]);
    recordAnonymized.mockRejectedValueOnce(new Error('audit down'));

    const result = await build().execute(NOW);

    expect(result).toEqual({ anonymized: 1, failed: 1 });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].id).toBe('b');
  });
});
