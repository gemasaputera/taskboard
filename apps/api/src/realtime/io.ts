import { SESSION_COOKIE, type RealtimeEvent, type RealtimePayload } from '@kanban/shared';
import { parse as parseCookie } from 'cookie';
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { verifySession } from '../auth/jwt';
import { prisma } from '../db';
import { corsOrigin } from '../lib/origins';

let io: Server | null = null;

export function initRealtime(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
      const token = cookies[SESSION_COOKIE];
      const userId = typeof token === 'string' ? await verifySession(token) : null;

      if (!userId) {
        next(new Error('unauthorized'));
        return;
      }

      const memberships = await prisma.membership.findMany({
        where: { userId },
        select: { workplaceId: true },
      });

      if (memberships.length === 0) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (!user) {
          next(new Error('unauthorized'));
          return;
        }
      }

      socket.data.userId = userId;
      socket.data.workplaceIds = memberships.map((membership) => membership.workplaceId);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    for (const workplaceId of socket.data.workplaceIds as string[]) {
      socket.join(`workplace:${workplaceId}`);
    }
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

export function emitToWorkplace(
  workplaceId: string,
  event: RealtimeEvent,
  payload: RealtimePayload = {},
): void {
  io?.to(`workplace:${workplaceId}`).emit(event, { workplaceId, ...payload });
}

export function emitToUser(
  userId: string,
  event: RealtimeEvent,
  payload: RealtimePayload = {},
): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

export async function joinUserToWorkplace(userId: string, workplaceId: string): Promise<void> {
  if (!io) return;
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  for (const socket of sockets) {
    socket.join(`workplace:${workplaceId}`);
    socket.data.workplaceIds = [
      ...new Set([...(socket.data.workplaceIds as string[]), workplaceId]),
    ];
  }
}

export function leaveUserFromWorkplace(userId: string, workplaceId: string): void {
  io?.in(`user:${userId}`).socketsLeave(`workplace:${workplaceId}`);
}
