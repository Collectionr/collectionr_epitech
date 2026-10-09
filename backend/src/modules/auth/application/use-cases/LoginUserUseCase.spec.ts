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
  const revokeAllRefreshTokens = jest.fn();

  function build(): LoginUserUseCase {
    const userRepository: IUserRepository = { save, findById, findByEmail };
    const passwordHasher: IPasswordHasher = { hash, verify };
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

  it('still runs a hash comparison for an unknown email (timing side channel)', async () => {
    findByEmail.mockResolvedValue(null);

    await expect(
      build().execute({ email: 'unknown@example.com', plainPassword: 'abcd1234' }),
    ).rejects.toThrow(InvalidCredentialsError);

    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith(
      'abcd1234',
      '$2b$12$7irbQ5LXMyoaQFmTLtzC1eySZGqAcpYWel1GwQEWJsTOh/ZWRtL7e',
    );
  });

  it('uses a syntactically valid bcrypt hash as the dummy (format bcryptjs/bcrypt will accept)', async () => {
    findByEmail.mockResolvedValue(null);

    await expect(
      build().execute({ email: 'unknown@example.com', plainPassword: 'abcd1234' }),
    ).rejects.toThrow(InvalidCredentialsError);

    const [, dummyHash] = verify.mock.calls[0] as [string, string];
    // $2<a|b|y>$<cost>$<22-char salt><31-char hash>, 60 chars total (RFC-less
    // but universally implemented bcrypt format). Not proof a real bcrypt
    // lib accepts it (never exercised against one in this test suite — every
    // IPasswordHasher here is mocked), but rules out a malformed placeholder.
    expect(dummyHash).toMatch(/^\$2[aby]\$\d{2}\$[A-Za-z0-9./]{53}$/);
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
