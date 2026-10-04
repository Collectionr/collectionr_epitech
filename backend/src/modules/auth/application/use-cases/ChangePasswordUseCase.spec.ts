import { ChangePasswordUseCase } from './ChangePasswordUseCase';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { IncorrectCurrentPasswordError, UserNotFoundError } from '../errors/AuthErrors';
import type { IAuthTokenService } from '../ports/IAuthTokenService';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import type { IUserRepository } from '../ports/IUserRepository';

function buildUser(): User {
  return User.register({
    email: Email.create('user@example.com'),
    passwordHash: 'old-hash',
    username: 'trainer42',
    consentGivenAt: new Date(),
  });
}

const DEFAULT_PASSWORD_MIN_LENGTH = 8;

describe('ChangePasswordUseCase', () => {
  const save = jest.fn<Promise<User>, [User]>();
  const findById = jest.fn();
  const findByEmail = jest.fn();
  const hash = jest.fn();
  const verify = jest.fn();
  const issueTokenPair = jest.fn();
  const rotateRefreshToken = jest.fn();
  const revokeRefreshToken = jest.fn();
  const revokeAllRefreshTokens = jest.fn();
  let existingUser: User;

  function build(passwordMinLength = DEFAULT_PASSWORD_MIN_LENGTH): ChangePasswordUseCase {
    const userRepository: IUserRepository = { save, findById, findByEmail };
    const passwordHasher: IPasswordHasher = { hash, verify };
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

  beforeEach(() => {
    jest.resetAllMocks();
    existingUser = buildUser();
    findById.mockResolvedValue(existingUser);
    verify.mockResolvedValue(true);
    hash.mockResolvedValue('new-hash');
    revokeAllRefreshTokens.mockResolvedValue(undefined);
    save.mockImplementation((user: User) => Promise.resolve(user));
  });

  it('hashes and saves the new password when the current one matches', async () => {
    const updated = await build().execute({
      userId: existingUser.id,
      currentPassword: 'old-password1',
      newPassword: 'newpassword1',
    });

    expect(verify).toHaveBeenCalledWith('old-password1', 'old-hash');
    expect(hash).toHaveBeenCalledWith('newpassword1');
    expect(updated.passwordHash).toBe('new-hash');
  });

  it('revokes every session of the user when the password changes', async () => {
    await build().execute({
      userId: existingUser.id,
      currentPassword: 'old-password1',
      newPassword: 'newpassword1',
    });

    expect(revokeAllRefreshTokens).toHaveBeenCalledWith(existingUser.id);
  });

  it('leaves the password unchanged when session revocation fails', async () => {
    revokeAllRefreshTokens.mockRejectedValue(new Error('session store down'));

    await expect(
      build().execute({
        userId: existingUser.id,
        currentPassword: 'old-password1',
        newPassword: 'newpassword1',
      }),
    ).rejects.toThrow('session store down');
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects when the user does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      build().execute({
        userId: 'missing-id',
        currentPassword: 'old-password1',
        newPassword: 'newpassword1',
      }),
    ).rejects.toThrow(UserNotFoundError);
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled();
  });

  it('rejects when the current password is incorrect', async () => {
    verify.mockResolvedValue(false);

    await expect(
      build().execute({
        userId: existingUser.id,
        currentPassword: 'wrong-password',
        newPassword: 'newpassword1',
      }),
    ).rejects.toThrow(IncorrectCurrentPasswordError);
    expect(save).not.toHaveBeenCalled();
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled();
  });

  it('rejects a new password that fails the policy', async () => {
    await expect(
      build().execute({
        userId: existingUser.id,
        currentPassword: 'old-password1',
        newPassword: 'short',
      }),
    ).rejects.toThrow(/at least 8 characters/);
    expect(save).not.toHaveBeenCalled();
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled();
  });

  it('enforces the injected PASSWORD_MIN_LENGTH rather than a hardcoded value', async () => {
    await expect(
      build(12).execute({
        userId: existingUser.id,
        currentPassword: 'old-password1',
        // 9 chars: satisfies the default minLength (8) but not this test's stricter one (12).
        newPassword: 'newpass12',
      }),
    ).rejects.toThrow(/at least 12 characters/);
    expect(save).not.toHaveBeenCalled();
  });
});
