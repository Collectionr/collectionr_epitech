import { LoginUserUseCase } from './LoginUserUseCase';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { InvalidCredentialsError } from '../errors/AuthErrors';
import type { IAuthTokenService } from '../ports/IAuthTokenService';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import type { IUserRepository } from '../ports/IUserRepository';

const DUMMY_HASH = 'dummy-hash-supplied-by-the-hasher';

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
  const getDummyHash = jest.fn();
  const issueTokenPair = jest.fn();
  const rotateRefreshToken = jest.fn();
  const revokeRefreshToken = jest.fn();
  const revokeAllRefreshTokens = jest.fn();

  function build(): LoginUserUseCase {
    const userRepository: IUserRepository = { save, findById, findByEmail };
    const passwordHasher: IPasswordHasher = { maxPasswordBytes: 72, hash, verify, getDummyHash };
    const authTokenService: IAuthTokenService = {
      issueTokenPair,
      rotateRefreshToken,
      revokeRefreshToken,
      revokeAllRefreshTokens,
    };
    return new LoginUserUseCase(userRepository, passwordHasher, authTokenService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    findByEmail.mockResolvedValue(buildUser());
    verify.mockResolvedValue(true);
    getDummyHash.mockReturnValue(DUMMY_HASH);
    issueTokenPair.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('returns the profile and a token pair on valid credentials', async () => {
    const result = await build().execute({
      email: 'user@example.com',
      plainPassword: 'abcd1234',
    });

    expect(result.user.email).toBe('user@example.com');
    expect(result.tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(issueTokenPair).toHaveBeenCalledWith(result.user.id);
  });

  it('never returns the password hash', async () => {
    const result = await build().execute({
      email: 'user@example.com',
      plainPassword: 'abcd1234',
    });

    expect(result.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(result)).not.toContain('hashed-password');
  });

  it('rejects an unknown email as invalid credentials', async () => {
    findByEmail.mockResolvedValue(null);

    await expect(
      build().execute({ email: 'unknown@example.com', plainPassword: 'abcd1234' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(issueTokenPair).not.toHaveBeenCalled();
  });

  it('compares against the hasher-supplied dummy hash for an unknown email (timing side channel)', async () => {
    findByEmail.mockResolvedValue(null);

    await expect(
      build().execute({ email: 'unknown@example.com', plainPassword: 'abcd1234' }),
    ).rejects.toThrow(InvalidCredentialsError);

    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith('abcd1234', DUMMY_HASH);
  });

  it('asks the hasher for a dummy hash only when the account does not exist', async () => {
    await build().execute({ email: 'user@example.com', plainPassword: 'abcd1234' });

    expect(verify).toHaveBeenCalledWith('abcd1234', 'hashed-password');
    expect(getDummyHash).not.toHaveBeenCalled();
  });

  it('rejects a deactivated account with the same generic error, even with the right password', async () => {
    findByEmail.mockResolvedValue(
      User.restore({
        email: Email.create('user@example.com'),
        passwordHash: 'hashed-password',
        username: 'trainer42',
        consentGivenAt: new Date(),
        id: 'fixed-id',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await expect(
      build().execute({ email: 'user@example.com', plainPassword: 'abcd1234' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(verify).toHaveBeenCalledTimes(1);
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
    expect(verify).not.toHaveBeenCalled();
  });
});
