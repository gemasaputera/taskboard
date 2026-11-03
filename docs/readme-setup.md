# Publishing the docs to ReadMe

The `docs/readme/` directory contains the guides that publish to
[ReadMe](https://readme.com). This is the one-time setup.

This repository publishes to **<https://kanbantask.readme.io>**. Follow these steps to point a fork
at a different project.

Each file is a normal Markdown page with ReadMe frontmatter. `rdme`, ReadMe's official CLI, uploads
the directory to your project. A GitHub Action keeps it in sync after that.

```
docs/readme/*.md  ──rdme──>  ReadMe project  ──>  https://your-project.readme.io
```

## What gets published

| File               | ReadMe category | Slug                  |
| :----------------- | :-------------- | :-------------------- |
| `welcome.md`       | Getting Started | `/docs/welcome`       |
| `quickstart.md`    | Getting Started | `/docs/quickstart`    |
| `concepts.md`      | Guides          | `/docs/concepts`      |
| `configuration.md` | Guides          | `/docs/configuration` |
| `deployment.md`    | Guides          | `/docs/deployment`    |
| `rest-api.md`      | Guides          | `/docs/rest-api`      |
| `mcp.md`           | AI & MCP        | `/docs/mcp`           |
| `mcp-tools.md`     | AI & MCP        | `/docs/mcp-tools`     |
| `mcp-clients.md`   | AI & MCP        | `/docs/mcp-clients`   |

## One-time ReadMe setup

### 1. Create a project

1. Sign up at <https://dash.readme.com/signup>.
2. Create a project and choose **Start from scratch**.
3. Note the subdomain: `https://your-project.readme.io`.

New projects use ReadMe's **Refactored** architecture, which requires `rdme@10` (the version this
repo uses). If you have an older project on the legacy architecture, either create a new project or
follow [ReadMe's migration guide](https://github.com/readmeio/rdme/blob/v10/documentation/migration-guide.md).

### 2. Create the three guide categories

`rdme` creates pages, but **not categories**. In your ReadMe docs editor, open the sidebar and
create these three categories under **Guides**:

| Category title    | `category.uri` value (exact title) |
| :---------------- | :--------------------------------- |
| `Getting Started` | `Getting Started`                  |
| `Guides`          | `Guides`                           |
| `AI & MCP`        | `AI & MCP`                         |

ReadMe derives a category's URI from its title, so the frontmatter uses the **exact title**, not a
kebab-case slug. If you rename a category, update `category.uri` in the affected files. A new
project may already have a **Getting Started** category — reuse it if its title matches.

### 3. Create an API key

1. In the project dashboard, open **Configuration → API Keys**.
2. Create a key and copy it. It starts with `rdme_`.
3. Keep it out of git. This repository ignores `.env`, `.env.*`, `*.local`, and `.kanban-mcp`.

## Publish locally

```bash
export README_API_KEY=rdme_your_key_here

pnpm docs:check       # offline: frontmatter, slugs, and internal links (no key)
pnpm docs:validate    # ReadMe dry run: validates frontmatter and previews changes
pnpm docs:publish     # creates or updates the pages in ReadMe
```

`rdme` reads `README_API_KEY` (or `RDME_API_KEY`) from the environment automatically. If neither is
set, it prompts you to sign in instead.

### Activate the project

A new ReadMe project can show a **Not Yet Active** page at its subdomain until the account
onboarding or plan trial is activated. The pages are still created — readers just cannot open them
yet.

1. Open <https://dash.readme.com/project/kanbantask> (or your own project).
2. Complete the onboarding checklist and start the Pro trial or choose the Starter plan.
3. Reload <https://kanbantask.readme.io/docs/welcome>.

Admins and editors can use the **Admin and Editor Login** link on the Not Yet Active page to preview
the docs while the project is inactive.

> 📘 `pnpm docs:check` works before you create a ReadMe project. It is also what the pull-request
> workflow runs, so broken frontmatter or links are caught before anything is published.

Open your project after the upload:

```
https://your-project.readme.io/docs/welcome
```

### What the commands do

| Command              | Under the hood                                                    |
| :------------------- | :---------------------------------------------------------------- |
| `pnpm docs:check`    | `node scripts/validate-readme-docs.mjs` — no network, no key      |
| `pnpm docs:validate` | `npx rdme@10 docs upload ./docs/readme --branch=stable --dry-run` |
| `pnpm docs:publish`  | `npx rdme@10 docs upload ./docs/readme --branch=stable`           |

`--branch=stable` targets the project's stable version. If you use a versioned project, pass your
version instead, for example `--branch=1.0`.

## Automate with GitHub Actions

The workflow at [`.github/workflows/readme-sync.yml`](../.github/workflows/readme-sync.yml) uploads
`docs/readme/` whenever those files change on `main`, and can also be run manually. It runs the
offline check before uploading.

1. In GitHub, open **Settings → Secrets and variables → Actions**.
2. Add a repository secret named **`README_API_KEY`** with your project API key.
3. Push a change under `docs/readme/` to `main`.

Pull requests that touch the docs run
[`docs-check.yml`](../.github/workflows/docs-check.yml), which needs no secret.

The workflow uses `readmeio/rdme@v10`. You can also trigger it from **Actions → Sync docs to
ReadMe → Run workflow**.

> 🚧 **Do not put the key in `.mcp.json`, a Markdown file, or any committed config.** Use the
> GitHub secret or your shell environment.

## Editing and adding pages

Every page needs frontmatter:

```yaml
---
title: Page title
category:
  uri: guides
position: 2
slug: my-page
privacy:
  view: public
content:
  excerpt: One sentence that appears in search results and previews.
---
Page body in Markdown.
```

| Field             | Required            | Notes                                                        |
| :---------------- | :------------------ | :----------------------------------------------------------- |
| `title`           | yes                 | Sidebar and page title                                       |
| `category.uri`    | yes on first upload | The category slug, e.g. `guides`                             |
| `position`        | no                  | Order within the category; lower numbers appear first        |
| `slug`            | no                  | URL path. Defaults to the filename                           |
| `privacy.view`    | no                  | `public` publishes the page; omit to keep the ReadMe default |
| `content.excerpt` | no                  | Short summary for search and previews                        |

To add a page, create a new Markdown file in `docs/readme/`, give it a unique `slug`, then run
`pnpm docs:publish`. To remove a page from ReadMe, delete it in the ReadMe dashboard — `rdme`
creates and updates pages but does not delete pages that disappear from the folder.

If you add a new category, also add its title to `allowedCategories` in
`scripts/validate-readme-docs.mjs` so the offline check keeps passing.

### Images

The guides reference screenshots from the repository:

```
https://raw.githubusercontent.com/gemasaputera/taskboard/main/docs/board.png
```

Raw GitHub URLs only work while the repository is public. For a private repository, upload the
images in ReadMe's editor (or its image API) and replace the URLs in the Markdown.

### Matching pages to ReadMe

`rdme` matches existing pages by **slug**. Keep a page's filename or explicit `slug` stable after
the first publish, or you will create a second page instead of updating the existing one.

## Customize the site

After the first upload, use the ReadMe dashboard for the parts that are not stored in git:

- **Appearance** — logo, colors, typography, and dark mode
- **Navigation** — category order and page icons
- **Custom domain** — e.g. `docs.example.com` (availability depends on your plan)
- **Ask AI / search** — ReadMe's AI features for the published hub
- **Access** — public, password-protected, or private docs

## Troubleshooting

### `Looks like you're missing a ReadMe API key`

Set `README_API_KEY` in your shell, or run `npx rdme@10 login` once. The dry run also needs a key,
because it resolves categories against the project.

### `401 Unauthorized`

The key is wrong, revoked, or belongs to another project. Create a new key under
**Configuration → API Keys** and update your shell or the GitHub secret.

### `Category not found` / pages land in the wrong place

Create the category in the ReadMe sidebar first, or change `category.uri` to the title of an
existing category. ReadMe builds the URI from the URL-encoded title, so
`GET https://api.readme.com/v2/branches/stable/categories/guides` returns something like
`/branches/stable/categories/guides/Getting%20Started`.

Use the exact title in frontmatter:

```yaml
category:
  uri: Getting Started
```

If the short title is not resolved, use the full URI from that response instead:

```yaml
category:
  uri: /branches/stable/categories/guides/Getting%20Started
```

### `This project is on the legacy architecture`

`rdme@10` only works with Refactored projects. Create a new project, or use `rdme@9` and adapt the
commands for the legacy layout.

### The GitHub Action does not run

- The push must touch `docs/readme/**` and target `main`.
- `README_API_KEY` must exist as an Actions secret.
- Check the workflow run under the repository's **Actions** tab for the `readmeio/rdme@v10` output.

### Pages publish but images are broken

The raw GitHub URLs require a public repository. Upload the screenshots to ReadMe and update the
Markdown with the new URLs.

### Dry run passes but the real upload fails

The dry run validates frontmatter without writing pages; the real upload also needs permission to
create pages in the project. Confirm the key belongs to the project you are targeting and that the
categories exist.

## Related

- [ReadMe: syncing docs via CLI and GitHub](https://docs.readme.com/main/docs/rdme)
- [ReadMe: creating and managing guides](https://docs.readme.com/main/docs/creating-and-managing-guides)
- [ReadMe: API keys](https://docs.readme.com/main/reference/authentication)
- [ReadMe pricing](https://readme.com/pricing)
