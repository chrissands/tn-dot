/**
 * Fetches a site document (fragment, index) from wherever the page is served.
 *
 * The local preview serves documents under /content (e.g. /content/nav.plain.html);
 * published sites (aem.page / aem.live) serve them at the root (/nav.plain.html).
 * The location matching the current page is tried first, the other one only as a
 * fallback, so the published site makes a single request and logs no 404s.
 */

/** True when the page itself is served from the local preview's /content tree. */
export const isLocalPreview = () => /^\/content(\/|$)/.test(window.location.pathname);

/**
 * @param {string} path site path, e.g. '/nav.plain.html' or '/news/query-index.json'
 * @returns {Promise<Response>} the first OK response, else the last response
 */
export async function fetchContent(path) {
  const local = `/content${path}`;
  const [first, fallback] = isLocalPreview() ? [local, path] : [path, local];
  const resp = await fetch(first);
  return resp.ok ? resp : fetch(fallback);
}
