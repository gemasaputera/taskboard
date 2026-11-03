import { Prisma } from '@prisma/client';
import {
  availabilityQuerySchema,
  loginSchema,
  registerSchema,
  type AvailabilityResponse,
} from '@kanban/shared';
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
import { parseBody, parseQuery } from '../lib/validate';
import { createWorkplaceWithDefaults, getMePayload } from '../services/workplaces';

export const authRouter = Router();

const USERNAME_TAKEN = 'That username is already taken.';
const EMAIL_TAKEN = 'That email is already registered.';

/**
 * Turn a Prisma unique-constraint target into per-field messages so the client
 * can attach the conflict to the right input. The pre-check below is the normal
 * path; this catches two requests that race past it.
 */
function conflictFieldsFromTarget(target: unknown): Record<string, string[]> | undefined {
  const targets = Array.isArray(target)
    ? target.map((entry) => String(entry))
    : typeof target === 'string'
      ? [target]
      : [];

  const fields: Record<string, string[]> = {};
  if (targets.some((entry) => entry === 'username' || entry.endsWith('_username_key'))) {
    fields.username = [USERNAME_TAKEN];
  }
  if (targets.some((entry) => entry === 'email' || entry.endsWith('_email_key'))) {
    fields.email = [EMAIL_TAKEN];
  }

  return Object.keys(fields).length > 0 ? fields : undefined;
}

authRouter.get('/availability', async (req, res) => {
  const query = parseQuery(availabilityQuerySchema, req.query);

  const [usernameOwner, emailOwner] = await Promise.all([
    query.username
      ? prisma.user.findUnique({ where: { username: query.username }, select: { id: true } })
      : null,
    query.email
      ? prisma.user.findUnique({ where: { email: query.email }, select: { id: true } })
      : null,
  ]);

  // Availability changes constantly and is only meaningful to the signed-up
  // user, so never let a browser or proxy cache the answer.
  res.setHeader('Cache-Control', 'no-store');

  const payload: AvailabilityResponse = {};
  if (query.username) {
    payload.username = {
      available: !usernameOwner,
      message: usernameOwner ? USERNAME_TAKEN : null,
    };
  }
  if (query.email) {
    payload.email = {
      available: !emailOwner,
      message: emailOwner ? EMAIL_TAKEN : null,
    };
  }

  res.json(payload);
});

authRouter.post('/register', async (req, res) => {
  const { username, email, password } = parseBody(registerSchema, req.body);

  const [usernameOwner, emailOwner] = await Promise.all([
    prisma.user.findUnique({ where: { username }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
  ]);

  const conflicts: Record<string, string[]> = {};
  if (usernameOwner) conflicts.username = [USERNAME_TAKEN];
  if (emailOwner) conflicts.email = [EMAIL_TAKEN];

  if (Object.keys(conflicts).length > 0) {
    const message =
      conflicts.username && conflicts.email
        ? 'That username and email are already in use.'
        : (conflicts.username?.[0] ?? conflicts.email?.[0] ?? 'That value is already in use.');

    throw new AppError(409, 'CONFLICT', message, conflicts);
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { username, email, passwordHash },
      });

      await createWorkplaceWithDefaults(tx, created.id, `${username}'s Workplace`);

      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const fields = conflictFieldsFromTarget(error.meta?.target);
      throw new AppError(
        409,
        'CONFLICT',
        fields ? 'Some of those details are already in use.' : 'That value is already in use.',
        fields,
      );
    }
    throw error;
  }

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
