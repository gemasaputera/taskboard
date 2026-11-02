# Design system

Operate mode: the interface exists to finish a task. The aesthetic is a quiet desk — cool paper,
ink text, one cobalt accent, and a fine dot grid that makes the board feel like a surface rather
than a web page.

## Color

Defined as Tailwind v4 theme tokens in `apps/web/src/styles.css`.

| Token                      | Value     | Use                                            |
| -------------------------- | --------- | ---------------------------------------------- |
| `canvas`                   | `#f5f5f3` | App background, board surface                  |
| `surface`                  | `#ffffff` | Cards, dialogs, top bar                        |
| `surface-soft`             | `#fafaf8` | Column shells, secondary panels                |
| `ink`                      | `#1c1917` | Primary text, logo mark, dark auth panel       |
| `muted`                    | `#77716a` | Secondary text, meta, placeholders             |
| `line`                     | `#e7e4df` | Borders and dividers                           |
| `accent`                   | `#2447d6` | Primary actions, focus, progress, active state |
| `accent-soft`              | `#eef1fd` | Owner badge, selected backgrounds              |
| `danger` / `danger-soft`   | `#dc2626` / `#fef2f2` | Destructive actions and errors       |

Tag colors are an eight-swatch palette (`#d1495b`, `#e07a5f`, `#e9c46a`, `#2a9d8f`, `#457b9d`,
`#6d597a`, `#7a9e7e`, `#5e60ce`) stored with each tag. A tag is always rendered with its name, so
color is never the only signal.

No gradients, glass effects, or more than one accent hue.

## Type

System UI stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto…`) keeps the app
native-fast and avoids a font request. Scale:

| Role            | Size / weight             |
| --------------- | ------------------------- |
| Auth headline   | 36–48px / 600, tight leading |
| Board title     | 17px / 600                |
| Card title      | 13.5px / 500              |
| Body            | 13–14px / 400             |
| Meta            | 10.5–11px / 400–500, tabular numerals for counts |
| Dialog title    | 16–20px / 600             |
| Section heading | 13px / 600                |

Letter-spacing only on uppercase micro labels (`0.08em`) and the auth eyebrow (`0.18em`).

## Space, radius, depth

- 4px base rhythm; common gaps 8 / 12 / 16 / 24 / 28.
- Radius: 8px controls, 12px columns/dialogs, 16px auth preview, full for avatars and pills.
- Depth: `shadow-card` for cards (two low-opacity layers), `shadow-lift` for dialogs and drag
  overlays. Borders do most of the separation; shadows are ambient, not decorative.

## Components

- **Top bar** — 56px, white, 1px bottom rule. Workplace monogram + switcher on the left; live state,
  members, invitations, account on the right.
- **Board header** — workplace name, column/task/hidden counts, `Customize` for the owner. No
  duplicate toolbar.
- **Column** — white-soft shell, count pill, owner menu, content-height card list, inline
  `Add a card`. Empty columns keep a dashed `Drop a card here` zone.
- **Card** — title, up to three tag pills (+N), subtask progress, comment count, relative update
  time, and up to three overlapping assignee avatars (+N). Drag handle appears on hover/focus on
  desktop and is always present on touch.
- **Card dialog** — sticky header (lane pill, title, actions), two-column body on desktop,
  single column on mobile. Descriptions render as GitHub-flavored Markdown in the `prose` scale,
  with a Write/Preview toggle while editing. The sidebar leads with **Assigned** (member chips plus
  a checkbox picker), then tags, dates, and delete.
- **Auth** — split layout: dark ink panel with a board preview on desktop, centered form on the
  right. Mobile collapses to the form.
- **States** — skeletons while loading, empty copy with one action, error panels with retry,
  optimistic updates that roll back with a toast.

## Motion

- 120–160ms ease-out for hovers, dialogs, and drag lift.
- Optimistic drag feedback follows the pointer; the drop commits one request.
- `prefers-reduced-motion: reduce` collapses animation and transition durations.
- No looping, bouncing, or attention-seeking motion.

## Accessibility

- Radix primitives for dialog/alert dialog/menus/popovers/tabs/checkboxes/switches: focus trapping,
  escape handling, and ARIA come from the primitive.
- Visible 2px focus rings on all interactive elements; `aria-label`s on icon-only controls.
- Keyboard drag via dnd-kit's keyboard sensor, plus a `Move to…` menu in the card dialog for a
  non-drag path.
- Contrast: ink on canvas/surface and white on accent meet AA for their sizes; tag names are always
  text, not color-only.
- Dialogs start with a screen-reader title/description; close buttons are labelled.

## Layout rules

- Board is horizontally scrollable; columns are `17.5rem` on desktop and `85vw` on mobile.
- Main app shell is `100dvh` with a single scroll region per column, never a scrolling page behind
  the board.
- Dialogs cap at `92dvh`, scroll internally, and become near-full-width on small screens.
- Numbers (counts, dates) use tabular figures to stop jitter as data updates.
