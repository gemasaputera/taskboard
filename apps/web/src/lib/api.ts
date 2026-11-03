import type {
  ApiErrorPayload,
  AvailabilityResponse,
  BoardDto,
  CardAssigneeDto,
  CardDetailDto,
  InvitationDto,
  MeResponse,
  MemberDto,
  Role,
  TagDto,
  WorkplaceDto,
  WorkplaceSummary,
} from '@kanban/shared';

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    signal: options.signal,
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const payload = data as ApiErrorPayload | null;
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'REQUEST_FAILED',
      payload?.error?.message ?? 'Request failed.',
      payload?.error?.fields,
    );
  }

  return data as T;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface CreateCardInput {
  columnId: string;
  title: string;
  description?: string | null;
}

export const api = {
  getMe: () => request<MeResponse>('/auth/me'),
  login: (input: LoginInput) => request<MeResponse>('/auth/login', { method: 'POST', body: input }),
  register: (input: RegisterInput) =>
    request<MeResponse>('/auth/register', { method: 'POST', body: input }),
  checkAvailability: (input: { username?: string; email?: string }, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (input.username) params.set('username', input.username);
    if (input.email) params.set('email', input.email);
    return request<AvailabilityResponse>(`/auth/availability?${params.toString()}`, { signal });
  },
  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  listWorkplaces: () => request<WorkplaceSummary[]>('/workplaces'),
  createWorkplace: (name: string) =>
    request<WorkplaceDto>('/workplaces', { method: 'POST', body: { name } }),
  renameWorkplace: (workplaceId: string, name: string) =>
    request<WorkplaceDto>(`/workplaces/${workplaceId}`, { method: 'PATCH', body: { name } }),
  getBoard: (workplaceId: string) => request<BoardDto>(`/workplaces/${workplaceId}/board`),
  getMembers: (workplaceId: string) => request<MemberDto[]>(`/workplaces/${workplaceId}/members`),
  removeMember: (workplaceId: string, userId: string) =>
    request<void>(`/workplaces/${workplaceId}/members/${userId}`, { method: 'DELETE' }),
  leaveWorkplace: (workplaceId: string) =>
    request<void>(`/workplaces/${workplaceId}/leave`, { method: 'POST' }),

  listInvitations: () => request<InvitationDto[]>('/invitations'),
  listWorkplaceInvitations: (workplaceId: string) =>
    request<InvitationDto[]>(`/workplaces/${workplaceId}/invitations`),
  invite: (workplaceId: string, identifier: string) =>
    request<InvitationDto>(`/workplaces/${workplaceId}/invitations`, {
      method: 'POST',
      body: { identifier },
    }),
  cancelInvitation: (invitationId: string) =>
    request<void>(`/invitations/${invitationId}`, { method: 'DELETE' }),
  acceptInvitation: (invitationId: string) =>
    request<{ workplace: { id: string; name: string }; role: Role }>(
      `/invitations/${invitationId}/accept`,
      { method: 'POST' },
    ),
  declineInvitation: (invitationId: string) =>
    request<void>(`/invitations/${invitationId}/decline`, { method: 'POST' }),

  createColumn: (workplaceId: string, name: string) =>
    request<{ id: string; name: string; position: number; isHidden: boolean }>(
      `/workplaces/${workplaceId}/columns`,
      { method: 'POST', body: { name } },
    ),
  updateColumn: (
    columnId: string,
    input: { name?: string; isHidden?: boolean },
  ) =>
    request<{ id: string; name: string; position: number; isHidden: boolean }>(
      `/columns/${columnId}`,
      { method: 'PATCH', body: input },
    ),
  deleteColumn: (columnId: string) =>
    request<void>(`/columns/${columnId}`, { method: 'DELETE' }),
  reorderColumns: (workplaceId: string, orderedIds: string[]) =>
    request<void>(`/workplaces/${workplaceId}/columns/order`, {
      method: 'PUT',
      body: { orderedIds },
    }),

  createCard: (workplaceId: string, input: CreateCardInput) =>
    request<CardDetailDto>(`/workplaces/${workplaceId}/cards`, {
      method: 'POST',
      body: input,
    }),
  getCard: (cardId: string) => request<CardDetailDto>(`/cards/${cardId}`),
  updateCard: (cardId: string, input: { title?: string; description?: string | null }) =>
    request<{ id: string; title: string; description: string | null; updatedAt: string }>(
      `/cards/${cardId}`,
      { method: 'PATCH', body: input },
    ),
  moveCard: (cardId: string, columnId: string, position: number) =>
    request<{ cardId: string; columnId: string; position: number }>(`/cards/${cardId}/move`, {
      method: 'PATCH',
      body: { columnId, position },
    }),
  deleteCard: (cardId: string) => request<void>(`/cards/${cardId}`, { method: 'DELETE' }),
  setCardTags: (cardId: string, tagIds: string[]) =>
    request<TagDto[]>(`/cards/${cardId}/tags`, { method: 'PUT', body: { tagIds } }),
  setCardAssignees: (cardId: string, userIds: string[]) =>
    request<CardAssigneeDto[]>(`/cards/${cardId}/assignees`, {
      method: 'PUT',
      body: { userIds },
    }),

  createSubtask: (cardId: string, title: string) =>
    request<{ id: string; title: string; isDone: boolean; position: number }>(
      `/cards/${cardId}/subtasks`,
      { method: 'POST', body: { title } },
    ),
  updateSubtask: (subtaskId: string, input: { title?: string; isDone?: boolean }) =>
    request<{ id: string; title: string; isDone: boolean; position: number }>(
      `/subtasks/${subtaskId}`,
      { method: 'PATCH', body: input },
    ),
  deleteSubtask: (subtaskId: string) =>
    request<void>(`/subtasks/${subtaskId}`, { method: 'DELETE' }),

  createComment: (cardId: string, body: string) =>
    request<{ id: string; body: string; createdAt: string; updatedAt: string; author: { id: string; username: string } }>(
      `/cards/${cardId}/comments`,
      { method: 'POST', body: { body } },
    ),
  updateComment: (commentId: string, body: string) =>
    request<{ id: string; body: string; createdAt: string; updatedAt: string; author: { id: string; username: string } }>(
      `/comments/${commentId}`,
      { method: 'PATCH', body: { body } },
    ),
  deleteComment: (commentId: string) =>
    request<void>(`/comments/${commentId}`, { method: 'DELETE' }),

  createTag: (workplaceId: string, input: { name: string; color: string }) =>
    request<TagDto>(`/workplaces/${workplaceId}/tags`, { method: 'POST', body: input }),
  updateTag: (tagId: string, input: { name?: string; color?: string }) =>
    request<TagDto>(`/tags/${tagId}`, { method: 'PATCH', body: input }),
  deleteTag: (tagId: string) => request<void>(`/tags/${tagId}`, { method: 'DELETE' }),
};
