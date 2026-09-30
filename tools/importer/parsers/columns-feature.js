/* eslint-disable */
/* global WebImporter */
/**
 * Parser for columns-feature. Base: columns (existing block, variant class "feature").
 * Source: https://www.tn.gov/tdot.html  Generated: 2026-09-29
 *
 * Emits DA table "Columns (feature)": ONE row x 3 cells
 *   [H2 + intro paragraph] | [H3 + text + button, H3 + text + button] | [same]
 * Buttons use the bold-link convention (<p><strong><a/></strong></p>).
 *
 * Selectors validated against migration-work/block-context/columns-feature/source.html:
 *   .row.parsys_column > .parsys_column  - column cells (column-1..3)
 *   .tn-rte h2/h4/p                      - headings/text (&nbsp; spacer headings/paragraphs skipped)
 *   .tn-linkbuttons a.button             - orange buttons
 *   .bgimg > img                         - section background, moved to Section Metadata by
 *                                          tdot-sections.js -> EXCLUDED here
 */
const clean = (s) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

function buildCell(col, document) {
  const out = [];
  const nodes = [...col.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, a.button, .tn-linkbuttons a')]
    // skip nested matches (e.g. p inside li, a inside p) and the background image wrapper
    .filter((n) => !n.closest('.bgimg > img'))
    .filter((n, i, arr) => !arr.some((o) => o !== n && o.contains(n)));

  nodes.forEach((n) => {
    if (!clean(n.textContent)) return;
    if (/^H[1-6]$/.test(n.tagName)) {
      const level = n.tagName === 'H1' || n.tagName === 'H2' ? 'h2' : 'h3';
      const h = document.createElement(level);
      h.textContent = clean(n.textContent);
      out.push(h);
    } else if (n.tagName === 'A') {
      const a = document.createElement('a');
      a.href = n.getAttribute('href');
      a.textContent = clean(n.textContent);
      // Bold = USWDS primary button; the columns (feature) CSS renders it orange like the source
      const strong = document.createElement('strong');
      strong.append(a);
      const p = document.createElement('p');
      p.append(strong);
      out.push(p);
    } else {
      n.querySelectorAll('br').forEach((br) => { if (!br.nextSibling || !clean(br.nextSibling.textContent)) br.remove(); });
      out.push(n);
    }
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

  const block = WebImporter.Blocks.createBlock(document, { name: 'Columns', variants: ['feature'], cells: [row] });
  element.replaceWith(block);
}
