import type {
  BoardColumnDto,
  BoardDto,
  CardDetailDto,
  CardSummaryDto,
} from '@kanban/shared';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';

export const app = createApp();

export type TestAgent = ReturnType<typeof request.agent>;

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "CardTag","Comment","Subtask","Tag","Card","BoardColumn","Invitation","Membership","Workplace","User" RESTART IDENTITY CASCADE',
  );
}

let counter = 0;

export interface RegisteredUser {
  agent: TestAgent;
  username: string;
  user: { id: string; username: string; email: string };
  workplaceId: string;
  cookie: string;
}

export async function registerUser(prefix = 'user'): Promise<RegisteredUser> {
  counter += 1;
  const username = `${prefix}${counter}`.slice(0, 24);
  const agent = request.agent(app);

  const response = await agent.post('/api/auth/register').send({
    username,
    email: `${username}@example.com`,
    password: 'Kanban!Passw0rd',
  });

  if (response.status !== 201) {
    throw new Error(`register failed (${response.status}): ${JSON.stringify(response.body)}`);
  }

  const rawCookies = response.headers['set-cookie'];
  const cookie = Array.isArray(rawCookies)
    ? rawCookies.map((value: string) => value.split(';')[0]).join('; ')
    : '';

  return {
    agent,
    username,
    user: response.body.user,
    workplaceId: response.body.workplaces[0].id,
    cookie,
  };
}

export async function addMember(
  owner: RegisteredUser,
  member: RegisteredUser,
): Promise<void> {
  const invitation = await owner.agent
    .post(`/api/workplaces/${owner.workplaceId}/invitations`)
    .send({ identifier: member.username });

  if (invitation.status !== 201) {
    throw new Error(
      `invite failed (${invitation.status}): ${JSON.stringify(invitation.body)}`,
    );
  }

  const accepted = await member.agent.post(
    `/api/invitations/${invitation.body.id as string}/accept`,
  );

  if (accepted.status !== 200) {
    throw new Error(`accept failed (${accepted.status}): ${JSON.stringify(accepted.body)}`);
  }
}

export async function getBoard(
  agent: TestAgent,
  workplaceId: string,
): Promise<{ status: number; body: BoardDto }> {
  const response = await agent.get(`/api/workplaces/${workplaceId}/board`);
  return { status: response.status, body: response.body as BoardDto };
}

export async function createCard(
  agent: TestAgent,
  workplaceId: string,
  columnId: string,
  title: string,
): Promise<CardDetailDto> {
  const response = await agent
    .post(`/api/workplaces/${workplaceId}/cards`)
    .send({ columnId, title, description: null });

  if (response.status !== 201) {
    throw new Error(`create card failed (${response.status}): ${JSON.stringify(response.body)}`);
  }

  return response.body as CardDetailDto;
}

export function cardInColumn(
  board: BoardDto,
  columnId: string,
): CardSummaryDto[] {
  return board.cards
    .filter((card) => card.columnId === columnId)
    .sort((a, b) => a.position - b.position);
}

export function columnByName(board: BoardDto, name: string): BoardColumnDto {
  const column = board.columns.find((candidate) => candidate.name === name);
  if (!column) throw new Error(`column "${name}" not found`);
  return column;
}

