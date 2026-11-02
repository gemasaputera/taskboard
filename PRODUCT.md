# Product

Kanban is a small-team task board that stays in sync. It gives every registered person a ready
workplace and a four-lane board, then gets out of the way while they move work forward.

## Who it is for

Small product, design, and freelance teams (2–10 people) who need a shared board without another
tool to administer. The owner configures the board; everybody else just works.

## Jobs to be done

1. **Start in seconds** — register, land on a named workplace with To Do / Revision / On Progress /
   Done, add the first card.
2. **Shape the board to the work** — rename lanes, reorder them, hide the ones not in use, add new
   ones, and remove lanes safely.
3. **Work a task** — describe it in Markdown, break it into checklist items, tag it, assign it,
   discuss it, move it.
4. **Bring people in** — invite a registered teammate by username or email; they accept in-app.
5. **Stay current** — two people editing the same board see the change immediately.

## Principles

- **The board is the product.** Navigation, chrome, and dialogs stay quiet; the lanes carry the
  hierarchy.
- **One source of truth.** The server owns ordering and permissions; optimistic UI is a courtesy
  that rolls back.
- **Safe destructive actions.** Columns delete only after their cards are re-homed; cards and tags
  ask before removing.
- **Owner sets structure, everyone moves work.** The permission split is visible in the UI, not
  just enforced in the API.
- **Calm, not cute.** No confetti, no scoreboards, no decorative motion.

## Definition of success

- A new user can create a card and move it across lanes without reading help text.
- An owner can invite a teammate and see them working in the same workplace in under a minute.
- Every card detail field is useful: subtasks show progress, tags are scannable, comments carry the
  conversation and timestamps.
- The board survives a reload and two-browser editing without losing a position or duplicating work.

## Out of scope for the first version

Multiple boards per workplace, attachments, due dates, notifications, mentions, OAuth, password
reset, email delivery, workplace deletion/transfer, and scaled multi-instance realtime.
