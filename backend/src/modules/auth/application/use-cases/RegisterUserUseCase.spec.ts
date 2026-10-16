import { RegisterUserUseCase } from './RegisterUserUseCase';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import {
  ConsentRequiredError,
  EmailAlreadyUsedError,
  TermsVersionMismatchError,
  UsernameAlreadyUsedError,
} from '../errors/AuthErrors';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import type { IUserRepository } from '../ports/IUserRepository';

function buildExistingUser(): User {
  return User.register({
    email: Email.create('other@example.com'),
    passwordHash: 'existing-hash',
    username: 'taken',
    termsAcceptedAt: new Date(),
    termsVersion: '1',
  });
}

function buildInput() {
  return {
    email: 'user@example.com',
    plainPassword: 'abcd1234',
    username: 'trainer42',
    acceptedTermsVersion: CURRENT_TERMS_VERSION,
  };
}

const DEFAULT_PASSWORD_MIN_LENGTH = 8;
const CURRENT_TERMS_VERSION = '2026-01';
const HASHER_MAX_PASSWORD_BYTES = 72;

describe('RegisterUserUseCase', () => {
  const save = jest.fn<Promise<User>, [User]>();
  const findById = jest.fn();
  const findByEmail = jest.fn();
  const findByUsername = jest.fn();
  const hash = jest.fn();
  const verify = jest.fn();
  const getDummyHash = jest.fn();

  function build(
    passwordMinLength = DEFAULT_PASSWORD_MIN_LENGTH,
    maxPasswordBytes = HASHER_MAX_PASSWORD_BYTES,
    currentTermsVersion = CURRENT_TERMS_VERSION,
  ): RegisterUserUseCase {
    const userRepository: IUserRepository = { save, findById, findByEmail, findByUsername };
    const passwordHasher: IPasswordHasher = { maxPasswordBytes, hash, verify, getDummyHash };
    return new RegisterUserUseCase(
      userRepository,
      passwordHasher,
      passwordMinLength,
      currentTermsVersion,
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();
    findByEmail.mockResolvedValue(null);
    findByUsername.mockResolvedValue(null);
    hash.mockResolvedValue('hashed-password');
    save.mockImplementation((user: User) => Promise.resolve(user));
  });

  it('creates and saves a user when the email is free', async () => {
    const profile = await build().execute(buildInput());

    expect(profile.email).toBe('user@example.com');
    expect(profile.username).toBe('trainer42');
    expect(profile.isActive).toBe(true);
    expect(hash).toHaveBeenCalledWith('abcd1234');
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hashed-password' }) as unknown,
    );
  });

  it('never returns the password hash', async () => {
    const profile = await build().execute(buildInput());

    expect(profile).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(profile)).not.toContain('hashed-password');
  });

  it.each([null, '', '   '])(
    'rejects registration without an explicit acceptance (%p)',
    async (acceptedTermsVersion) => {
      await expect(build().execute({ ...buildInput(), acceptedTermsVersion })).rejects.toThrow(
        ConsentRequiredError,
      );
      expect(findByEmail).not.toHaveBeenCalled();
    },
  );

  it('rejects an outdated or unknown terms version, before any lookup', async () => {
    await expect(
      build().execute({ ...buildInput(), acceptedTermsVersion: '2025-06' }),
    ).rejects.toThrow(TermsVersionMismatchError);
    expect(findByEmail).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });

  it('records which version of the terms was accepted, and when', async () => {
    const profile = await build().execute(buildInput());

    expect(profile.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(profile.termsAcceptedAt).toBeInstanceOf(Date);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ termsVersion: CURRENT_TERMS_VERSION }) as unknown,
    );
  });

  it('accepts the current version sent with surrounding spaces, and stores it trimmed', async () => {
    const profile = await build().execute({
      ...buildInput(),
      acceptedTermsVersion: ` ${CURRENT_TERMS_VERSION} `,
    });

    expect(profile.termsVersion).toBe(CURRENT_TERMS_VERSION);
  });

  it('fails closed (not a 4xx) when the configured current version is blank', async () => {
    const attempt = build(8, 72, '  ').execute(buildInput());

    await expect(attempt).rejects.toThrow(/Invalid terms policy/);
    await expect(attempt).rejects.not.toThrow(ConsentRequiredError);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an already registered email', async () => {
    findByEmail.mockResolvedValue(
      User.register({
        email: Email.create('user@example.com'),
        passwordHash: 'existing-hash',
        username: 'other',
        termsAcceptedAt: new Date(),
        termsVersion: '1',
      }),
    );

    await expect(build().execute(buildInput())).rejects.toThrow(EmailAlreadyUsedError);
    expect(save).not.toHaveBeenCalled();
  });

  it('does not echo the email in the error message', async () => {
    findByEmail.mockResolvedValue(
      User.register({
        email: Email.create('user@example.com'),
        passwordHash: 'existing-hash',
        username: 'other',
        termsAcceptedAt: new Date(),
        termsVersion: '1',
      }),
    );

    await expect(build().execute(buildInput())).rejects.not.toThrow(/user@example\.com/);
  });

  it('rejects a username already taken, whatever its case, before paying for a hash', async () => {
    findByUsername.mockResolvedValue(
      User.register({
        email: Email.create('other@example.com'),
        passwordHash: 'existing-hash',
        username: 'Trainer42',
        termsAcceptedAt: new Date(),
        termsVersion: '1',
      }),
    );

    await expect(build().execute({ ...buildInput(), username: 'trainer42' })).rejects.toThrow(
      UsernameAlreadyUsedError,
    );
    expect(findByUsername).toHaveBeenCalledWith('trainer42');
    expect(hash).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('does not echo the username in the error message', async () => {
    findByUsername.mockResolvedValue(buildExistingUser());

    await expect(build().execute({ ...buildInput(), username: 'SecretName' })).rejects.not.toThrow(
      /SecretName/,
    );
  });

  it('propagates UsernameAlreadyUsedError thrown by save() (concurrent registration race)', async () => {
    save.mockRejectedValue(new UsernameAlreadyUsedError());

    await expect(build().execute(buildInput())).rejects.toThrow(UsernameAlreadyUsedError);
  });

  it('rejects an invalid username before the lookup and before paying for a hash', async () => {
    await expect(build().execute({ ...buildInput(), username: 'ab' })).rejects.toThrow(
      /Username must be/,
    );
    expect(findByEmail).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });

  it('rejects an invalid email before touching the repository', async () => {
    await expect(build().execute({ ...buildInput(), email: 'not-an-email' })).rejects.toThrow(
      /Invalid email address/,
    );
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it('rejects a password that fails the policy before touching the repository', async () => {
    await expect(build().execute({ ...buildInput(), plainPassword: 'short' })).rejects.toThrow(
      /at least 8 characters/,
    );
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it('enforces the injected PASSWORD_MIN_LENGTH rather than a hardcoded value', async () => {
    await expect(build(12).execute({ ...buildInput(), plainPassword: 'abcd1234' })).rejects.toThrow(
      /at least 12 characters/,
    );
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it('takes the maximum password size from the hasher, not from the domain', async () => {
    await expect(
      build(8, 10).execute({ ...buildInput(), plainPassword: 'abcd12345678' }),
    ).rejects.toThrow(/at most 10 bytes/);
    expect(hash).not.toHaveBeenCalled();
  });

  it('propagates EmailAlreadyUsedError thrown by save() (concurrent registration race)', async () => {
    // findByEmail() found nothing (no known duplicate at check time), but a
    // second registration for the same email committed first: the DB unique
    // constraint (IUserRepository.save() contract) is what actually catches
    // this, not the earlier findByEmail() check.
    save.mockRejectedValue(new EmailAlreadyUsedError());

    await expect(build().execute(buildInput())).rejects.toThrow(EmailAlreadyUsedError);
  });
});
