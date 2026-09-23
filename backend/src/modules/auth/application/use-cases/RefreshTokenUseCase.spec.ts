import { RefreshTokenUseCase } from './RefreshTokenUseCase';
import { InvalidRefreshTokenError } from '../errors/AuthErrors';
import type { IAuthTokenService } from '../ports/IAuthTokenService';

describe('RefreshTokenUseCase', () => {
  const issueTokenPair = jest.fn();
  const rotateRefreshToken = jest.fn();
  const revokeRefreshToken = jest.fn();

  function build(): RefreshTokenUseCase {
    const authTokenService: IAuthTokenService = {
      issueTokenPair,
      rotateRefreshToken,
      revokeRefreshToken,
    };
    return new RefreshTokenUseCase(authTokenService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rotates the refresh token and returns the new pair', async () => {
    rotateRefreshToken.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });

    const result = await build().execute({ refreshToken: 'old-refresh-token' });

    expect(rotateRefreshToken).toHaveBeenCalledWith('old-refresh-token');
    expect(result).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
  });

  it('propagates the port rejection for an invalid refresh token', async () => {
    rotateRefreshToken.mockRejectedValue(new InvalidRefreshTokenError());

    await expect(build().execute({ refreshToken: 'stale-token' })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });
});
