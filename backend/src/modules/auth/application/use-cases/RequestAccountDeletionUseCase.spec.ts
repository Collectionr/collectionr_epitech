import { RequestAccountDeletionUseCase } from './RequestAccountDeletionUseCase';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { accountDeletionDueAt } from '../../domain/rules/AccountDeletionPolicy';
import { UserNotFoundError } from '../errors/AuthErrors';
import type { IAccountErasureAudit } from '../ports/IAccountErasureAudit';
import type { IAuthTokenService } from '../ports/IAuthTokenService';
import type { IUserRepository } from '../ports/IUserRepository';

function buildUser(overrides: Partial<Parameters<typeof User.restore>[0]> = {}): User {
  return User.restore({
    email: Email.create('user@example.com'),
    passwordHash: 'hashed-password',
    username: 'trainer42',
    termsAcceptedAt: new Date(),
    termsVersion: '1',
    id: 'fixed-id',
    isActive: true,
    deletedAt: null,
    isAnonymized: false,
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('RequestAccountDeletionUseCase', () => {
  const save = jest.fn<Promise<User>, [User]>();
  const findById = jest.fn();
  const revokeAllRefreshTokens = jest.fn();
  const recordDeletionRequested = jest.fn();

  function build(): RequestAccountDeletionUseCase {
    const userRepository: IUserRepository = {
      save,
      findById,
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      findDeletionDue: jest.fn(),
    };
    const authTokenService: IAuthTokenService = {
      issueTokenPair: jest.fn(),
      rotateRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllRefreshTokens,
    };
    const erasureAudit: IAccountErasureAudit = {
      recordDeletionRequested,
      recordAnonymized: jest.fn(),
    };
    return new RequestAccountDeletionUseCase(userRepository, authTokenService, erasureAudit);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    findById.mockResolvedValue(buildUser());
    save.mockImplementation((user: User) => Promise.resolve(user));
    revokeAllRefreshTokens.mockResolvedValue(undefined);
    recordDeletionRequested.mockResolvedValue(undefined);
  });

  it('deactivates the account, records the request and revokes every session', async () => {
    const before = accountDeletionDueAt(new Date());

    const profile = await build().execute({ userId: 'fixed-id' });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: false,
        deletedAt: expect.any(Date) as unknown,
      }) as unknown,
    );
    expect(revokeAllRefreshTokens).toHaveBeenCalledWith('fixed-id');
    expect(profile.isActive).toBe(false);
    expect(profile.deletedAt?.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(profile.deletedAt?.getTime()).toBeLessThanOrEqual(
      accountDeletionDueAt(new Date()).getTime(),
    );
  });

  it('saves before revoking, so no new session can open in between', async () => {
    const order: string[] = [];
    save.mockImplementation((user: User) => {
      order.push('save');
      return Promise.resolve(user);
    });
    revokeAllRefreshTokens.mockImplementation(() => {
      order.push('revoke');
      return Promise.resolve();
    });

    await build().execute({ userId: 'fixed-id' });

    expect(order).toEqual(['save', 'revoke']);
  });

  it('keeps the first request when asked again: nothing is saved, the date does not move', async () => {
    const requestedAt = new Date('2026-11-01T10:00:00.000Z');
    findById.mockResolvedValue(buildUser({ isActive: false, deletedAt: requestedAt }));

    const profile = await build().execute({ userId: 'fixed-id' });

    expect(save).not.toHaveBeenCalled();
    expect(profile.deletedAt).toEqual(requestedAt);
    expect(revokeAllRefreshTokens).toHaveBeenCalledWith('fixed-id');
  });

  it('records the request on an account an admin had already deactivated, and revokes its sessions', async () => {
    findById.mockResolvedValue(buildUser({ isActive: false }));

    const profile = await build().execute({ userId: 'fixed-id' });

    expect(profile.deletedAt).toBeInstanceOf(Date);
    expect(revokeAllRefreshTokens).toHaveBeenCalledWith('fixed-id');
  });

  it('rejects an unknown account', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute({ userId: 'nobody' })).rejects.toBeInstanceOf(UserNotFoundError);
    expect(save).not.toHaveBeenCalled();
  });

  it('treats an anonymized account as unknown', async () => {
    findById.mockResolvedValue(
      buildUser({ isActive: false, deletedAt: new Date('2026-01-01'), isAnonymized: true }),
    );

    await expect(build().execute({ userId: 'fixed-id' })).rejects.toBeInstanceOf(UserNotFoundError);
    expect(save).not.toHaveBeenCalled();
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled();
  });

  it('does not revoke sessions when the save fails', async () => {
    save.mockRejectedValue(new Error('database down'));

    await expect(build().execute({ userId: 'fixed-id' })).rejects.toThrow('database down');
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled();
  });

  it('traces the request in the audit trail, once, before recording it', async () => {
    const order: string[] = [];
    recordDeletionRequested.mockImplementation(() => {
      order.push('audit');
      return Promise.resolve();
    });
    save.mockImplementation((user: User) => {
      order.push('save');
      return Promise.resolve(user);
    });

    await build().execute({ userId: 'fixed-id' });

    expect(recordDeletionRequested).toHaveBeenCalledTimes(1);
    expect(recordDeletionRequested).toHaveBeenCalledWith('fixed-id');
    expect(order).toEqual(['audit', 'save']);
  });

  it('does not record the request when it cannot be traced', async () => {
    recordDeletionRequested.mockRejectedValue(new Error('audit down'));

    await expect(build().execute({ userId: 'fixed-id' })).rejects.toThrow('audit down');
    expect(save).not.toHaveBeenCalled();
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled();
  });

  it('does not trace a repeated request again', async () => {
    findById.mockResolvedValue(
      buildUser({ isActive: false, deletedAt: new Date('2026-11-01T10:00:00.000Z') }),
    );

    await build().execute({ userId: 'fixed-id' });

    expect(recordDeletionRequested).not.toHaveBeenCalled();
  });
});
