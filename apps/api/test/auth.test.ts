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
      password: 'Kanban!Passw0rd',
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

  it('rejects duplicate usernames and emails with field-specific errors', async () => {
    const first = request.agent(app);
    await first.post('/api/auth/register').send({
      username: 'dupe',
      email: 'dupe@example.com',
      password: 'Kanban!Passw0rd',
    });

    const duplicateUsername = await request(app).post('/api/auth/register').send({
      username: 'dupe',
      email: 'other@example.com',
      password: 'Kanban!Passw0rd',
    });
    expect(duplicateUsername.status).toBe(409);
    expect(duplicateUsername.body.error.fields.username).toEqual([
      'That username is already taken.',
    ]);

    const duplicateEmail = await request(app).post('/api/auth/register').send({
      username: 'other',
      email: 'dupe@example.com',
      password: 'Kanban!Passw0rd',
    });
    expect(duplicateEmail.status).toBe(409);
    expect(duplicateEmail.body.error.fields.email).toEqual(['That email is already registered.']);

    const duplicateMixedCase = await request(app).post('/api/auth/register').send({
      username: 'DUPE',
      email: 'DUPE@Example.com',
      password: 'Kanban!Passw0rd',
    });
    expect(duplicateMixedCase.status).toBe(409);
    expect(duplicateMixedCase.body.error.fields.username).toBeTruthy();
    expect(duplicateMixedCase.body.error.fields.email).toBeTruthy();
  });

  it('reports username and email availability without caching the answer', async () => {
    await request(app).post('/api/auth/register').send({
      username: 'takenuser',
      email: 'taken@example.com',
      password: 'Kanban!Passw0rd',
    });

    const free = await request(app)
      .get('/api/auth/availability')
      .query({ username: 'freename', email: 'free@example.com' });

    expect(free.status).toBe(200);
    expect(free.headers['cache-control']).toBe('no-store');
    expect(free.body.username).toEqual({ available: true, message: null });
    expect(free.body.email).toEqual({ available: true, message: null });

    const taken = await request(app)
      .get('/api/auth/availability')
      .query({ username: 'TAKENUSER', email: 'TAKEN@example.com' });

    expect(taken.status).toBe(200);
    expect(taken.body.username.available).toBe(false);
    expect(taken.body.username.message).toBe('That username is already taken.');
    expect(taken.body.email.available).toBe(false);
    expect(taken.body.email.message).toBe('That email is already registered.');
  });

  it('rejects malformed or empty availability checks', async () => {
    const hasSpace = await request(app)
      .get('/api/auth/availability')
      .query({ username: 'space user' });

    expect(hasSpace.status).toBe(400);
    expect(hasSpace.body.error.code).toBe('VALIDATION_ERROR');
    expect(hasSpace.body.error.fields.username).toContain('Usernames cannot contain spaces.');

    const empty = await request(app).get('/api/auth/availability');
    expect(empty.status).toBe(400);
    expect(empty.body.error.fields.username).toBeTruthy();
  });

  it('normalizes sign-up input and rejects internal spaces in usernames', async () => {
    const padded = await request(app).post('/api/auth/register').send({
      username: '  SpaceUser  ',
      email: '  Space@Example.com  ',
      password: 'Kanban!Passw0rd',
    });

    expect(padded.status).toBe(201);
    expect(padded.body.user.username).toBe('spaceuser');
    expect(padded.body.user.email).toBe('space@example.com');

    const internalSpace = await request(app).post('/api/auth/register').send({
      username: 'space user',
      email: 'internal@example.com',
      password: 'Kanban!Passw0rd',
    });

    expect(internalSpace.status).toBe(400);
    expect(internalSpace.body.error.fields.username).toEqual(['Usernames cannot contain spaces.']);
  });

  it('rejects weak, common, reserved, and identity-based sign-up details', async () => {
    const weak = await request(app).post('/api/auth/register').send({
      username: 'weakuser',
      email: 'weak@example.com',
      password: 'password123',
    });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.password?.[0]).toMatch(/Password needs/);

    const common = await request(app).post('/api/auth/register').send({
      username: 'commonuser',
      email: 'common@example.com',
      password: 'Password123!',
    });
    expect(common.status).toBe(400);
    expect(common.body.error.fields.password?.[0]).toMatch(/too common/i);

    const personal = await request(app).post('/api/auth/register').send({
      username: 'personaluser',
      email: 'personal@example.com',
      password: 'Personaluser!1',
    });
    expect(personal.status).toBe(400);
    expect(personal.body.error.fields.password?.[0]).toMatch(/must not contain/i);

    const reserved = await request(app).post('/api/auth/register').send({
      username: 'Admin',
      email: 'admin@example.com',
      password: 'Kanban!Passw0rd',
    });
    expect(reserved.status).toBe(400);
    expect(reserved.body.error.fields.username?.[0]).toMatch(/reserved/i);
  });

  it('logs in by username or email and logs out', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({
      username: 'loginuser',
      email: 'login@example.com',
      password: 'Kanban!Passw0rd',
    });
    await agent.post('/api/auth/logout');

    const byUsername = await agent.post('/api/auth/login').send({
      identifier: 'loginuser',
      password: 'Kanban!Passw0rd',
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
      password: 'Kanban!Passw0rd',
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
        password: 'Kanban!Passw0rd',
      });

    expect(rejected.status).toBe(403);
    expect(rejected.body.error.code).toBe('BAD_ORIGIN');

    const accepted = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({
        username: 'localhostorigin',
        email: 'localhostorigin@example.com',
        password: 'Kanban!Passw0rd',
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
