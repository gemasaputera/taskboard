---
title: MCP tools
category:
  uri: 'AI & MCP'
position: 1
slug: mcp-tools
privacy:
  view: public
content:
  excerpt: All 39 stdio tools (36 over HTTP OAuth) — account, workplaces, the board, cards, checklists, comments, tags, and invitations.
---

The stdio server exposes 39 tools. The HTTP OAuth endpoint exposes 36: `login`,
`register_account`, and `logout` are omitted because the access token identifies the user. Most
tools accept an optional `workplaceId`; omit it when you belong to one workplace, or set
`KANBAN_WORKPLACE_ID`.

Tool names are stable. Column tools accept a column name as an alternative to a UUID, tag tools
accept tag names, and assignee tools accept usernames, so the model rarely needs to handle IDs by
hand.

## Account

| Tool               | What it does                                                 |
| :----------------- | :----------------------------------------------------------- |
| `whoami`           | Signed-in user plus every workplace (id, name, role)         |
| `login`            | Sign in with username/email and password; caches the session |
| `register_account` | Create an account and its default workplace                  |
| `logout`           | Discard the cached session                                   |

`register_account` enforces the same rules as the web form: lowercase usernames without spaces or
reserved names, and a password with mixed case, a number, and a symbol that is not common or
account-derived. Validation errors come back per field.

## Workplaces and members

| Tool               | What it does                                                       | Access |
| :----------------- | :----------------------------------------------------------------- | :----- |
| `list_workplaces`  | Workplaces you belong to                                           | member |
| `create_workplace` | New workplace with the four default columns                        | any    |
| `rename_workplace` | Rename a workplace                                                 | owner  |
| `list_members`     | Members with user IDs, roles, join dates, and owner-visible emails | member |
| `remove_member`    | Remove a member and clear their card assignments                   | owner  |
| `leave_workplace`  | Leave a workplace                                                  | member |

## Board and columns

| Tool              | What it does                                                     | Access |
| :---------------- | :--------------------------------------------------------------- | :----- |
| `get_board`       | Columns, cards, tags, and your role — the main ID discovery tool | member |
| `find_cards`      | Search by title substring, column, tag, or assignee              | member |
| `create_column`   | Add a column at the end                                          | owner  |
| `update_column`   | Rename or hide/show a column                                     | owner  |
| `delete_column`   | Delete a column; its cards move to the first visible column      | owner  |
| `reorder_columns` | Set the left-to-right order; every column ID must appear once    | owner  |

## Cards

| Tool                 | What it does                                                                       |
| :------------------- | :--------------------------------------------------------------------------------- |
| `create_card`        | Create a card by `columnId` or `columnName` (defaults to the first visible column) |
| `get_card`           | Full detail: description, tags, assignees, checklists, comments                    |
| `update_card`        | Change title or description; `description: null` clears it                         |
| `move_card`          | Move to a column and 0-based position; omit position to append                     |
| `delete_card`        | Permanently delete the card and its children                                       |
| `set_card_tags`      | Replace tags by name or ID; empty arrays clear them                                |
| `set_card_assignees` | Replace assignees by username or user ID; empty arrays unassign                    |

All card tools are available to any workplace member.

## Checklists and comments

| Tool             | What it does                                       |
| :--------------- | :------------------------------------------------- |
| `add_subtask`    | Append a checklist item to a card                  |
| `update_subtask` | Rename an item or toggle `isDone`                  |
| `delete_subtask` | Delete a checklist item                            |
| `add_comment`    | Comment on a card as the signed-in user            |
| `update_comment` | Edit one of your own comments                      |
| `delete_comment` | Delete your comment; owners can delete any comment |

## Tags

| Tool         | What it does                                               | Access |
| :----------- | :--------------------------------------------------------- | :----- |
| `list_tags`  | Tags in a workplace with IDs and colors                    | member |
| `create_tag` | Create a tag; the color defaults to the next palette color | member |
| `update_tag` | Rename or recolor a tag                                    | owner  |
| `delete_tag` | Delete a tag everywhere it is used                         | owner  |

Colors must come from the app palette: `#d1495b`, `#e07a5f`, `#e9c46a`, `#2a9d8f`, `#457b9d`,
`#6d597a`, `#7a9e7e`, `#5e60ce`.

## Invitations

| Tool                         | What it does                                        | Access |
| :--------------------------- | :-------------------------------------------------- | :----- |
| `list_my_invitations`        | Pending invitations addressed to you                | any    |
| `list_workplace_invitations` | Pending invitations sent by a workplace             | owner  |
| `invite_member`              | Invite a registered user by exact username or email | owner  |
| `accept_invitation`          | Accept one of your invitations                      | any    |
| `decline_invitation`         | Decline one of your invitations                     | any    |
| `cancel_invitation`          | Cancel a pending invitation                         | owner  |

## Common patterns

| Goal                           | Tools                                              |
| :----------------------------- | :------------------------------------------------- |
| Find a card                    | `find_cards` then `get_card`                       |
| Create work in a specific lane | `create_card` with `columnName`                    |
| Move a card to the end of Done | `move_card` with `columnName: "Done"`              |
| Break a card into steps        | `add_subtask`, then `update_subtask` with `isDone` |
| Tag and assign in one pass     | `set_card_tags` and `set_card_assignees`           |
| Add a collaborator             | `invite_member`; they call `accept_invitation`     |

## Destructive tools

`delete_card`, `delete_column`, `delete_tag`, `delete_subtask`, `delete_comment`, `remove_member`,
`leave_workplace`, `decline_invitation`, and `cancel_invitation` permanently change data. Tool
descriptions tell the model to confirm with the user first, but review what your client is allowed
to auto-approve.
