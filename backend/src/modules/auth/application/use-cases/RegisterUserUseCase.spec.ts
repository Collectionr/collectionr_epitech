import { RegisterUserUseCase } from './RegisterUserUseCase';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { ConsentRequiredError, EmailAlreadyUsedError } from '../errors/AuthErrors';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import type { IUserRepository } from '../ports/IUserRepository';

function buildInput() {
  return {
    email: 'user@example.com',
    plainPassword: 'abcd1234',
    username: 'trainer42',
    hasAcceptedTerms: true,
  };
}

describe('RegisterUserUseCase', () => {
  const save = jest.fn<Promise<User>, [User]>();
  const findById = jest.fn();
  const findByEmail = jest.fn();
  const hash = jest.fn();
  const verify = jest.fn();

  function build(): RegisterUserUseCase {
    const userRepository: IUserRepository = { save, findById, findByEmail };
    const passwordHasher: IPasswordHasher = { hash, verify };
    return new RegisterUserUseCase(userRepository, passwordHasher);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    findByEmail.mockResolvedValue(null);
    hash.mockResolvedValue('hashed-password');
    save.mockImplementation((user: User) => Promise.resolve(user));
  });

  it('creates and saves a user when the email is free', async () => {
    const user = await build().execute(buildInput());

    expect(user.email.value).toBe('user@example.com');
    expect(user.username).toBe('trainer42');
    expect(user.passwordHash).toBe('hashed-password');
    expect(hash).toHaveBeenCalledWith('abcd1234');
    expect(save).toHaveBeenCalledWith(user);
  });

  it('rejects registration without explicit consent', async () => {
    await expect(build().execute({ ...buildInput(), hasAcceptedTerms: false })).rejects.toThrow(
      ConsentRequiredError,
    );
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it('rejects an already registered email', async () => {
    findByEmail.mockResolvedValue(
      User.register({
        email: Email.create('user@example.com'),
        passwordHash: 'existing-hash',
        username: 'other',
        consentGivenAt: new Date(),
      }),
    );

    await expect(build().execute(buildInput())).rejects.toThrow(EmailAlreadyUsedError);
    expect(save).not.toHaveBeenCalled();
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
});
