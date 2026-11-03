import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env';
import { errorHandler, notFoundHandler } from './errors';
import { corsOrigin, isAllowedOrigin } from './lib/origins';
import { authRouter } from './routes/auth';
import { cardsRouter } from './routes/cards';
import { columnsRouter } from './routes/columns';
import { commentsRouter } from './routes/comments';
import { invitationsRouter } from './routes/invitations';
import { mcpRouter } from './routes/mcp';
import { oauthRouter } from './routes/oauth';
import { subtasksRouter } from './routes/subtasks';
import { tagsRouter } from './routes/tags';
import { workplacesRouter } from './routes/workplaces';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// OAuth clients (including Hermes Agent) may stamp their local callback origin on
// these requests. They authenticate with OAuth tokens rather than the session
// cookie, so a foreign Origin cannot perform a CSRF-style action.
const COOKIELESS_MUTATIONS = new Set(['/oauth/register', '/oauth/token', '/mcp']);

// The consent POST is bound to the user and the exact request by a signed,
// short-lived consent token. Embedded/sandboxed OAuth browsers may send
// `Origin: null`, so the token replaces the Origin check on this one route.
const CSRF_TOKEN_MUTATIONS = new Set(['/oauth/authorize']);

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    if (COOKIELESS_MUTATIONS.has(req.path) || CSRF_TOKEN_MUTATIONS.has(req.path)) {
      next();
      return;
    }

    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      res.status(403).json({
        error: {
          code: 'BAD_ORIGIN',
          message: 'This origin is not allowed to make changes.',
        },
      });
      return;
    }

    next();
  });

  const authLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Live sign-up checks have their own budget below; counting them here would
    // make a user hit the login/register limit before they finish the form.
    skip: (req) => req.path === '/availability',
  });

  const availabilityLimiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many availability checks. Try again in a minute.',
      },
    },
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  const oauthLimiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  app.use('/oauth', oauthLimiter);
  app.use(oauthRouter);
  app.use(mcpRouter);

  app.use('/api/auth/availability', availabilityLimiter);
  app.use('/api/auth', authLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api', workplacesRouter);
  app.use('/api', invitationsRouter);
  app.use('/api', columnsRouter);
  app.use('/api', cardsRouter);
  app.use('/api', subtasksRouter);
  app.use('/api', commentsRouter);
  app.use('/api', tagsRouter);

  if (env.NODE_ENV === 'production') {
    const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
    if (existsSync(webDist)) {
      app.use(express.static(webDist));
      app.use((req, res, next) => {
        if (
          req.method === 'GET' &&
          !req.path.startsWith('/api') &&
          !req.path.startsWith('/socket.io')
        ) {
          res.sendFile(path.join(webDist, 'index.html'));
          return;
        }
        next();
      });
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
