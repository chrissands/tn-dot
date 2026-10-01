/**
 * Map block: embeds an ArcGIS Online map or app.
 *
 * Authoring (first cell of each row):
 *   1. link to the map – an ArcGIS web map (…/home/item.html?id=…,
 *      …/apps/mapviewer/index.html?webmap=…) or an ArcGIS app, dashboard or experience
 *   2. optional caption (the link text is the map's accessible name)
 * Variant "tall": 4:3 instead of 16:9 from 900px (always taller on small screens).
 *
 * Web maps are shown in Esri's Instant "minimalist" app (legend, search, zoom). The map
 * loads when the block nears the viewport; a link opens it in a new window. Only ArcGIS
 * hosts are embedded, other links stay plain links.
 */
import { loadPlaceholders, t } from '../../scripts/placeholders.js';

const EMBEDDABLE = /(^|\.)arcgis\.com$/;

/** ArcGIS item type for an item id (public items), or '' */
async function itemType(origin, id) {
  try {
    const resp = await fetch(`${origin}/sharing/rest/content/items/${id}?f=json`);
    const json = resp.ok ? await resp.json() : {};
    return { type: json.type || '', url: json.url || '' };
  } catch (e) {
    return { type: '', url: '' };
  }
}

/**
 * URL to embed for an authored ArcGIS link: web maps in the Instant minimalist app,
 * item pages resolved to their map or app, other app URLs as they are.
 * @param {URL} url authored link
 * @returns {Promise<string>} embed URL
 */
async function embedUrl(url) {
  const instant = (id) => `${url.origin}/apps/instant/minimalist/index.html?webmap=${id}`;
  const webmap = url.searchParams.get('webmap');
  if (webmap && /\/apps\/(mapviewer|Viewer)\//i.test(url.pathname)) return instant(webmap);
  const id = /\/home\/(item|webmap\/viewer)\.html$/.test(url.pathname) && (url.searchParams.get('id') || webmap);
  if (id) {
    const item = await itemType(url.origin, id);
    if (item.type === 'Web Map' || !item.url) return instant(id);
    return item.url;
  }
  return url.href;
}

export default async function decorate(block) {
  const rows = [...block.children];
  const link = block.querySelector('a[href]');
  const captionRow = rows.find((row) => !row.querySelector('a[href]') && row.textContent.trim());
  const caption = captionRow ? captionRow.textContent.trim() : '';
  if (!link) return;

  await loadPlaceholders();
  const url = new URL(link.href);
  const label = link.textContent.trim();
  const title = (label && label !== link.href ? label : caption) || t('map-title', 'Map');

  const figure = document.createElement('figure');
  figure.className = 'map-figure';
  const open = document.createElement('a');
  open.href = url.href;
  open.target = '_blank';
  open.rel = 'noopener';
  open.textContent = t('map-open', 'Open the map in a new window');

  if (EMBEDDABLE.test(url.hostname) && url.protocol === 'https:') {
    const frame = document.createElement('div');
    frame.className = 'map-frame';
    const iframe = document.createElement('iframe');
    iframe.title = title;
    iframe.loading = 'lazy';
    iframe.allow = 'geolocation; fullscreen';
    iframe.setAttribute('allowfullscreen', '');
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.append(iframe);
    figure.append(frame);

    // load the map only when the block nears the viewport
    const observer = new IntersectionObserver(async (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      const src = await embedUrl(url);
      iframe.src = src;
      if (src !== url.href) open.href = src;
    }, { rootMargin: '300px' });
    observer.observe(block);
  }

  if (caption) {
    const figcaption = document.createElement('figcaption');
    figcaption.className = 'map-caption';
    figcaption.textContent = caption;
    figure.append(figcaption);
  }
  const p = document.createElement('p');
  p.className = 'map-open';
  p.append(open);
  figure.append(p);
  block.replaceChildren(figure);
}
