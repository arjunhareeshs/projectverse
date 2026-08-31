import { AsyncLocalStorage } from 'async_hooks';
import type { NextFunction, Request, Response } from 'express';

export interface UserContextStore {
  userId?: string;
  role?: string;
}

const userAsyncLocalStorage = new AsyncLocalStorage<UserContextStore>();

export function userContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  const store: UserContextStore = {};
  const user = (req as any).user;
  if (user?.id) {
    store.userId = user.id;
    store.role = user.role;
  }

  userAsyncLocalStorage.run(store, () => {
    next();
  });
}

export function getCurrentUserId(): string | undefined {
  return userAsyncLocalStorage.getStore()?.userId;
}

export function runWithUserContext<T>(userId: string, fn: () => T): T {
  return userAsyncLocalStorage.run({ userId }, fn);
}
