---
title: How Kanban works
category:
  uri: Guides
position: 0
slug: concepts
privacy:
  view: public
content:
  excerpt: Workplaces, memberships, cards, ordering, permissions, and realtime — the model behind the board.
---

## Workplaces and memberships

A **workplace** is the top-level container. Each workplace owns its columns, cards, tags, and
invitations, and has exactly one **owner**.

People join through a **membership**. Registering creates a membership in a personal workplace;
the owner can invite existing users by exact username or email. Membership is live immediately
after the invitee accepts, with no reload required.

```
User ──< Membership >── Workplace
                          ├── BoardColumn ──< Card
                          ├── Tag
                          └── Invitation
```

A workplace has one board. Multiple boards per workplace, attachments, due dates, and ownership
transfer are intentionally out of scope for v1.

## Columns and ordering

Every column and card has an integer **position**. Moving a card reads both affected columns,
clamps the target index, and writes the new order in one parameterized SQL update inside a
`Serializable` transaction, retried on write conflicts. The board sorts by
`position, createdAt, id`, so even a rare tie is deterministic.

Deleting a column re-appends its cards to the first visible remaining column before removing it.
Hidden columns keep their cards but are not shown in the board view.

## Cards

A card has a title, an optional Markdown description, a position, an author, and timestamps.
Around it:

| Relation       | What it stores                                      |
| :------------- | :-------------------------------------------------- |
| `Subtask`      | Checklist items with `isDone` and a position        |
| `Comment`      | A thread, ordered by creation time                  |
| `Tag`          | Named, colored labels shared across the workplace   |
| `CardAssignee` | Members assigned to the card, unassigned by default |

Descriptions are GitHub-flavored Markdown. Raw HTML is disabled when the web app renders them.

## Permissions

All resource access resolves the resource → workplace → membership, so IDs from another workplace
return `404` rather than leaking data.

| Action                                                              | Member | Owner |
| :------------------------------------------------------------------ | :----: | :---: |
| View board, cards, members                                          |   ✅   |  ✅   |
| Create, edit, move, and delete cards, checklists, and comments      |   ✅   |  ✅   |
| Create tags and assign tags or members to cards                     |   ✅   |  ✅   |
| Rename and delete tags                                              |   —    |  ✅   |
| Add, rename, reorder, hide, and delete columns                      |   —    |  ✅   |
| Invite and cancel invitations, remove members, rename the workplace |   —    |  ✅   |
| Leave the workplace                                                 |   ✅   |   —   |

Comment authors can edit their own comments. Authors and the owner can delete comments. The owner
cannot remove themselves or leave their own workplace, because ownership transfer is not
implemented.

## Realtime

Authenticated sockets join two rooms: `user:<id>` and `workplace:<id>`. After a mutation commits,
the API emits small ID-only events such as `card.moved` or `comment.created`. Clients invalidate
the relevant TanStack Query keys and refetch, keeping the server as the source of truth.

Accepting an invitation joins the socket to the new workplace room; removing a member makes it
leave. Disconnected clients refetch on reconnect and window focus.

> 🚧 **One API instance.** Socket rooms and rate-limit counters live in process memory. Add a Redis
> adapter and a shared rate-limit store before running more than one API replica.

## Authentication

Sign-up normalizes usernames and emails to lowercase, rejects embedded spaces and reserved names,
and requires a password with mixed case, a number, and a symbol that is neither common nor derived
from the account. The web form checks availability as you type; `POST /api/auth/register` re-checks
everything server-side. See [REST API](/docs/rest-api#sign-up-validation) for the exact rules.

Passwords are hashed with Node's `scrypt`. A successful login or registration signs an HS256 JWT
(seven days) and sets it as an `httpOnly`, `SameSite=Lax` cookie. The web app and the MCP server
both use that session cookie; there is no separate public API token.
