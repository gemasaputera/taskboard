# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub's private vulnerability reporting:

> [github.com/gemasaputera/taskboard/security/advisories/new](https://github.com/gemasaputera/taskboard/security/advisories/new)

That channel is private between you and the maintainer, and it gives us a place
to discuss the fix and coordinate disclosure.

Please include:

- what the problem is and where it lives (file, route, or component);
- how to reproduce it, ideally with the smallest steps that show the issue;
- who can trigger it — an anonymous visitor, a signed-in member, or a workplace admin;
- what an attacker gains: read access, write access, or denial of service.

## What to expect

- **Acknowledgement within 3 days.** If you have not heard back, ping the issue
  thread or the maintainer directly on GitHub.
- **An assessment within 10 days**, including whether we consider it in scope and
  roughly when a fix will land.
- **Credit in the advisory** once a fix ships, unless you would rather stay anonymous.

## Supported versions

Only the `main` branch and the current deployment are supported. This project does
not backport fixes to older commits — a fix lands on `main` and is deployed from there.

## In scope

- Authentication and session handling (JWT, OAuth, cookies).
- Authorisation: a member of one workplace reaching another workplace's board or cards.
- The invitation flow.
- The MCP endpoint and any token handling around it.
- Injection, XSS, and anything that lets a user run code on the server.

## Out of scope

- Reports from automated scanners with no demonstrated impact.
- Missing hardening headers with no exploit path.
- Anything that requires the attacker to already have full control of the server
  or the database.
- Denial of service through obviously unbounded input on a demo deployment.

## Handling a leaked secret

If a secret is committed, rotate it first, then open a private advisory. Rotation
matters more than removing the line from history, because the old value stays valid
until it is rotated.
