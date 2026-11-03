#!/usr/bin/env node
/**
 * Offline check for the ReadMe guides in `docs/readme/`.
 *
 * ReadMe's own dry run (`pnpm docs:validate`) needs a project API key. This check catches
 * structural mistakes before a project exists: missing frontmatter, unknown categories,
 * duplicate slugs, empty pages, and links to pages that are not part of the site.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const docsDir = path.join(root, 'docs/readme');
const allowedCategories = new Set(['Getting Started', 'Guides', 'AI & MCP']);

function unquote(value) {
  const trimmed = String(value ?? '').trim();
  const quoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));
  return quoted ? trimmed.slice(1, -1) : trimmed;
}

/** Minimal frontmatter reader for the flat, known shape used by these pages. */
function readFields(frontmatter) {
  const fields = {};
  let section;

  for (const line of frontmatter.split('\n')) {
    const top = /^([a-z]+):\s*(.*)$/.exec(line);
    if (top) {
      section = top[1];
      fields[section] = top[2] || {};
      continue;
    }

    const nested = /^ {2}([a-z]+):\s*(.*)$/.exec(line);
    if (nested && section && typeof fields[section] === 'object') {
      fields[section][nested[1]] = nested[2];
    }
  }

  return fields;
}

const problems = [];
const pages = [];
const seenSlugs = new Set();

function fail(file, message) {
  problems.push(`${file}: ${message}`);
}

for (const file of readdirSync(docsDir)
  .filter((name) => name.endsWith('.md'))
  .sort()) {
  const raw = readFileSync(path.join(docsDir, file), 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);

  if (!match) {
    fail(file, 'missing YAML frontmatter');
    continue;
  }

  const fields = readFields(match[1]);
  const body = match[2];
  const title = unquote(fields.title);
  const category = unquote(fields.category?.uri);
  const slug = unquote(fields.slug);
  const position = fields.position;
  const privacy = unquote(fields.privacy?.view);
  const excerpt = unquote(fields.content?.excerpt);

  if (!title) fail(file, 'missing title');
  if (!category) fail(file, 'missing category.uri');
  else if (!allowedCategories.has(category)) fail(file, `unknown category "${category}"`);
  if (!slug) fail(file, 'missing slug');
  else if (seenSlugs.has(slug)) fail(file, `duplicate slug "${slug}"`);
  else seenSlugs.add(slug);
  if (position === undefined || Number.isNaN(Number(position))) {
    fail(file, 'missing or invalid position');
  }
  if (privacy !== 'public') fail(file, 'privacy.view must be public');
  if (!excerpt) fail(file, 'missing content.excerpt');
  if (!body.trim()) fail(file, 'empty body');

  pages.push({ file, slug, body });
}

const knownSlugs = new Set(pages.map((page) => page.slug));

for (const page of pages) {
  for (const link of page.body.matchAll(/\]\(\/docs\/([a-z0-9-]+)(?:[#?][^)]*)?\)/g)) {
    if (!knownSlugs.has(link[1])) {
      fail(page.file, `internal link /docs/${link[1]} has no matching page`);
    }
  }
}

if (problems.length > 0) {
  console.error(`ReadMe docs check failed with ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `ReadMe docs OK: ${pages.length} pages (${pages.map((page) => page.slug).join(', ')}).`,
);
