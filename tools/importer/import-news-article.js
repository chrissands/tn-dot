/* eslint-disable */
/* global WebImporter */

/**
 * Import script for TDOT newsroom articles.
 * Source: https://www.tn.gov/tdot/news/{yyyy}/{m}/{d}/{slug}.html
 * Target: /news/{yyyy}/{m}/{d}/{slug}
 *
 * Output: default content only
 *   - H1 title, optional H2 subtitle
 *   - article body (paragraphs, inline formatting, links, images)
 *   - Metadata: title, description, publication-date, category, template, image, subtitle
 * The date line is rendered by the news-article template from "publication-date".
 *
 * news-articles.json maps source paths to target paths + newsroom filter categories
 * (collected from the source's filter pages) and is used to rewrite links between
 * migrated articles.
 */
import NEWS from './news-articles.json';

const ORIGIN = 'https://www.tn.gov';
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();

/** EDS document-name sanitizing (lowercase, [a-z0-9-], no leading/trailing dashes). */
function sanitize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Maps a source path to its migrated path (articles in scope, the newsroom listing). */
function mapPath(pathname) {
  const p = pathname.replace(/^\/content\/tn\/+/, '/');
  if (NEWS.articles[p]) return NEWS.articles[p].path;
  if (/^\/tdot\/news(\.html)?$/.test(p)) return '/news';
  return null;
}

function rewriteLinks(root) {
  root.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (/^(mailto:|tel:|#)/i.test(href)) return;
    let url;
    try { url = new URL(href, ORIGIN); } catch (e) { return; }
    if (url.hostname === 'www.tn.gov' || url.hostname === 'tn.gov') {
      const mapped = mapPath(url.pathname);
      if (mapped) {
        a.setAttribute('href', `${mapped}${url.search}${url.hash}`);
        return;
      }
      url.pathname = url.pathname.replace(/^\/content\/tn\/+/, '/');
      a.setAttribute('href', url.href);
    }
  });
}

/** "Monday, September 28, 2026 | 01:05pm" -> "2026-09-28T13:05:00" (US Central, as published) */
function parseDate(text) {
  const m = clean(text).toLowerCase().match(/([a-z]+)\s+(\d{1,2}),\s*(\d{4})(?:\s*\|\s*(\d{1,2}):(\d{2})\s*(am|pm))?/);
  if (!m) return '';
  const month = MONTHS.indexOf(m[1]) + 1;
  if (!month) return '';
  let hour = m[4] ? Number(m[4]) % 12 : 0;
  if (m[6] === 'pm') hour += 12;
  const pad = (n) => String(n).padStart(2, '0');
  return `${m[3]}-${pad(month)}-${pad(m[2])}T${pad(hour)}:${m[5] || '00'}:00`;
}

function cleanBody(document, body) {
  // tracking scripts, Word bookmarks, float/clear helpers
  body.querySelectorAll('script, style, noscript, a.anchor:not([href]), .clear').forEach((e) => e.remove());
  // image components -> plain image paragraphs
  body.querySelectorAll('.tn-textandimage').forEach((ti) => {
    const nodes = [];
    ti.querySelectorAll('img').forEach((img) => {
      const copy = document.createElement('img');
      copy.src = new URL(img.getAttribute('src'), ORIGIN).href;
      copy.alt = clean(img.getAttribute('alt') || '');
      const p = document.createElement('p');
      p.append(copy);
      nodes.push(p);
    });
    ti.querySelectorAll('.tn-rte, p').forEach((el) => { if (clean(el.textContent)) nodes.push(el); });
    ti.replaceWith(...nodes);
  });
  // unwrap layout/rich-text wrappers, keep their content in order
  body.querySelectorAll('.tn-rte, div').forEach((d) => d.replaceWith(...d.childNodes));
  // Word/inline styling spans carry no meaning
  body.querySelectorAll('span').forEach((s) => s.replaceWith(...s.childNodes));
  body.querySelectorAll('[style], [class], [id]').forEach((e) => {
    e.removeAttribute('style'); e.removeAttribute('class'); e.removeAttribute('id');
  });
  // drop empty paragraphs (keep ones holding media)
  body.querySelectorAll('p').forEach((p) => {
    if (!clean(p.textContent.replace(/ /g, ' ')) && !p.querySelector('img, picture')) p.remove();
  });
  rewriteLinks(body);
}

export default {
  transform: ({ document, params }) => {
    const source = new URL(params.originalURL);
    const sourcePath = source.pathname.replace(/^\/content\/tn\/+/, '/');
    const entry = NEWS.articles[sourcePath];
    const m = sourcePath.match(/^\/tdot\/news\/(\d{4})\/(\d{1,2})\/(\d{1,2})\/(.+)\.html$/);
    const path = entry ? entry.path : `/news/${m[1]}/${m[2]}/${m[3]}/${sanitize(m[4])}`;

    const article = document.querySelector('#main .content article') || document.querySelector('#main article');
    const main = document.createElement('div');

    const title = clean((article.querySelector('.tn-pagetitle h1') || document.querySelector('h1')).textContent);
    const h1 = document.createElement('h1');
    h1.textContent = title;
    main.append(h1);

    const subtitleEl = article.querySelector('.tn-pagetitle .subtitle');
    const subtitle = subtitleEl ? clean(subtitleEl.textContent) : '';
    if (subtitle) {
      const h2 = document.createElement('h2');
      h2.textContent = subtitle;
      main.append(h2);
    }

    const dateText = clean((article.querySelector('.date') || {}).textContent);
    const body = article.querySelector(':scope > div:not(.tn-pagetitle):not(.date)') || document.createElement('div');
    cleanBody(document, body);
    main.append(...body.childNodes);

    const firstText = [...main.querySelectorAll('p')].map((p) => clean(p.textContent)).find((t) => t.length > 40) || '';
    const description = firstText.length > 160 ? `${firstText.slice(0, 157).replace(/\s+\S*$/, '')}…` : firstText;
    const firstImg = main.querySelector('img');

    // metadata keys use the normalized (meta name) form so local preview and
    // published pages expose the same <meta> names
    const meta = {
      title,
      description,
      'publication-date': parseDate(dateText),
      category: (entry ? entry.categories : []).join(', '),
      template: 'news-article',
    };
    if (subtitle) meta.subtitle = subtitle;
    if (firstImg) {
      const img = document.createElement('img');
      img.src = firstImg.src;
      img.alt = firstImg.alt;
      meta.image = img;
    }
    // metadata in its own section
    main.append(document.createElement('hr'), WebImporter.Blocks.getMetadataBlock(document, meta));

    return [{
      element: main,
      path,
      report: { title, date: meta['publication-date'], categories: meta.category, images: main.querySelectorAll('img').length },
    }];
  },
};
