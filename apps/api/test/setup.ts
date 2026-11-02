import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://kanban:kanban@localhost:5433/kanban_test?schema=public';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'test-secret-test-secret-test-secret-1234';
// Simulate a host whose CLIENT_ORIGIN does not match the Vite dev origin.
process.env.CLIENT_ORIGIN = 'http://localhost:4000';
