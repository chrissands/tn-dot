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
 * Local preview has no access to content.da.live (it needs a login): maps a Document
 * Authoring media URL to the local copy - /content/images/<file> for a document's media
 * folder (/.nav/x.png, /news/.../.<page>/x.png), else /content/<path>.
 * @param {string} src image URL
 * @returns {string} local URL in local preview, else src unchanged
 */
export function localMediaUrl(src) {
  const m = isLocalPreview() && src.match(/^https:\/\/content\.da\.live\/[^/]+\/[^/]+(\/.*)$/);
  if (!m) return src;
  const media = m[1].match(/\/\.[a-z0-9-]+\/([^/]+)$/);
  return media ? `/content/images/${media[1]}` : `/content${m[1]}`;
}

/**
 * Local preview: points the Document Authoring images in a container at their local copies.
 * @param {Element} root container
 */
export function localizeMedia(root) {
  if (!isLocalPreview()) return;
  root.querySelectorAll('img[src], source[srcset]').forEach((el) => {
    if (el.hasAttribute('src')) el.src = localMediaUrl(el.getAttribute('src'));
    if (el.hasAttribute('srcset')) el.srcset = localMediaUrl(el.getAttribute('srcset').split(/\s/)[0]);
  });
}

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
