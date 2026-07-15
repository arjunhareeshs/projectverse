import { signAccessToken, signRefreshToken, type JwtPayload } from '../../config/jwt';

export function createTokenPair(payload: JwtPayload) {
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}
