/* eslint-disable */
/* global WebImporter */
/**
 * Parser for columns-media. Base: columns (existing block, variant class "media").
 * Source: https://www.tn.gov/tdot.html  Generated: 2026-09-29
 *
 * Emits DA table "Columns (media)": ONE row x 2 cells
 *   [linked image + linked H3] | [paragraph with bold phrases]
 *
 * Selectors validated against migration-work/block-context/columns-media/source.html:
 *   .row.parsys_column > .parsys_column  - cells (column-1..2)
 *   .tn-image a > img                    - linked image
 *   .tn-rte h4 > a                       - linked caption heading (-> H3)
 *   .tn-rte p                            - description paragraph
 */
const clean = (s) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

function buildCell(col, document) {
  const out = [];
  const nodes = [...col.querySelectorAll('img, h1, h2, h3, h4, h5, h6, p, ul, ol')]
    .filter((n, i, arr) => !arr.some((o) => o !== n && o.contains(n)));

  nodes.forEach((n) => {
    if (n.tagName === 'IMG') {
      const link = n.closest('a[href]');
      const p = document.createElement('p');
      if (link) {
        const a = document.createElement('a');
        a.href = link.getAttribute('href');
        a.append(n);
        p.append(a);
      } else {
        p.append(n);
      }
      out.push(p);
      return;
    }
    if (!clean(n.textContent)) return;
    if (/^H[1-6]$/.test(n.tagName)) {
      const h = document.createElement('h3');
      const link = n.querySelector('a[href]');
      if (link) {
        const a = document.createElement('a');
        a.href = link.getAttribute('href');
        a.textContent = clean(link.textContent);
        h.append(a);
      } else {
        h.textContent = clean(n.textContent);
      }
      out.push(h);
      return;
    }
    out.push(n);
  });
  return out;
}

export default function parse(element, { document }) {
  let columns = [...element.querySelectorAll('.row.parsys_column > .parsys_column')];
  if (!columns.length) columns = [...element.querySelectorAll('[class*="column-"]')];

  const row = columns.map((col) => buildCell(col, document)).filter((c) => c.length);

  if (!row.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'Columns', variants: ['media'], cells: [row] });
  element.replaceWith(block);
}
