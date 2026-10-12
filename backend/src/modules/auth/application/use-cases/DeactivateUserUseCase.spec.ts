import { DeactivateUserUseCase } from './DeactivateUserUseCase';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { UserNotFoundError } from '../errors/AuthErrors';
import type { IAuthTokenService } from '../ports/IAuthTokenService';
import type { IUserRepository } from '../ports/IUserRepository';

function buildUser(): User {
  return User.register({
    email: Email.create('user@example.com'),
    passwordHash: 'hashed-password',
    username: 'trainer42',
    consentGivenAt: new Date(),
  });
}

describe('DeactivateUserUseCase', () => {
  const save = jest.fn<Promise<User>, [User]>();
  const findById = jest.fn();
  const findByEmail = jest.fn();
  const revokeAllRefreshTokens = jest.fn();
  let existingUser: User;

  function build(): DeactivateUserUseCase {
    const userRepository: IUserRepository = { save, findById, findByEmail };
    const authTokenService: IAuthTokenService = {
      issueTokenPair: jest.fn(),
      rotateRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllRefreshTokens,
    };
    return new DeactivateUserUseCase(userRepository, authTokenService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    existingUser = buildUser();
    findById.mockResolvedValue(existingUser);
    revokeAllRefreshTokens.mockResolvedValue(undefined);
    save.mockImplementation((user: User) => Promise.resolve(user));
  });

  it('saves the deactivated account and revokes every session of the user', async () => {
    const result = await build().execute({ userId: existingUser.id });

    expect(result.isActive).toBe(false);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    expect(revokeAllRefreshTokens).toHaveBeenCalledWith(existingUser.id);
  });

  it('is idempotent: an already deactivated account is not saved again but sessions are still revoked', async () => {
    findById.mockResolvedValue(existingUser.deactivate());

    const result = await build().execute({ userId: existingUser.id });

    expect(result.isActive).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(revokeAllRefreshTokens).toHaveBeenCalledWith(existingUser.id);
  });

  it('rejects when the user does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute({ userId: 'missing-id' })).rejects.toThrow(UserNotFoundError);
    expect(save).not.toHaveBeenCalled();
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled();
  });
});
