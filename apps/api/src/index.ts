import http from 'node:http';
import { createApp } from './app';
import { prisma } from './db';
import { env } from './env';
import { initRealtime } from './realtime/io';

const app = createApp();
const server = http.createServer(app);

initRealtime(server);

server.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`[api] ${signal} received, shutting down`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
