/* eslint-disable */
/* global WebImporter */
/**
 * Parser for columns-callout. Base: columns (existing block, variant class "callout").
 * Source: https://www.tn.gov/tdot.html  Generated: 2026-09-29
 *
 * Emits DA table "Columns (callout)": ONE row x 2 cells; each cell = H3 title, paragraph, link.
 *
 * Selectors validated against migration-work/block-context/columns-callout/source.html:
 *   .row.parsys_column > .parsys_column  - callout cells (column-1..2)
 *   .tn-rte h4 / p                       - title/text (&nbsp; spacer headings/paragraphs skipped)
 *   .tn-cta a.text-button                - CTA link
 *   .bgimg > img                         - section background, moved to Section Metadata by
 *                                          tdot-sections.js -> EXCLUDED here
 */
const clean = (s) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

function buildCell(col, document) {
  const out = [];
  const nodes = [...col.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, .tn-cta a, .tn-linkbuttons a')]
    .filter((n, i, arr) => !arr.some((o) => o !== n && o.contains(n)));

  nodes.forEach((n) => {
    if (!clean(n.textContent)) return;
    if (/^H[1-6]$/.test(n.tagName)) {
      const h = document.createElement('h3');
      h.textContent = clean(n.textContent);
      out.push(h);
    } else if (n.tagName === 'A') {
      const a = document.createElement('a');
      a.href = n.getAttribute('href');
      a.textContent = clean(n.textContent);
      const p = document.createElement('p');
      if (n.classList.contains('button')) {
        const strong = document.createElement('strong');
        strong.append(a);
        p.append(strong);
      } else {
        p.append(a);
      }
      out.push(p);
    } else {
      // Source <br>s are line-wrap artifacts (e.g. "for all<br>Tennesseans") -> spaces
      n.querySelectorAll('br').forEach((br) => br.replaceWith(document.createTextNode(' ')));
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

  const block = WebImporter.Blocks.createBlock(document, { name: 'Columns', variants: ['callout'], cells: [row] });
  element.replaceWith(block);
}
