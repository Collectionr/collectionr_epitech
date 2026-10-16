import { DeactivateUserUseCase } from './DeactivateUserUseCase';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { UserNotFoundError } from '../errors/AuthErrors';
import type { IAuthTokenService } from '../ports/IAuthTokenService';
import type { IUserRepository } from '../ports/IUserRepository';

function buildUser(isActive = true): User {
  return User.restore({
    email: Email.create('user@example.com'),
    passwordHash: 'hashed-password',
    username: 'trainer42',
    termsAcceptedAt: new Date(),
    termsVersion: '1',
    id: 'fixed-id',
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('DeactivateUserUseCase', () => {
  const save = jest.fn<Promise<User>, [User]>();
  const findById = jest.fn();
  const findByEmail = jest.fn();
  const findByUsername = jest.fn();
  const issueTokenPair = jest.fn();
  const rotateRefreshToken = jest.fn();
  const revokeRefreshToken = jest.fn();
  const revokeAllRefreshTokens = jest.fn();

  function build(): DeactivateUserUseCase {
    const userRepository: IUserRepository = { save, findById, findByEmail, findByUsername };
    const authTokenService: IAuthTokenService = {
      issueTokenPair,
      rotateRefreshToken,
      revokeRefreshToken,
      revokeAllRefreshTokens,
    };
    return new DeactivateUserUseCase(userRepository, authTokenService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    findById.mockResolvedValue(buildUser());
    save.mockImplementation((user: User) => Promise.resolve(user));
    revokeAllRefreshTokens.mockResolvedValue(undefined);
  });

  it('deactivates the account and returns its profile', async () => {
    const profile = await build().execute({ userId: 'fixed-id' });

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }) as unknown);
    expect(profile.isActive).toBe(false);
  });

  it('revokes every session of the account, so a deactivation ends refresh tokens too', async () => {
    await build().execute({ userId: 'fixed-id' });

    expect(revokeAllRefreshTokens).toHaveBeenCalledWith('fixed-id');
  });

  it('deactivates BEFORE revoking: no new session can be opened in between', async () => {
    await build().execute({ userId: 'fixed-id' });

    const saveOrder = save.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;
    const revokeOrder = revokeAllRefreshTokens.mock.invocationCallOrder[0] ?? 0;
    expect(saveOrder).toBeLessThan(revokeOrder);
  });

  it('keeps the account blocked when the revocation fails, so the call can simply be repeated', async () => {
    revokeAllRefreshTokens.mockRejectedValue(new Error('session store down'));

    await expect(build().execute({ userId: 'fixed-id' })).rejects.toThrow('session store down');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }) as unknown);
  });

  it('is idempotent: an already deactivated account is not saved again but its sessions are revoked', async () => {
    findById.mockResolvedValue(buildUser(false));

    const profile = await build().execute({ userId: 'fixed-id' });

    expect(save).not.toHaveBeenCalled();
    expect(revokeAllRefreshTokens).toHaveBeenCalledWith('fixed-id');
    expect(profile.isActive).toBe(false);
  });

  it('rejects an unknown account without revoking anything', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute({ userId: 'missing-id' })).rejects.toThrow(UserNotFoundError);
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled();
  });

  it('never returns the password hash', async () => {
    const profile = await build().execute({ userId: 'fixed-id' });

    expect(profile).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(profile)).not.toContain('hashed-password');
  });
});
