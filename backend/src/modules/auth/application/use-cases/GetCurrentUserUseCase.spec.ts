import { GetCurrentUserUseCase } from './GetCurrentUserUseCase';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { UserNotFoundError } from '../errors/AuthErrors';
import type { IUserRepository } from '../ports/IUserRepository';

function buildUser(): User {
  return User.register({
    email: Email.create('user@example.com'),
    passwordHash: 'hashed-password',
    username: 'trainer42',
    termsAcceptedAt: new Date(),
    termsVersion: '1',
  });
}

describe('GetCurrentUserUseCase', () => {
  const save = jest.fn<Promise<User>, [User]>();
  const findById = jest.fn();
  const findByEmail = jest.fn();
  const findByUsername = jest.fn();
  let existingUser: User;

  function build(): GetCurrentUserUseCase {
    const userRepository: IUserRepository = { save, findById, findByEmail, findByUsername };
    return new GetCurrentUserUseCase(userRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    existingUser = buildUser();
    findById.mockResolvedValue(existingUser);
  });

  it('returns the user found by id', async () => {
    const result = await build().execute({ userId: existingUser.id });

    expect(findById).toHaveBeenCalledWith(existingUser.id);
    expect(result).toMatchObject({ id: existingUser.id, email: 'user@example.com' });
  });

  it('never returns the password hash', async () => {
    const result = await build().execute({ userId: existingUser.id });

    expect(result).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(result)).not.toContain('hashed-password');
  });

  it('treats a deactivated account as not found', async () => {
    findById.mockResolvedValue(existingUser.deactivate());

    await expect(build().execute({ userId: existingUser.id })).rejects.toThrow(UserNotFoundError);
  });

  it('rejects when the user does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute({ userId: 'missing-id' })).rejects.toThrow(UserNotFoundError);
  });
});
