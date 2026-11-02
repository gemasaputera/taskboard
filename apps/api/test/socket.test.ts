import http from 'node:http';
import type { Server } from 'socket.io';
import { io as createClient, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { initRealtime } from '../src/realtime/io';
import {
  addMember,
  columnByName,
  createCard,
  getBoard,
  registerUser,
  resetDb,
} from './helpers';

let server: http.Server;
let realtime: Server;
let baseUrl = '';

function connect(cookie: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createClient(baseUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      extraHeaders: cookie ? { Cookie: cookie } : {},
    });

    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('socket connect timeout'));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
  });
}

beforeAll(async () => {
  await resetDb();
  server = http.createServer(createApp());
  realtime = initRealtime(server);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    realtime.close(() => resolve());
  });
  server.closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('realtime', () => {
  it('broadcasts card events to sockets in the same workplace', async () => {
    const owner = await registerUser('socketowner');
    const member = await registerUser('socketmember');
    await addMember(owner, member);

    const board = (await getBoard(owner.agent, owner.workplaceId)).body;
    const todo = columnByName(board, 'To Do');

    const socket = await connect(owner.cookie);

    const received = new Promise<{ cardId: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('event timeout')), 5000);
      socket.once('card.created', (payload: { cardId: string }) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

    const card = await createCard(member.agent, owner.workplaceId, todo.id, 'Realtime card');
    const payload = await received;

    expect(payload.cardId).toBe(card.id);
    socket.close();
  });

  it('rejects unauthenticated socket connections', async () => {
    await expect(connect('')).rejects.toBeTruthy();
  });
});
