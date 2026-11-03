---
title: Configuration
category:
  uri: Guides
position: 1
slug: configuration
privacy:
  view: public
content:
  excerpt: Environment files, required variables, cookies, origin checks, and the settings that matter in production.
---

## Environment files

Two files exist, and both are gitignored. Only the `*.env.example` templates are tracked.

| File                     | Purpose                                                        |
| :----------------------- | :------------------------------------------------------------- |
| `.env.local` (repo root) | Optional; written by `neon deploy` for Neon connection strings |
| `apps/api/.env`          | Copied from `apps/api/.env.example`; local API settings        |

The API loads `.env.local` first, then `apps/api/.env`. A variable already present in the real
process environment wins over both, which is what hosting platforms use.

## Variables

| Variable                | Where             | Purpose                                                                                                                                  |
| :---------------------- | :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | root `.env.local` | Pooled PostgreSQL connection used by the API                                                                                             |
| `DATABASE_URL_UNPOOLED` | root `.env.local` | Direct connection; mapped to `DIRECT_URL`                                                                                                |
| `DIRECT_URL`            | `apps/api`        | Direct connection for Prisma CLI and migrations; defaults to `DATABASE_URL_UNPOOLED`, then `DATABASE_URL`                                |
| `JWT_SECRET`            | `apps/api`        | HS256 signing secret, **32+ characters**. Generate your own; never commit it                                                             |
| `PORT`                  | `apps/api`        | API port, default `4000`                                                                                                                 |
| `CLIENT_ORIGIN`         | `apps/api`        | Allowed browser origin(s), comma-separated. Drives CORS, Origin checks, and Socket.IO                                                    |
| `PUBLIC_URL`            | `apps/api`        | Public origin for OAuth metadata and `/mcp`. Defaults to the first `CLIENT_ORIGIN` in production, `http://localhost:PORT` in development |
| `NODE_ENV`              | `apps/api`        | `development`, `test`, or `production`. Production serves the built SPA and enables secure cookies on HTTPS                              |
| `TEST_DATABASE_URL`     | `apps/api`        | Database used by the Vitest setup; defaults to the local `kanban_test` database                                                          |

Generate a production secret with any cryptographically random source:

```bash
openssl rand -base64 48
```

## Cookies and sessions

- The session cookie is named `kanban_session`, is `httpOnly`, and lasts seven days.
- `SameSite=Lax` means the web app and API must share a site. Host them on one origin, or use
  subdomains of the same registrable domain.
- Cookies are marked `Secure` only when every configured origin starts with `https://`, which
  keeps local production-mode testing on `http://localhost` working.

## Origins

`CLIENT_ORIGIN` accepts a comma-separated list. In development and test, loopback origins on any
port are accepted when the configured origin is also loopback, so Vite on `:5173` can talk to the
API on `:4000`.

State-changing requests with a browser `Origin` header outside the allowlist are rejected with
`403 BAD_ORIGIN`. Requests without an `Origin` header, such as server-to-server calls from the MCP
server, are allowed.

## Rate limiting

`/api/auth/*` is limited to **30 requests per minute per IP**, excluding the availability check.
Login, registration, and the session check (`GET /api/auth/me`) count toward it. A client that
repeatedly restarts and re-authenticates can hit the limit; wait a minute and retry.

`GET /api/auth/availability` has its own **60 requests per minute per IP** budget and returns
`Cache-Control: no-store`, so a user typing into the sign-up form does not exhaust the login limit.

## Remote MCP and OAuth

The API also hosts the remote MCP endpoint at `/mcp` and the OAuth metadata and endpoints. Set
`PUBLIC_URL` to the app's public HTTPS origin if it differs from the first `CLIENT_ORIGIN`. The
value is used for `/.well-known/oauth-protected-resource`, the authorization-server metadata, the
`/oauth` endpoints, and the consent redirects.

OAuth clients are registered dynamically; access tokens live for one hour and refresh tokens for
30 days. The consent page runs on `PUBLIC_URL`, so that origin must be reachable and allowed by
`CLIENT_ORIGIN` (the API adds `PUBLIC_URL` automatically).

`/oauth/register`, `/oauth/token`, and `/mcp` are exempt from the browser origin guard because they
authenticate with OAuth tokens rather than the session cookie. OAuth clients such as Hermes may
send their local callback origin on those requests. The consent POST to `/oauth/authorize` is
protected by a signed, short-lived consent token instead of the Origin header, so it also works from
sandboxed OAuth browsers that send `Origin: null`.

The consent page's CSP allows form redirects to HTTPS and loopback callback origins, so the browser
can return to the OAuth client after **Allow access**.

## Development and production

In development, the API runs on port `4000` and Vite proxies `/api`, `/socket.io`, `/oauth`, and
`/.well-known` to it, so the session cookie, OAuth consent, and WebSocket share one host.

In production, set `NODE_ENV=production`. The API then serves `apps/web/dist` and the WebSocket on
the same origin and enables `Secure` cookies when the configured origins are HTTPS.
