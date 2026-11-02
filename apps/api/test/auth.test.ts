import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, registerUser, resetDb } from './helpers';

beforeEach(resetDb);

describe('auth', () => {
  it('registers a user with their default workplace and four columns', async () => {
    const agent = request.agent(app);

    const response = await agent.post('/api/auth/register').send({
      username: 'gemasaputera',
      email: 'gema@example.com',
      password: 'password123',
    });

    expect(response.status).toBe(201);
    expect(response.body.user.username).toBe('gemasaputera');
    expect(response.body.workplaces).toHaveLength(1);
    expect(response.body.workplaces[0].name).toBe("gemasaputera's Workplace");
    expect(response.body.workplaces[0].role).toBe('OWNER');

    const board = await agent.get(
      `/api/workplaces/${response.body.workplaces[0].id as string}/board`,
    );

    expect(board.status).toBe(200);
    expect(board.body.columns.map((column: { name: string }) => column.name)).toEqual([
      'To Do',
      'Revision',
      'On Progress',
      'Done',
    ]);
    expect(board.body.columns.map((column: { position: number }) => column.position)).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it('rejects duplicate usernames and emails', async () => {
    const first = request.agent(app);
    await first.post('/api/auth/register').send({
      username: 'dupe',
      email: 'dupe@example.com',
      password: 'password123',
    });

    const duplicateUsername = await request(app).post('/api/auth/register').send({
      username: 'dupe',
      email: 'other@example.com',
      password: 'password123',
    });
    expect(duplicateUsername.status).toBe(409);

    const duplicateEmail = await request(app).post('/api/auth/register').send({
      username: 'other',
      email: 'dupe@example.com',
      password: 'password123',
    });
    expect(duplicateEmail.status).toBe(409);
  });

  it('logs in by username or email and logs out', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({
      username: 'loginuser',
      email: 'login@example.com',
      password: 'password123',
    });
    await agent.post('/api/auth/logout');

    const byUsername = await agent.post('/api/auth/login').send({
      identifier: 'loginuser',
      password: 'password123',
    });
    expect(byUsername.status).toBe(200);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe('loginuser');

    await agent.post('/api/auth/logout');
    const afterLogout = await agent.get('/api/auth/me');
    expect(afterLogout.status).toBe(401);

    const byEmail = await request(app).post('/api/auth/login').send({
      identifier: 'login@example.com',
      password: 'password123',
    });
    expect(byEmail.status).toBe(200);

    const wrongPassword = await request(app).post('/api/auth/login').send({
      identifier: 'login@example.com',
      password: 'nope',
    });
    expect(wrongPassword.status).toBe(401);
  });

  it('validates input and protects private routes', async () => {
    const invalid = await request(app).post('/api/auth/register').send({
      username: 'A',
      email: 'not-an-email',
      password: 'short',
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalid.body.error.fields.username).toBeTruthy();

    const anonymousBoard = await request(app).get('/api/workplaces/anything/board');
    expect(anonymousBoard.status).toBe(401);
  });

  it('accepts loopback origins even when CLIENT_ORIGIN points at another host', async () => {
    const rejected = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://evil.example')
      .send({
        username: 'evilorigin',
        email: 'evilorigin@example.com',
        password: 'password123',
      });

    expect(rejected.status).toBe(403);
    expect(rejected.body.error.code).toBe('BAD_ORIGIN');

    const accepted = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({
        username: 'localhostorigin',
        email: 'localhostorigin@example.com',
        password: 'password123',
      });

    expect(accepted.status).toBe(201);
    expect(accepted.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('creates a second workplace with the default columns', async () => {
    const { agent, workplaceId } = await registerUser('second');

    const created = await agent.post('/api/workplaces').send({ name: 'Client work' });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Client work');

    const board = await agent.get(`/api/workplaces/${created.body.id as string}/board`);
    expect(board.body.role).toBe('OWNER');
    expect(board.body.columns).toHaveLength(4);

    const mine = await agent.get('/api/auth/me');
    expect(mine.body.workplaces).toHaveLength(2);
    expect(mine.body.workplaces.map((workplace: { id: string }) => workplace.id)).toContain(
      workplaceId,
    );
  });
});
