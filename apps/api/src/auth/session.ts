import { SESSION_COOKIE, SESSION_DAYS } from '@kanban/shared';
import type { Request, RequestHandler, Response } from 'express';
import { prisma } from '../db';
import { env } from '../env';
import { AppError } from '../errors';
import { configuredOrigins } from '../lib/origins';
import { verifySession } from './jwt';
import type { AuthUser } from './types';

function useSecureCookies(): boolean {
  if (env.NODE_ENV !== 'production') return false;

  const origins = configuredOrigins();
  return origins.length > 0 && origins.every((origin) => origin.startsWith('https://'));
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookies(),
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookies(),
    path: '/',
  });
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || !token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in.');
  }

  const userId = await verifySession(token);
  if (!userId) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Your session has expired. Please sign in again.');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in.');
  }

  req.user = user;
  next();
};

export function currentUser(req: Request): AuthUser {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in.');
  }
  return req.user;
}
