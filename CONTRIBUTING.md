# Contributing to Kanban

Thanks for taking the time to contribute. This is a small project, so a short,
clear pull request is worth more than a large one.

## Before you start

- **Bugs and small fixes:** open a pull request directly.
- **New features or anything that changes the data model:** open an issue first so
  we can agree on the shape before you write code.
- **Security problems:** do not open a public issue. See [SECURITY.md](SECURITY.md).

## Local setup

Requirements: Node 22+, pnpm 11, and Docker (for Postgres).

```bash
pnpm install
cp .env.example .env          # fill in the values, or use the local Docker DB
pnpm test:db:up               # Postgres 16 on port 5433, plus a kanban_test database
pnpm db:generate              # Prisma client — required before typecheck or tests
pnpm db:deploy                # apply migrations
pnpm dev                      # api + web together
```

The API runs on `http://localhost:4000`, the web app on `http://localhost:5173`.

## Before you open a pull request

Run the same checks CI runs:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

All three must pass. If a test needs a database, make sure `pnpm test:db:up` ran first.

## What a good pull request looks like

- **One change per pull request.** Unrelated refactors make a review slower and riskier.
- **Say why, not just what.** The diff shows what changed; the description explains what problem it solves.
- **Include a test** for a bug fix or new behaviour. Tests live next to the code as `*.test.ts(x)`.
- **Update the docs** if you change setup steps, environment variables, or the HTTP API —
  `docs/` is published, and `.github/workflows/docs-check.yml` will fail on broken links.
- **Migrations are additive.** Add a new migration; do not edit one that is already on `main`.

## Style

Formatting is handled by Prettier (`pnpm format`) and linting by ESLint (`pnpm lint`).
There is no separate style guide — match the file you are editing.

## Commits and branches

- Branch from `main`, named `feat/short-name`, `fix/short-name`, or `docs/short-name`.
- Write commit subjects in the imperative mood: `add card assignees`, not `added card assignees`.
- Pull requests are squash-merged, so the pull request title becomes the commit subject.

## Review

A pull request is merged when CI is green and the change has been read. Expect
feedback rather than silence — if a pull request goes quiet for more than a week,
comment on it and I will look again.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
