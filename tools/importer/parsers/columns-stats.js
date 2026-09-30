/* eslint-disable */
/* global WebImporter */
/**
 * Parser for columns-stats. Base: columns (existing block, variant class "stats").
 * Source: https://www.tn.gov/tdot.html  Generated: 2026-09-29
 *
 * Emits DA table "Columns (stats)": 2 rows x 4 cells; each cell = H3 number + link label paragraph.
 * The stats span TWO source containers:
 *   row 1: this element  (#main > div:nth-of-type(2) > div.columnctrl:nth-of-type(9))
 *   row 2: its next sibling div.columnctrl (tagged [data-excat-stats-tail] by tdot-cleanup.js,
 *          originally nth-of-type(10)).
 * The tail's content is emptied here (the element itself is kept so later :nth-of-type
 * selectors do not shift); tdot-cleanup.js afterTransform removes the empty remnant.
 *
 * Selectors validated against migration-work/block-context/columns-stats/source.html:
 *   .row.parsys_column > .parsys_column  - stat cells (column-1..4)
 *   .tn-rte h3 (strong)                  - number
 *   .tn-rte p a                          - label link (<u> wrapper dropped)
 */
const TAIL_ATTR = 'data-excat-stats-tail';
const clean = (s) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

function getColumns(container) {
  let cols = [...container.querySelectorAll('.row.parsys_column > .parsys_column')];
  if (!cols.length) cols = [...container.querySelectorAll('[class*="column-"]')];
  return cols;
}

function buildRow(container, document) {
  return getColumns(container).map((col) => {
    const cell = [];
    const numberSrc = [...col.querySelectorAll('h1, h2, h3, h4, h5, h6, strong')].find((n) => clean(n.textContent));
    if (numberSrc) {
      const h3 = document.createElement('h3');
      h3.textContent = clean(numberSrc.textContent);
      cell.push(h3);
    }
    [...col.querySelectorAll('a[href]')].filter((a) => clean(a.textContent)).forEach((src) => {
      const a = document.createElement('a');
      a.href = src.getAttribute('href');
      a.textContent = clean(src.textContent);
      const p = document.createElement('p');
      p.append(a);
      cell.push(p);
    });
    return cell;
  }).filter((cell) => cell.length);
}

function looksLikeStats(el) {
  if (!el || !el.matches('div.columnctrl, div.colctrl')) return false;
  const cols = getColumns(el);
  return cols.length > 0 && !el.querySelector('h2')
    && cols.every((c) => c.querySelector('h3, strong') && c.querySelector('a[href]'));
}

function findTail(element) {
  // Preferred: tagged by the cleanup transformer
  const parent = element.parentElement;
  const tagged = parent && parent.querySelector(`:scope > [${TAIL_ATTR}]`);
  if (tagged && tagged !== element) return tagged;
  // Fallback: next element sibling that is a div (skip <hr> section breaks) and looks like stats
  let sib = element.nextElementSibling;
  while (sib && sib.tagName !== 'DIV') sib = sib.nextElementSibling;
  return looksLikeStats(sib) ? sib : null;
}

export default function parse(element, { document }) {
  const cells = [];
  const row1 = buildRow(element, document);
  if (row1.length) cells.push(row1);

  const tail = findTail(element);
  if (tail) {
    const row2 = buildRow(tail, document);
    if (row2.length) {
      // pad to equal column count
      const width = Math.max(row1.length, row2.length);
      cells.forEach((r) => { while (r.length < width) r.push(''); });
      while (row2.length < width) row2.push('');
      cells.push(row2);
    }
    // Empty the tail so its content is not imported twice (keep the node: preserves nth-of-type)
    tail.textContent = '';
  }

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'Columns', variants: ['stats'], cells });
  element.replaceWith(block);
}
