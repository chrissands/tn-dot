/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-people. Base: cards (existing USWDS block, variant class "people").
 * Source: https://www.tn.gov/tdot.html  Generated: 2026-09-29
 *
 * Emits DA table "Cards (people)": one row per card, 2 cells [image | text], as
 * blocks/cards/cards.js expects. The careers CTA card has no image -> empty image cell
 * (cards.js then adds usa-card--no-media).
 *
 * Selectors validated against migration-work/block-context/cards-people/source.html:
 *   .row.parsys_column > .parsys_column   - one card per column (block-level div, safe to iterate)
 *   .textimage-top img                     - portrait (columns 1-2)
 *   h1-h6 (non-empty)                      - name/title or CTA heading
 *   p (non-empty, not inside a link)       - quote / description
 *   .tn-linkbuttons a                      - story / "View Opportunities" link
 */
const clean = (s) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

export default function parse(element, { document }) {
  let columns = [...element.querySelectorAll('.row.parsys_column > .parsys_column')];
  if (!columns.length) columns = [...element.querySelectorAll('[class*="column-"]')];

  const cells = [];
  columns.forEach((col) => {
    const img = col.querySelector('.textimage-top img, .textimage img') || col.querySelector('img');

    const text = [];
    const headingSrc = [...col.querySelectorAll('h1, h2, h3, h4, h5, h6')].find((h) => clean(h.textContent));
    if (headingSrc) {
      const h3 = document.createElement('h3');
      h3.textContent = clean(headingSrc.textContent);
      text.push(h3);
    }

    [...col.querySelectorAll('p')]
      .filter((p) => clean(p.textContent) && !p.closest('.tn-linkbuttons, .tn-cta'))
      .forEach((p) => {
        p.querySelectorAll('br').forEach((br) => br.remove());
        text.push(p);
      });

    [...col.querySelectorAll('.tn-linkbuttons a[href], .tn-cta a[href]')]
      .filter((a) => clean(a.textContent))
      .forEach((src) => {
        const a = document.createElement('a');
        a.href = src.getAttribute('href');
        a.textContent = clean(src.textContent);
        // Source button colors map to USWDS button authoring conventions:
        // gray story buttons = strikethrough (base), blue careers button = bold (primary)
        const wrap = document.createElement(src.classList.contains('gray') ? 's' : 'strong');
        wrap.append(a);
        const p = document.createElement('p');
        p.append(wrap);
        text.push(p);
      });

    if (!img && !text.length) return;
    cells.push([img || '', text]);
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards', variants: ['people'], cells });
  element.replaceWith(block);
}
