/**
 * Newsroom helpers shared by the news listing (collection block), the homepage
 * news cards and the news-article template.
 */

import { toClassName } from './aem.js';
import { fetchContent, isLocalPreview, localMediaUrl } from './content-fetch.js';

const DEFAULT_INDEX = '/news/query-index.json';
const cache = {};

/**
 * Fetches the news index, sorted newest first.
 * Published index on the published site, the /content/... copy in local preview
 * (each falling back to the other, see fetchContent).
 * @param {string} [source] index path
 * @returns {Promise<Array<object>>}
 */
export async function fetchNewsIndex(source = DEFAULT_INDEX) {
  const path = new URL(source, window.location.origin).pathname;
  if (!cache[path]) {
    cache[path] = (async () => {
      const resp = await fetchContent(path);
      if (!resp.ok) return [];
      const json = await resp.json();
      return (json.data || [])
        .filter((item) => item.path && item.title)
        .map((item) => ({
          ...item,
          // pages without an image get EDS's default og:image placeholder in the
          // published index; treat it as "no image" so callers can fall back
          image: /default-meta-image/.test(item.image || '') ? '' : localMediaUrl(item.image || ''),
          categories: (item.category || '').split(',').map((c) => c.trim()).filter(Boolean),
        }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    })();
  }
  return cache[path];
}

/** Category name -> URL id (matches the newsroom sidebar links). */
export function categoryId(name) {
  return toClassName(name);
}

/**
 * Formats a publication date like the source newsroom:
 * "Monday, September 28, 2026" and "01:05pm".
 * @param {string} iso "2026-09-28T13:05:00" (US Central, as published)
 */
export function formatNewsDate(iso) {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return { date: iso || '', time: '' };
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  const date = d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: '2-digit', timeZone: 'UTC',
  });
  if (!m[4]) return { date, time: '' };
  const hour = Number(m[4]);
  const h12 = String(hour % 12 || 12).padStart(2, '0');
  return { date, time: `${h12}:${m[5]}${hour < 12 ? 'am' : 'pm'}` };
}

/**
 * Local preview serves imported pages under /content; published pages live at the root.
 * @param {string} path index path, e.g. /news/2026/9/28/slug
 */
export function newsHref(path) {
  return isLocalPreview() ? `/content${path}` : path;
}
