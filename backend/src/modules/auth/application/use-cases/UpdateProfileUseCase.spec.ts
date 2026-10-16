import { UpdateProfileUseCase } from './UpdateProfileUseCase';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { UserNotFoundError, UsernameAlreadyUsedError } from '../errors/AuthErrors';
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

describe('UpdateProfileUseCase', () => {
  const save = jest.fn<Promise<User>, [User]>();
  const findById = jest.fn();
  const findByEmail = jest.fn();
  const findByUsername = jest.fn();
  let existingUser: User;

  function build(): UpdateProfileUseCase {
    const userRepository: IUserRepository = { save, findById, findByEmail, findByUsername };
    return new UpdateProfileUseCase(userRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    existingUser = buildUser();
    findById.mockResolvedValue(existingUser);
    findByUsername.mockResolvedValue(null);
    save.mockImplementation((user: User) => Promise.resolve(user));
  });

  it('updates the username and saves the user', async () => {
    const profile = await build().execute({ userId: existingUser.id, username: 'newname' });

    expect(profile.username).toBe('newname');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ username: 'newname' }) as unknown);
  });

  it('never returns the password hash', async () => {
    const profile = await build().execute({ userId: existingUser.id, username: 'newname' });

    expect(profile).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(profile)).not.toContain('hashed-password');
  });

  it('refuses to touch a deactivated account, without saving anything', async () => {
    findById.mockResolvedValue(
      User.restore({
        email: Email.create('user@example.com'),
        passwordHash: 'hashed-password',
        username: 'trainer42',
        termsAcceptedAt: new Date(),
        termsVersion: '1',
        id: existingUser.id,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

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

  it('does not echo the user id in the error message', async () => {
    findById.mockResolvedValue(null);

    await expect(
      build().execute({ userId: 'secret-id-123', username: 'newname' }),
    ).rejects.not.toThrow(/secret-id-123/);
  });

  it('rejects a username already taken by someone else, case-insensitively', async () => {
    findByUsername.mockResolvedValue(
      User.register({
        email: Email.create('other@example.com'),
        passwordHash: 'other-hash',
        username: 'NewName',
        termsAcceptedAt: new Date(),
        termsVersion: '1',
      }),
    );

    await expect(build().execute({ userId: existingUser.id, username: 'newname' })).rejects.toThrow(
      UsernameAlreadyUsedError,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('lets a user change only the case of their own username', async () => {
    findByUsername.mockResolvedValue(existingUser);

    const profile = await build().execute({ userId: existingUser.id, username: 'TRAINER42' });

    expect(profile.username).toBe('TRAINER42');
    expect(save).toHaveBeenCalled();
  });

  it('propagates UsernameAlreadyUsedError thrown by save() (concurrent change race)', async () => {
    save.mockRejectedValue(new UsernameAlreadyUsedError());

    await expect(build().execute({ userId: existingUser.id, username: 'newname' })).rejects.toThrow(
      UsernameAlreadyUsedError,
    );
  });

  it('rejects an invalid username', async () => {
    await expect(build().execute({ userId: existingUser.id, username: 'ab' })).rejects.toThrow(
      /Username must be/,
    );
    expect(save).not.toHaveBeenCalled();
  });
});
