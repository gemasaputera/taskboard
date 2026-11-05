import { useEffect } from 'react';

/**
 * The canonical public origin. Keep in sync with `landing.html`, `robots.txt`,
 * `sitemap.xml`, and the README deployment notes.
 */
export const SITE_URL = 'https://kanban-board-p4kk.onrender.com';

interface SeoOptions {
  /** Full document title, including the brand suffix. */
  title: string;
  description?: string;
  /** Absolute path for the canonical URL; omit for private or transient pages. */
  path?: string;
  /** Defaults to `index, follow`. Private app pages pass `noindex, nofollow`. */
  robots?: string;
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(href: string | null) {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    existing?.remove();
    return;
  }

  const link = existing ?? document.createElement('link');
  link.rel = 'canonical';
  link.href = href;
  if (!existing) document.head.appendChild(link);
}

/**
 * Keeps the document head correct across the client-rendered routes. The public
 * landing page is static HTML; these tags cover the SPA routes it links to.
 */
export function useSeo({ title, description, path, robots = 'index, follow' }: SeoOptions) {
  useEffect(() => {
    document.title = title;
    setMeta('name', 'robots', robots);

    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
      setMeta('name', 'twitter:description', description);
    }

    setMeta('property', 'og:title', title);
    setMeta('name', 'twitter:title', title);

    if (path) {
      const url = `${SITE_URL}${path}`;
      setCanonical(url);
      setMeta('property', 'og:url', url);
    } else {
      setCanonical(null);
      document.head.querySelector('meta[property="og:url"]')?.remove();
    }
  }, [title, description, path, robots]);
}
