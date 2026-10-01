/* eslint-disable */
/* global WebImporter */

/**
 * Import script for TDOT standard drawings pages (tables of drawing PDFs), e.g.
 * Source: https://www.tn.gov/tdot/state-engineering-technical-training/production-support/standard-drawings-library/standard-roadway-drawings/standard-roadway-title-sheet--abbreviations-and-legends.html
 * Target: same path without /tdot (sanitized), template: left-nav
 *
 * Output
 *   - Section 1: Side Nav (subnav)
 *   - Section 2: H1, "Revised" line, list of jump links (to the table headings)
 *   - per source table: H2 (the table's title row) + Table block (header row: Drawing |
 *     Related IB | Revision Date | Description; empty spacer rows dropped)
 *   - contact text (RTE)
 *   - Metadata: title, description, template
 * Drawing and bulletin PDFs are hosted next to the page (localizeDocuments).
 */
import {
  clean, el, href, buildSideNav, cleanRte, metadata, localizeImages, localizeDocuments,
} from './lib/tn-common.js';

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
const ACRONYMS = new Set(['ib', 'tdot', 'ada', 'dbe', 'ld', 'ped', 'mse']);

/** "STANDARD ROADWAY TITLE SHEET" -> "Standard Roadway Title Sheet" (all-caps source text only) */
function titleCase(text) {
  const t = clean(text);
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().split(' ').map((w, i) => {
    if (ACRONYMS.has(w.replace(/[^a-z]/g, ''))) return w.toUpperCase();
    return i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

/** EDS heading id for a heading text */
const headingId = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Table cell content: links (bold dropped) and text, no layout wrappers */
function cellContent(document, cell) {
  const out = [];
  cell.childNodes.forEach(function walk(node) {
    if (node.nodeType === 3) {
      if (clean(node.textContent)) out.push(clean(node.textContent));
    } else if (node.tagName === 'A' && node.getAttribute('href')) {
      if (clean(node.textContent)) {
        if (out.length) out.push(' ');
        out.push(el(document, 'a', { href: href(node.getAttribute('href')) }, [clean(node.textContent)]));
      }
    } else if (node.tagName === 'BR') {
      if (out.length) out.push(el(document, 'br'));
    } else node.childNodes.forEach(walk);
  });
  while (out.length && out[out.length - 1].tagName === 'BR') out.pop();
  return out.length ? el(document, 'div', {}, out) : '';
}

export default {
  transform: ({ document, params }) => {
    const article = document.querySelector('#main .content article') || document.querySelector('#main article') || document.querySelector('#main');
    const main = el(document, 'div');

    const sideNav = buildSideNav(document);
    if (sideNav) main.append(sideNav, el(document, 'hr'));

    const titleBlock = article.querySelector('.tn-pagetitle');
    const title = clean((titleBlock.querySelector('h1') || document.querySelector('h1')).textContent);
    main.append(el(document, 'h1', {}, [title]));
    const revised = clean([...titleBlock.querySelectorAll('p, div, span')].map((n) => n.textContent).find((t) => /^Revised/i.test(clean(t))) || '');
    if (revised) main.append(el(document, 'p', {}, [revised]));

    // table titles: jump links (#title1, whose empty anchors the importer drops) are
    // matched to the table headings by their text
    const tables = [...article.querySelectorAll('.tn-simpletable table')];
    const headings = tables.map((table) => titleCase((table.querySelector('tr th') || {}).textContent || ''));
    const jumpTarget = (a) => headings.find((h) => h && h.toLowerCase() === titleCase(a.textContent).toLowerCase());

    const COMPONENTS = '.tn-rte, .tn-simpletable';
    [...article.querySelectorAll(COMPONENTS)].filter((c) => !c.parentElement.closest(COMPONENTS)).forEach((part) => {
      if (part.classList.contains('tn-simpletable')) {
        const rows = [...part.querySelectorAll('tr')];
        const titleRow = rows[0] && rows[0].querySelector('th[colspan]') ? rows.shift() : null;
        if (titleRow) main.append(el(document, 'h2', {}, [titleCase(titleRow.textContent)]));
        const cells = rows
          .map((tr) => [...tr.children].map((c) => cellContent(document, c)))
          .filter((r) => r.some((c) => c));
        if (cells.length) {
          cells[0] = cells[0].map((c) => (c ? titleCase(c.textContent) : ''));
          main.append(WebImporter.Blocks.createBlock(document, { name: 'Table', cells }));
        }
      } else {
        const links = [...part.querySelectorAll('a[href^="#"]')];
        if (links.length && links.every(jumpTarget)) {
          // jump links to the tables
          main.append(el(document, 'ul', {}, links.map((a) => el(document, 'li', {}, [
            el(document, 'a', { href: `#${headingId(jumpTarget(a))}` }, [jumpTarget(a)]),
          ]))));
        } else {
          main.append(...cleanRte(document, part));
        }
      }
    });

    const description = `TDOT standard drawings: ${title}. Drawing PDFs with related instructional bulletins and revision dates.`;
    main.append(el(document, 'hr'), metadata(document, { title, description, template: 'left-nav' }));

    const sourcePath = new URL(params.originalURL).pathname.replace(/^\/content\/tn\/+/, '/').replace(/^\/tdot\//, '/').replace(/\.html$/, '');
    const path = WebImporter.FileUtils.sanitizePath(sourcePath);
    const media = localizeImages(main, path);
    const documents = localizeDocuments(main, path);
    return [{ element: main, path, report: { title, tables: tables.length, media, documents } }];
  },
};
