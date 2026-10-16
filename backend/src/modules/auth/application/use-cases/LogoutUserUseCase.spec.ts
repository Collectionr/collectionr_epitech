import { LogoutUserUseCase } from './LogoutUserUseCase';
import type { IAuthTokenService } from '../ports/IAuthTokenService';

describe('LogoutUserUseCase', () => {
  const issueTokenPair = jest.fn();
  const rotateRefreshToken = jest.fn();
  const revokeRefreshToken = jest.fn();
  const revokeAllRefreshTokens = jest.fn();

  function build(): LogoutUserUseCase {
    const authTokenService: IAuthTokenService = {
      issueTokenPair,
      rotateRefreshToken,
      revokeRefreshToken,
      revokeAllRefreshTokens,
    };
    return new LogoutUserUseCase(authTokenService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    revokeRefreshToken.mockResolvedValue(undefined);
  });

  it('revokes the refresh token', async () => {
    await build().execute({ refreshToken: 'refresh-token' });

    expect(revokeRefreshToken).toHaveBeenCalledWith('refresh-token');
  });
});
