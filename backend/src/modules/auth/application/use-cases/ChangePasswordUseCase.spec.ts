import { ChangePasswordUseCase } from './ChangePasswordUseCase';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { IncorrectCurrentPasswordError, UserNotFoundError } from '../errors/AuthErrors';
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

describe('ChangePasswordUseCase', () => {
  const save = jest.fn<Promise<User>, [User]>();
  const findById = jest.fn();
  const findByEmail = jest.fn();
  const hash = jest.fn();
  const verify = jest.fn();
  let existingUser: User;

  function build(): ChangePasswordUseCase {
    const userRepository: IUserRepository = { save, findById, findByEmail };
    const passwordHasher: IPasswordHasher = { hash, verify };
    return new ChangePasswordUseCase(userRepository, passwordHasher);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    existingUser = buildUser();
    findById.mockResolvedValue(existingUser);
    verify.mockResolvedValue(true);
    hash.mockResolvedValue('new-hash');
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

  it('rejects when the user does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      build().execute({
        userId: 'missing-id',
        currentPassword: 'old-password1',
        newPassword: 'newpassword1',
      }),
    ).rejects.toThrow(UserNotFoundError);
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
  });
});
