import { z } from 'zod';

export const APP_NAME = 'Kanban';
export const SESSION_COOKIE = 'kanban_session';
export const SESSION_DAYS = 7;

export const DEFAULT_COLUMN_NAMES = ['To Do', 'Revision', 'On Progress', 'Done'] as const;

export const TAG_COLORS = [
  '#d1495b',
  '#e07a5f',
  '#e9c46a',
  '#2a9d8f',
  '#457b9d',
  '#6d597a',
  '#7a9e7e',
  '#5e60ce',
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export const TAG_COLOR_SCHEMA = z.enum(TAG_COLORS as unknown as [string, ...string[]]);

export const LIMITS = {
  usernameMin: 3,
  usernameMax: 24,
  passwordMin: 8,
  passwordMax: 200,
  workplaceNameMax: 60,
  columnNameMax: 40,
  cardTitleMax: 200,
  cardDescriptionMax: 10_000,
  subtaskTitleMax: 200,
  commentMax: 5_000,
  tagNameMax: 24,
  maxCardTags: 30,
  maxCardAssignees: 50,
} as const;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(LIMITS.usernameMin, 'Username must be at least 3 characters.')
  .max(LIMITS.usernameMax, 'Username must be at most 24 characters.')
  .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, and underscores only.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(254);

export const passwordSchema = z
  .string()
  .min(LIMITS.passwordMin, 'Password must be at least 8 characters.')
  .max(LIMITS.passwordMax, 'Password is too long.');

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your username or email.').max(254),
  password: z.string().min(1, 'Enter your password.').max(LIMITS.passwordMax),
});

export const workplaceNameSchema = z
  .string()
  .trim()
  .min(1, 'Workplace name is required.')
  .max(LIMITS.workplaceNameMax, 'Workplace name is too long.');

export const createWorkplaceSchema = z.object({ name: workplaceNameSchema });
export const updateWorkplaceSchema = z.object({ name: workplaceNameSchema });

export const inviteSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter a username or email.').max(254),
});

export const columnNameSchema = z
  .string()
  .trim()
  .min(1, 'Column name is required.')
  .max(LIMITS.columnNameMax, 'Column name is too long.');

export const createColumnSchema = z.object({ name: columnNameSchema });
export const updateColumnSchema = z.object({
  name: columnNameSchema.optional(),
  isHidden: z.boolean().optional(),
});
export const reorderColumnsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(100),
});

export const cardTitleSchema = z
  .string()
  .trim()
  .min(1, 'Card title is required.')
  .max(LIMITS.cardTitleMax, 'Card title is too long.');

export const descriptionSchema = z
  .string()
  .trim()
  .max(LIMITS.cardDescriptionMax, 'Description is too long.')
  .nullable()
  .optional();

export const createCardSchema = z.object({
  columnId: z.string().uuid(),
  title: cardTitleSchema,
  description: descriptionSchema,
});

export const updateCardSchema = z.object({
  title: cardTitleSchema.optional(),
  description: descriptionSchema,
});

export const moveCardSchema = z.object({
  columnId: z.string().uuid(),
  position: z.number().int().min(0).max(10_000),
});

export const setCardTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()).max(LIMITS.maxCardTags),
});

export const setCardAssigneesSchema = z.object({
  userIds: z.array(z.string().uuid()).max(LIMITS.maxCardAssignees),
});

export const subtaskTitleSchema = z
  .string()
  .trim()
  .min(1, 'Subtask title is required.')
  .max(LIMITS.subtaskTitleMax, 'Subtask title is too long.');

export const createSubtaskSchema = z.object({ title: subtaskTitleSchema });
export const updateSubtaskSchema = z.object({
  title: subtaskTitleSchema.optional(),
  isDone: z.boolean().optional(),
});

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, 'Write a comment first.')
  .max(LIMITS.commentMax, 'Comment is too long.');

export const createCommentSchema = z.object({ body: commentBodySchema });
export const updateCommentSchema = z.object({ body: commentBodySchema });

export const tagNameSchema = z
  .string()
  .trim()
  .min(1, 'Tag name is required.')
  .max(LIMITS.tagNameMax, 'Tag name is too long.');

export const createTagSchema = z.object({
  name: tagNameSchema,
  color: TAG_COLOR_SCHEMA,
});

export const updateTagSchema = z.object({
  name: tagNameSchema.optional(),
  color: TAG_COLOR_SCHEMA.optional(),
});

export const REALTIME_EVENTS = {
  columnCreated: 'column.created',
  columnUpdated: 'column.updated',
  columnDeleted: 'column.deleted',
  columnsReordered: 'columns.reordered',
  cardCreated: 'card.created',
  cardUpdated: 'card.updated',
  cardMoved: 'card.moved',
  cardDeleted: 'card.deleted',
  subtaskCreated: 'subtask.created',
  subtaskUpdated: 'subtask.updated',
  subtaskDeleted: 'subtask.deleted',
  commentCreated: 'comment.created',
  commentUpdated: 'comment.updated',
  commentDeleted: 'comment.deleted',
  tagCreated: 'tag.created',
  tagUpdated: 'tag.updated',
  tagDeleted: 'tag.deleted',
  memberJoined: 'member.joined',
  memberRemoved: 'member.removed',
  workplaceUpdated: 'workplace.updated',
  invitationReceived: 'invitation.received',
  invitationResponded: 'invitation.responded',
  invitationRemoved: 'invitation.removed',
} as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export interface RealtimePayload {
  workplaceId?: string;
  cardId?: string;
  columnId?: string;
  tagId?: string;
  userId?: string;
  invitationId?: string;
}

export type Role = 'OWNER' | 'MEMBER';
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface UserSummary {
  id: string;
  username: string;
  email: string;
}

export interface WorkplaceSummary {
  id: string;
  name: string;
  role: Role;
}

export interface MeResponse {
  user: UserSummary;
  workplaces: WorkplaceSummary[];
}

export interface WorkplaceDto {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface TagDto {
  id: string;
  name: string;
  color: string;
}

export interface BoardColumnDto {
  id: string;
  name: string;
  position: number;
  isHidden: boolean;
}

export interface CardAuthorDto {
  id: string;
  username: string;
}

export interface CardAssigneeDto {
  id: string;
  username: string;
}

export interface CardSummaryDto {
  id: string;
  workplaceId: string;
  columnId: string;
  title: string;
  position: number;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: CardAuthorDto;
  tags: TagDto[];
  assignees: CardAssigneeDto[];
  subtaskCount: number;
  doneSubtaskCount: number;
  commentCount: number;
}

export interface SubtaskDto {
  id: string;
  title: string;
  isDone: boolean;
  position: number;
}

export interface CommentDto {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: CardAuthorDto;
}

export interface CardDetailDto extends CardSummaryDto {
  description: string | null;
  subtasks: SubtaskDto[];
  comments: CommentDto[];
}

export interface BoardDto {
  workplace: WorkplaceDto;
  role: Role;
  columns: BoardColumnDto[];
  tags: TagDto[];
  cards: CardSummaryDto[];
}

export interface MemberDto {
  id: string;
  userId: string;
  username: string;
  email?: string;
  role: Role;
  joinedAt: string;
}

export interface InvitationDto {
  id: string;
  workplaceId: string;
  workplaceName: string;
  inviterUsername: string;
  inviteeUsername?: string;
  status: InviteStatus;
  createdAt: string;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}
