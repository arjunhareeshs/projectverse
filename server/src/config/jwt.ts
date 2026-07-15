import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { env } from './env';

import { RoleType } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  role: RoleType;
  orgId?: string;
};

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET as Secret, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET as Secret, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET as Secret) as JwtPayload;
}
