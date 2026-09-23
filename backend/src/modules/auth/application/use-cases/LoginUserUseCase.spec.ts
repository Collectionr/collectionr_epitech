import { LoginUserUseCase } from './LoginUserUseCase';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { InvalidCredentialsError } from '../errors/AuthErrors';
import type { IAuthTokenService } from '../ports/IAuthTokenService';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import type { IUserRepository } from '../ports/IUserRepository';

function buildUser(): User {
  return User.register({
    email: Email.create('user@example.com'),
    passwordHash: 'hashed-password',
    username: 'trainer42',
    consentGivenAt: new Date(),
  });
}

describe('LoginUserUseCase', () => {
  const save = jest.fn();
  const findById = jest.fn();
  const findByEmail = jest.fn();
  const hash = jest.fn();
  const verify = jest.fn();
  const issueTokenPair = jest.fn();
  const rotateRefreshToken = jest.fn();
  const revokeRefreshToken = jest.fn();

  function build(): LoginUserUseCase {
    const userRepository: IUserRepository = { save, findById, findByEmail };
    const passwordHasher: IPasswordHasher = { hash, verify };
    const authTokenService: IAuthTokenService = {
      issueTokenPair,
      rotateRefreshToken,
      revokeRefreshToken,
    };
    return new LoginUserUseCase(userRepository, passwordHasher, authTokenService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    findByEmail.mockResolvedValue(buildUser());
    verify.mockResolvedValue(true);
    issueTokenPair.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('returns the user and a token pair on valid credentials', async () => {
    const result = await build().execute({
      email: 'user@example.com',
      plainPassword: 'abcd1234',
    });

    expect(result.user.email.value).toBe('user@example.com');
    expect(result.tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(issueTokenPair).toHaveBeenCalledWith(result.user.id);
  });

  it('rejects an unknown email as invalid credentials', async () => {
    findByEmail.mockResolvedValue(null);

    await expect(
      build().execute({ email: 'unknown@example.com', plainPassword: 'abcd1234' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(issueTokenPair).not.toHaveBeenCalled();
  });

  it('rejects a wrong password as invalid credentials', async () => {
    verify.mockResolvedValue(false);

    await expect(
      build().execute({ email: 'user@example.com', plainPassword: 'wrong-pass' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(issueTokenPair).not.toHaveBeenCalled();
  });

  it('rejects a malformed email as invalid credentials, without leaking the reason', async () => {
    await expect(
      build().execute({ email: 'not-an-email', plainPassword: 'abcd1234' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(findByEmail).not.toHaveBeenCalled();
  });
});
