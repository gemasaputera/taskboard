// The MCP tests boot the real Express app against the same disposable database the
// API integration suite uses. `pnpm test:db:up` creates it.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://kanban:kanban@localhost:5433/kanban_test?schema=public';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-test-secret-test-secret-1234';
process.env.CLIENT_ORIGIN = 'http://localhost:4000';
