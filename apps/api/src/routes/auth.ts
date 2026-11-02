import { loginSchema, registerSchema } from '@kanban/shared';
import { Router } from 'express';
import { signSession } from '../auth/jwt';
import { hashPassword, verifyPassword } from '../auth/password';
import {
  clearSessionCookie,
  currentUser,
  requireAuth,
  setSessionCookie,
} from '../auth/session';
import { prisma } from '../db';
import { AppError } from '../errors';
import { parseBody } from '../lib/validate';
import { createWorkplaceWithDefaults, getMePayload } from '../services/workplaces';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { username, email, password } = parseBody(registerSchema, req.body);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { username: true, email: true },
  });

  if (existing) {
    if (existing.username === username) {
      throw new AppError(409, 'CONFLICT', 'That username is already taken.');
    }
    throw new AppError(409, 'CONFLICT', 'That email is already registered.');
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { username, email, passwordHash },
    });

    await createWorkplaceWithDefaults(tx, created.id, `${username}'s Workplace`);

    return created;
  });

  const token = await signSession(user.id);
  setSessionCookie(res, token);

  res.status(201).json(
    await getMePayload({ id: user.id, username: user.username, email: user.email }),
  );
});

authRouter.post('/login', async (req, res) => {
  const { identifier, password } = parseBody(loginSchema, req.body);
  const normalized = identifier.toLowerCase();

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: normalized }, { email: normalized }] },
  });

  const valid = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username, email, or password.');
  }

  const token = await signSession(user.id);
  setSessionCookie(res, token);

  res.json(await getMePayload({ id: user.id, username: user.username, email: user.email }));
});

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await getMePayload(currentUser(req)));
});
