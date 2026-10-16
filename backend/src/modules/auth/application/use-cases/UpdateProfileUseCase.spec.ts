import { UpdateProfileUseCase } from './UpdateProfileUseCase';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { UserNotFoundError } from '../errors/AuthErrors';
import type { IUserRepository } from '../ports/IUserRepository';

function buildUser(): User {
  return User.register({
    email: Email.create('user@example.com'),
    passwordHash: 'hashed-password',
    username: 'trainer42',
    consentGivenAt: new Date(),
  });
}

describe('UpdateProfileUseCase', () => {
  const save = jest.fn<Promise<User>, [User]>();
  const findById = jest.fn();
  const findByEmail = jest.fn();
  let existingUser: User;

  function build(): UpdateProfileUseCase {
    const userRepository: IUserRepository = { save, findById, findByEmail };
    return new UpdateProfileUseCase(userRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    existingUser = buildUser();
    findById.mockResolvedValue(existingUser);
    save.mockImplementation((user: User) => Promise.resolve(user));
  });

  it('updates the username and saves the user', async () => {
    const profile = await build().execute({ userId: existingUser.id, username: 'newname' });

    expect(profile.username).toBe('newname');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ username: 'newname' }));
  });

  it('never returns the password hash', async () => {
    const profile = await build().execute({ userId: existingUser.id, username: 'newname' });

    expect(profile).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(profile)).not.toContain('hashed-password');
  });

  it('refuses to touch a deactivated account, without saving anything', async () => {
    findById.mockResolvedValue(existingUser.deactivate());

    await expect(build().execute({ userId: existingUser.id, username: 'newname' })).rejects.toThrow(
      UserNotFoundError,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects when the user does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute({ userId: 'missing-id', username: 'newname' })).rejects.toThrow(
      UserNotFoundError,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an invalid username', async () => {
    await expect(build().execute({ userId: existingUser.id, username: 'ab' })).rejects.toThrow(
      /Username must be/,
    );
    expect(save).not.toHaveBeenCalled();
  });
});
