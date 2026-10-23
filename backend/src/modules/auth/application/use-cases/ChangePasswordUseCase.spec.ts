import { ChangePasswordUseCase } from './ChangePasswordUseCase';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import {
  IncorrectCurrentPasswordError,
  SamePasswordError,
  UserNotFoundError,
} from '../errors/AuthErrors';
import type { IAuthTokenService } from '../ports/IAuthTokenService';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import type { IUserRepository } from '../ports/IUserRepository';

function buildUser(isActive = true): User {
  return User.restore({
    email: Email.create('user@example.com'),
    passwordHash: 'old-hash',
    username: 'trainer42',
    termsAcceptedAt: new Date(),
    termsVersion: '1',
    id: 'fixed-id',
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const DEFAULT_PASSWORD_MIN_LENGTH = 8;

describe('ChangePasswordUseCase', () => {
  const save = jest.fn<Promise<User>, [User]>();
  const findById = jest.fn();
  const findByEmail = jest.fn();
  const findByUsername = jest.fn();
  const hash = jest.fn();
  const verify = jest.fn();
  const getDummyHash = jest.fn();
  const issueTokenPair = jest.fn();
  const rotateRefreshToken = jest.fn();
  const revokeRefreshToken = jest.fn();
  const revokeAllRefreshTokens = jest.fn();

  function build(
    passwordMinLength = DEFAULT_PASSWORD_MIN_LENGTH,
    maxPasswordBytes = 72,
  ): ChangePasswordUseCase {
    const userRepository: IUserRepository = { save, findById, findByEmail, findByUsername };
    const passwordHasher: IPasswordHasher = { maxPasswordBytes, hash, verify, getDummyHash };
    const authTokenService: IAuthTokenService = {
      issueTokenPair,
      rotateRefreshToken,
      revokeRefreshToken,
      revokeAllRefreshTokens,
    };
    return new ChangePasswordUseCase(
      userRepository,
      passwordHasher,
      authTokenService,
      passwordMinLength,
    );
  }

  const request = () => ({
    userId: 'fixed-id',
    currentPassword: 'old-password1',
    newPassword: 'newpassword1',
  });

  beforeEach(() => {
    jest.resetAllMocks();
    findById.mockResolvedValue(buildUser());
    // Matches the current password, not the new one.
    verify.mockImplementation((plain: string) => Promise.resolve(plain === 'old-password1'));
    hash.mockResolvedValue('new-hash');
    revokeAllRefreshTokens.mockResolvedValue(undefined);
    save.mockImplementation((user: User) => Promise.resolve(user));
  });

  it('hashes and saves the new password when the current one matches', async () => {
    const profile = await build().execute(request());

    expect(verify).toHaveBeenCalledWith('old-password1', 'old-hash');
    expect(hash).toHaveBeenCalledWith('newpassword1');
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'new-hash' }) as unknown,
    );
    expect(profile.id).toBe('fixed-id');
  });

  it('never returns the password hash', async () => {
    const profile = await build().execute(request());

    expect(profile).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(profile)).not.toContain('new-hash');
  });

  it('revokes every session of the user when the password changes', async () => {
    await build().execute(request());

    expect(revokeAllRefreshTokens).toHaveBeenCalledWith('fixed-id');
  });

  it('leaves the password unchanged when session revocation fails', async () => {
    revokeAllRefreshTokens.mockRejectedValue(new Error('session store down'));

    await expect(build().execute(request())).rejects.toThrow('session store down');
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses a new password identical to the current one, revoking nothing', async () => {
    verify.mockResolvedValue(true);

    await expect(build().execute(request())).rejects.toThrow(SamePasswordError);
    expect(hash).not.toHaveBeenCalled();
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects when the user does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute(request())).rejects.toThrow(UserNotFoundError);
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled();
  });

  it('treats a deactivated account as unknown: nothing verified, hashed or revoked', async () => {
    findById.mockResolvedValue(buildUser(false));

    await expect(build().execute(request())).rejects.toThrow(UserNotFoundError);
    expect(verify).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects when the current password is incorrect', async () => {
    await expect(
      build().execute({ ...request(), currentPassword: 'wrong-password' }),
    ).rejects.toThrow(IncorrectCurrentPasswordError);
    expect(save).not.toHaveBeenCalled();
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled();
  });

  it('rejects a new password that fails the policy', async () => {
    await expect(build().execute({ ...request(), newPassword: 'short' })).rejects.toThrow(
      /at least 8 characters/,
    );
    expect(save).not.toHaveBeenCalled();
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled();
  });

  it('enforces the injected PASSWORD_MIN_LENGTH rather than a hardcoded value', async () => {
    await expect(
      // 9 chars: satisfies the default minLength (8) but not this test's stricter one (12).
      build(12).execute({ ...request(), newPassword: 'newpass12' }),
    ).rejects.toThrow(/at least 12 characters/);
    expect(save).not.toHaveBeenCalled();
  });

  it('takes the maximum password size from the hasher', async () => {
    await expect(
      build(8, 10).execute({ ...request(), newPassword: 'abcd12345678' }),
    ).rejects.toThrow(/at most 10 bytes/);
    expect(hash).not.toHaveBeenCalled();
  });
});
