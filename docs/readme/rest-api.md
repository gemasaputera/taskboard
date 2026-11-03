---
title: REST API
category:
  uri: Guides
position: 3
slug: rest-api
privacy:
  view: public
content:
  excerpt: The cookie-authenticated HTTP API shared by the web app and the MCP server, with every endpoint.
---

The web app and the MCP server both use this HTTP API. It is the app's own API, not a separate
public platform: authentication is a session cookie, not an OAuth token.

## Base URL

| Environment | Base URL                          |
| :---------- | :-------------------------------- |
| Local       | `http://localhost:4000/api`       |
| Production  | `https://your-domain.example/api` |

All request and response bodies are JSON. UUIDs are used for every resource ID.

## Authentication

Sign in to receive the `kanban_session` cookie, then send it with every request:

```bash
curl -c cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"ada","password":"Kanban!Passw0rd"}'

curl -b cookies.txt http://localhost:4000/api/workplaces
```

The cookie is `httpOnly`, `SameSite=Lax`, and lasts seven days. There is no bearer-token flow. The
MCP server signs in the same way and caches the cookie for its own calls.

## Errors

Failures return an HTTP status and a consistent body:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input.",
    "fields": {
      "title": ["Card title is required."]
    }
  }
}
```

Common codes include `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`CONFLICT` (409), `VALIDATION_ERROR` (400), and `RATE_LIMITED` (429). Ownership violations return
`403`; resources from another workplace return `404`.

## Health

| Method | Path          | Description                              |
| :----- | :------------ | :--------------------------------------- |
| `GET`  | `/api/health` | Liveness check; returns `{ "ok": true }` |

## Account

| Method | Path                     | Description                                                  |
| :----- | :----------------------- | :----------------------------------------------------------- |
| `POST` | `/api/auth/register`     | Create an account and its default workplace                  |
| `GET`  | `/api/auth/availability` | Check whether a username and/or email is already in use      |
| `POST` | `/api/auth/login`        | Sign in with `identifier` (username or email) and `password` |
| `POST` | `/api/auth/logout`       | Clear the session cookie                                     |
| `GET`  | `/api/auth/me`           | Current user and workplaces                                  |

### Sign-up validation

The web form calls `GET /api/auth/availability?username=ada&email=ada@example.com` while the user
types. Send at least one field; both are trimmed and lowercased first.

```json
{
  "username": { "available": false, "message": "That username is already taken." },
  "email": { "available": true, "message": null }
}
```

The response is sent with `Cache-Control: no-store` and is limited to 60 requests per minute per IP
(`429 RATE_LIMITED`). Invalid formats and reserved usernames return `400 VALIDATION_ERROR` with a
`fields` map. Availability necessarily reveals whether an account exists — it is a UX aid, not an
authorization check.

Registration enforces the same rules server-side:

- **Username** — 3–24 characters of lowercase letters, numbers, and underscores. Leading/trailing
  spaces are trimmed, embedded spaces are rejected, and reserved names (`admin`, `support`, `api`,
  …) are refused.
- **Email** — a valid address, at most 254 characters, unique case-insensitively.
- **Password** — 8–200 characters with uppercase and lowercase letters, a number, and a symbol. It
  may not be a common password or contain the username or email local-part.
- **Conflicts** — a duplicate username or email returns `409 CONFLICT` with
  `error.fields.username` and/or `error.fields.email`, so the form can highlight the exact input.

## Workplaces

| Method   | Path                                           | Description                                      |
| :------- | :--------------------------------------------- | :----------------------------------------------- |
| `GET`    | `/api/workplaces`                              | Workplaces you belong to                         |
| `POST`   | `/api/workplaces`                              | Create a workplace with the four default columns |
| `PATCH`  | `/api/workplaces/:workplaceId`                 | Rename a workplace (owner)                       |
| `GET`    | `/api/workplaces/:workplaceId/board`           | Board, columns, tags, cards, and your role       |
| `GET`    | `/api/workplaces/:workplaceId/members`         | Members; emails are visible to the owner         |
| `DELETE` | `/api/workplaces/:workplaceId/members/:userId` | Remove a member (owner)                          |
| `POST`   | `/api/workplaces/:workplaceId/leave`           | Leave a workplace (members)                      |

## Invitations

| Method   | Path                                       | Description                                     |
| :------- | :----------------------------------------- | :---------------------------------------------- |
| `GET`    | `/api/invitations`                         | Pending invitations addressed to you            |
| `GET`    | `/api/workplaces/:workplaceId/invitations` | Pending invitations sent by a workplace (owner) |
| `POST`   | `/api/workplaces/:workplaceId/invitations` | Invite by username or email (owner)             |
| `DELETE` | `/api/invitations/:invitationId`           | Cancel a pending invitation (owner)             |
| `POST`   | `/api/invitations/:invitationId/accept`    | Accept your invitation                          |
| `POST`   | `/api/invitations/:invitationId/decline`   | Decline your invitation                         |

## Columns

| Method   | Path                                         | Description                                                         |
| :------- | :------------------------------------------- | :------------------------------------------------------------------ |
| `POST`   | `/api/workplaces/:workplaceId/columns`       | Add a column (owner)                                                |
| `PUT`    | `/api/workplaces/:workplaceId/columns/order` | Reorder every column (owner)                                        |
| `PATCH`  | `/api/columns/:columnId`                     | Rename or hide a column (owner)                                     |
| `DELETE` | `/api/columns/:columnId`                     | Delete a column; its cards move to the first visible column (owner) |

## Cards

| Method   | Path                                 | Description                                   |
| :------- | :----------------------------------- | :-------------------------------------------- |
| `POST`   | `/api/workplaces/:workplaceId/cards` | Create a card                                 |
| `GET`    | `/api/cards/:cardId`                 | Full card detail with checklists and comments |
| `PATCH`  | `/api/cards/:cardId`                 | Change title or description                   |
| `PATCH`  | `/api/cards/:cardId/move`            | Move to a column and position                 |
| `DELETE` | `/api/cards/:cardId`                 | Delete a card and its children                |
| `PUT`    | `/api/cards/:cardId/tags`            | Replace the card's tags                       |
| `PUT`    | `/api/cards/:cardId/assignees`       | Replace the card's assignees                  |

## Checklists and comments

| Method   | Path                          | Description                                  |
| :------- | :---------------------------- | :------------------------------------------- |
| `POST`   | `/api/cards/:cardId/subtasks` | Add a checklist item                         |
| `PATCH`  | `/api/subtasks/:subtaskId`    | Rename or toggle a checklist item            |
| `DELETE` | `/api/subtasks/:subtaskId`    | Delete a checklist item                      |
| `POST`   | `/api/cards/:cardId/comments` | Comment on a card                            |
| `PATCH`  | `/api/comments/:commentId`    | Edit your own comment                        |
| `DELETE` | `/api/comments/:commentId`    | Delete your comment, or any comment as owner |

## Tags

| Method   | Path                                | Description                     |
| :------- | :---------------------------------- | :------------------------------ |
| `GET`    | `/api/workplaces/:workplaceId/tags` | List tags                       |
| `POST`   | `/api/workplaces/:workplaceId/tags` | Create a tag                    |
| `PATCH`  | `/api/tags/:tagId`                  | Rename or recolor a tag (owner) |
| `DELETE` | `/api/tags/:tagId`                  | Delete a tag everywhere (owner) |

## Working with the API from an AI client

The [MCP server](/docs/mcp) wraps this API with 39 tools, so an AI client does not need to build
requests or manage the cookie itself. Use the REST API directly when you are writing your own
integration.
