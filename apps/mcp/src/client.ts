import {
  SESSION_COOKIE,
  type BoardColumnDto,
  type BoardDto,
  type CardAssigneeDto,
  type CardDetailDto,
  type CommentDto,
  type InvitationDto,
  type MemberDto,
  type MeResponse,
  type SubtaskDto,
  type TagDto,
  type WorkplaceDto,
  type WorkplaceSummary,
} from '@kanban/shared';
import type { McpConfig } from './config.js';
import { SessionStore } from './session-store.js';

export class KanbanApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'KanbanApiError';
  }
}

export class KanbanAuthError extends Error {
  constructor(apiUrl: string) {
    super(
      `Not signed in to the Kanban API at ${apiUrl}. Sign in with the \`login` +
        '` tool (username or email + password), or set KANBAN_USERNAME and KANBAN_PASSWORD ' +
        'in the MCP server environment.',
    );
    this.name = 'KanbanAuthError';
  }
}

export class KanbanConnectionError extends Error {
  constructor(apiUrl: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(
      `Could not reach the Kanban API at ${apiUrl} (${detail}). Is it running? ` +
        'Start it with `pnpm dev:api` and check KANBAN_API_URL.',
    );
    this.name = 'KanbanConnectionError';
  }
}

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
  };
}

function normalizeCookie(value: string): string {
  const trimmed = value.trim().replace(/^cookie:\s*/i, '');
  return trimmed.includes('=') ? trimmed : `${SESSION_COOKIE}=${trimmed}`;
}

function extractSessionCookie(response: Response): string | undefined {
  const headers =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie') ?? ''].filter(Boolean);

  const pairs: string[] = [];

  for (const header of headers) {
    for (const part of header.split(/,(?=\s*[A-Za-z0-9_-]+=)/)) {
      const pair = part.split(';')[0]?.trim();
      if (pair?.startsWith(`${SESSION_COOKIE}=`)) pairs.push(pair);
    }
  }

  return pairs.length > 0 ? pairs.join('; ') : undefined;
}

function pathSegment(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Thin, typed wrapper around the Kanban REST API. Every mutation goes through the same
 * routes the web app uses, so permissions, validation, ordering, and Socket.IO events
 * stay in one place.
 */
export class KanbanApiClient {
  readonly apiUrl: string;
  private readonly store: SessionStore;
  private readonly timeoutMs: number;
  private cookie?: string;
  private credentials?: { identifier: string; password: string };
  private loginInFlight?: Promise<void>;
  /** Set when an injected session token is rejected and credentials take over. */
  private sessionTokenDisabled = false;

  constructor(
    private readonly config: McpConfig,
    options: { timeoutMs?: number } = {},
  ) {
    this.apiUrl = config.apiUrl;
    this.store = new SessionStore(config.sessionFile);
    // A cold Render instance can take close to a minute to wake, so allow more than
    // the usual request budget for the first call against the hosted API.
    this.timeoutMs = options.timeoutMs ?? 60_000;

    if (config.username && config.password) {
      this.credentials = { identifier: config.username, password: config.password };
    }
  }

  get defaultWorkplaceId(): string | undefined {
    return this.config.defaultWorkplaceId;
  }

  // ---------------------------------------------------------------- auth

  async whoami(): Promise<MeResponse> {
    return this.authed<MeResponse>('GET', '/auth/me');
  }

  /** Signs in, remembers the credentials for silent re-auth, and caches the session. */
  async login(identifier: string, password: string): Promise<MeResponse> {
    const me = await this.loginWithPassword({ identifier, password }, true);
    this.credentials = { identifier, password };
    return me;
  }

  async registerAccount(input: {
    username: string;
    email: string;
    password: string;
  }): Promise<MeResponse> {
    const response = await this.send('POST', '/auth/register', input);
    const me = await this.parse<MeResponse>(response);
    this.captureCookie(response, true);
    return me;
  }

  async logout(): Promise<void> {
    if (this.cookie) {
      try {
        await this.send('POST', '/auth/logout', undefined, this.cookie);
      } catch {
        // The cookie is cleared locally even if the API is unreachable.
      }
    }

    this.cookie = undefined;
    this.credentials = undefined;
    this.store.clear();
  }

  private async loginWithPassword(
    credentials: { identifier: string; password: string },
    persist: boolean,
  ): Promise<MeResponse> {
    const response = await this.send('POST', '/auth/login', credentials);
    const me = await this.parse<MeResponse>(response);
    this.captureCookie(response, persist);
    return me;
  }

  private captureCookie(response: Response, persist: boolean): void {
    const cookie = extractSessionCookie(response);

    if (!cookie) {
      throw new Error(
        'The Kanban API signed the request in but did not return a session cookie. ' +
          'Check that KANBAN_API_URL points at the Kanban API.',
      );
    }

    this.cookie = cookie;
    if (persist) this.store.write(this.apiUrl, cookie);
  }

  // ---------------------------------------------------------- workplaces

  async listWorkplaces(): Promise<WorkplaceSummary[]> {
    return this.authed<WorkplaceSummary[]>('GET', '/workplaces');
  }

  async createWorkplace(name: string): Promise<WorkplaceDto> {
    return this.authed<WorkplaceDto>('POST', '/workplaces', { name });
  }

  async renameWorkplace(workplaceId: string, name: string): Promise<WorkplaceDto> {
    return this.authed<WorkplaceDto>('PATCH', `/workplaces/${pathSegment(workplaceId)}`, {
      name,
    });
  }

  async getBoard(workplaceId: string): Promise<BoardDto> {
    return this.authed<BoardDto>('GET', `/workplaces/${pathSegment(workplaceId)}/board`);
  }

  async listMembers(workplaceId: string): Promise<MemberDto[]> {
    return this.authed<MemberDto[]>('GET', `/workplaces/${pathSegment(workplaceId)}/members`);
  }

  async removeMember(workplaceId: string, userId: string): Promise<void> {
    await this.authed<void>(
      'DELETE',
      `/workplaces/${pathSegment(workplaceId)}/members/${pathSegment(userId)}`,
    );
  }

  async leaveWorkplace(workplaceId: string): Promise<void> {
    await this.authed<void>('POST', `/workplaces/${pathSegment(workplaceId)}/leave`);
  }

  // ------------------------------------------------------------- columns

  async createColumn(workplaceId: string, name: string): Promise<BoardColumnDto> {
    return this.authed<BoardColumnDto>('POST', `/workplaces/${pathSegment(workplaceId)}/columns`, {
      name,
    });
  }

  async updateColumn(
    columnId: string,
    patch: { name?: string; isHidden?: boolean },
  ): Promise<BoardColumnDto> {
    return this.authed<BoardColumnDto>('PATCH', `/columns/${pathSegment(columnId)}`, patch);
  }

  async deleteColumn(columnId: string): Promise<void> {
    await this.authed<void>('DELETE', `/columns/${pathSegment(columnId)}`);
  }

  async reorderColumns(workplaceId: string, orderedIds: string[]): Promise<void> {
    await this.authed<void>('PUT', `/workplaces/${pathSegment(workplaceId)}/columns/order`, {
      orderedIds,
    });
  }

  // --------------------------------------------------------------- cards

  async createCard(
    workplaceId: string,
    input: { columnId: string; title: string; description?: string | null },
  ): Promise<CardDetailDto> {
    return this.authed<CardDetailDto>(
      'POST',
      `/workplaces/${pathSegment(workplaceId)}/cards`,
      input,
    );
  }

  async getCard(cardId: string): Promise<CardDetailDto> {
    return this.authed<CardDetailDto>('GET', `/cards/${pathSegment(cardId)}`);
  }

  async updateCard(
    cardId: string,
    patch: { title?: string; description?: string | null },
  ): Promise<CardDetailDto> {
    await this.authed<unknown>('PATCH', `/cards/${pathSegment(cardId)}`, patch);
    return this.getCard(cardId);
  }

  async deleteCard(cardId: string): Promise<void> {
    await this.authed<void>('DELETE', `/cards/${pathSegment(cardId)}`);
  }

  async moveCard(
    cardId: string,
    input: { columnId: string; position: number },
  ): Promise<{ cardId: string; columnId: string; position: number }> {
    return this.authed('PATCH', `/cards/${pathSegment(cardId)}/move`, input);
  }

  async setCardTags(cardId: string, tagIds: string[]): Promise<TagDto[]> {
    return this.authed<TagDto[]>('PUT', `/cards/${pathSegment(cardId)}/tags`, { tagIds });
  }

  async setCardAssignees(cardId: string, userIds: string[]): Promise<CardAssigneeDto[]> {
    return this.authed<CardAssigneeDto[]>('PUT', `/cards/${pathSegment(cardId)}/assignees`, {
      userIds,
    });
  }

  // ------------------------------------------------------------ subtasks

  async createSubtask(cardId: string, title: string): Promise<SubtaskDto> {
    return this.authed<SubtaskDto>('POST', `/cards/${pathSegment(cardId)}/subtasks`, {
      title,
    });
  }

  async updateSubtask(
    subtaskId: string,
    patch: { title?: string; isDone?: boolean },
  ): Promise<SubtaskDto> {
    return this.authed<SubtaskDto>('PATCH', `/subtasks/${pathSegment(subtaskId)}`, patch);
  }

  async deleteSubtask(subtaskId: string): Promise<void> {
    await this.authed<void>('DELETE', `/subtasks/${pathSegment(subtaskId)}`);
  }

  // ------------------------------------------------------------ comments

  async createComment(cardId: string, body: string): Promise<CommentDto> {
    return this.authed<CommentDto>('POST', `/cards/${pathSegment(cardId)}/comments`, {
      body,
    });
  }

  async updateComment(commentId: string, body: string): Promise<CommentDto> {
    return this.authed<CommentDto>('PATCH', `/comments/${pathSegment(commentId)}`, { body });
  }

  async deleteComment(commentId: string): Promise<void> {
    await this.authed<void>('DELETE', `/comments/${pathSegment(commentId)}`);
  }

  // ---------------------------------------------------------------- tags

  async listTags(workplaceId: string): Promise<TagDto[]> {
    return this.authed<TagDto[]>('GET', `/workplaces/${pathSegment(workplaceId)}/tags`);
  }

  async createTag(workplaceId: string, input: { name: string; color: string }): Promise<TagDto> {
    return this.authed<TagDto>('POST', `/workplaces/${pathSegment(workplaceId)}/tags`, input);
  }

  async updateTag(tagId: string, patch: { name?: string; color?: string }): Promise<TagDto> {
    return this.authed<TagDto>('PATCH', `/tags/${pathSegment(tagId)}`, patch);
  }

  async deleteTag(tagId: string): Promise<void> {
    await this.authed<void>('DELETE', `/tags/${pathSegment(tagId)}`);
  }

  // --------------------------------------------------------- invitations

  async listMyInvitations(): Promise<InvitationDto[]> {
    return this.authed<InvitationDto[]>('GET', '/invitations');
  }

  async listWorkplaceInvitations(workplaceId: string): Promise<InvitationDto[]> {
    return this.authed<InvitationDto[]>(
      'GET',
      `/workplaces/${pathSegment(workplaceId)}/invitations`,
    );
  }

  async inviteMember(
    workplaceId: string,
    identifier: string,
  ): Promise<{
    id: string;
    workplaceId: string;
    inviteeUsername: string;
    status: string;
    createdAt: string;
  }> {
    return this.authed('POST', `/workplaces/${pathSegment(workplaceId)}/invitations`, {
      identifier,
    });
  }

  async cancelInvitation(invitationId: string): Promise<void> {
    await this.authed<void>('DELETE', `/invitations/${pathSegment(invitationId)}`);
  }

  async acceptInvitation(
    invitationId: string,
  ): Promise<{ workplace: { id: string; name: string }; role: string }> {
    return this.authed('POST', `/invitations/${pathSegment(invitationId)}/accept`);
  }

  async declineInvitation(invitationId: string): Promise<void> {
    await this.authed<void>('POST', `/invitations/${pathSegment(invitationId)}/decline`);
  }

  // ------------------------------------------------------------- plumbing

  private async ensureSession(): Promise<void> {
    if (this.cookie) return;

    if (this.config.sessionToken && !this.sessionTokenDisabled) {
      this.cookie = normalizeCookie(this.config.sessionToken);
      return;
    }

    const stored = this.store.read(this.apiUrl);
    if (stored) {
      this.cookie = stored;
      return;
    }

    if (this.credentials) {
      // Collapse concurrent tool calls into a single login request.
      this.loginInFlight ??= this.loginWithPassword(this.credentials, false)
        .then(() => undefined)
        .finally(() => {
          this.loginInFlight = undefined;
        });
      await this.loginInFlight;
      return;
    }

    throw new KanbanAuthError(this.apiUrl);
  }

  private async authed<T>(method: string, path: string, body?: unknown): Promise<T> {
    let reauthAttempted = false;

    for (;;) {
      await this.ensureSession();

      const response = await this.send(method, path, body, this.cookie);

      if (response.status === 401 && !reauthAttempted) {
        reauthAttempted = true;
        this.cookie = undefined;
        this.store.clear();

        // A cached cookie may simply have expired; drop it and try once more using
        // configured credentials when available. An injected token that the API rejects
        // yields to those credentials rather than looping on the same bad token.
        if (this.credentials) {
          this.sessionTokenDisabled = true;
          continue;
        }

        if (this.config.sessionToken) {
          throw new KanbanAuthError(this.apiUrl);
        }

        continue;
      }

      return this.parse<T>(response);
    }
  }

  private async send(
    method: string,
    path: string,
    body?: unknown,
    cookie?: string,
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };

    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;

    try {
      return await fetch(`${this.apiUrl}/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new KanbanConnectionError(this.apiUrl, error);
    }
  }

  private async parse<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;

    const text = await response.text();
    let payload: unknown;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        if (response.ok) {
          throw new Error(`The Kanban API returned a non-JSON response (${response.status}).`);
        }
      }
    }

    if (!response.ok) {
      const apiError = (payload as ApiErrorPayload | undefined)?.error;
      const code = apiError?.code ?? 'HTTP_ERROR';
      const message = apiError?.message ?? `Request failed with status ${response.status}.`;
      const fields = apiError?.fields;

      const fieldDetails = fields
        ? Object.entries(fields)
            .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
            .join('; ')
        : undefined;

      throw new KanbanApiError(
        response.status,
        code,
        fieldDetails ? `${message} (${fieldDetails})` : message,
        fields,
      );
    }

    return payload as T;
  }
}
