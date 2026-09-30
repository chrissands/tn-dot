/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-tiles. Base: cards (existing USWDS block, variant class "tiles").
 * Source: https://www.tn.gov/tdot.html  Generated: 2026-09-29
 *
 * Emits DA table "Cards (tiles)": one row per tile, 2 cells [linked icon image | linked H3 caption],
 * as blocks/cards/cards.js expects (image-only cell -> usa-card__media, heading -> header).
 *
 * Selectors validated against migration-work/block-context/cards-tiles/source.html:
 *   .row.parsys_column > .parsys_column  - one tile per column (block-level div; iterated instead
 *                                          of the sibling <a> image links to avoid inline-merge traps)
 *   .tn-image a > img                    - linked icon image
 *   .tn-rte h4 > a                       - linked caption (-> H3)
 */
const clean = (s) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

export default function parse(element, { document }) {
  let columns = [...element.querySelectorAll('.row.parsys_column > .parsys_column')];
  if (!columns.length) columns = [...element.querySelectorAll('[class*="column-"]')];

  const cells = [];
  columns.forEach((col) => {
    // Image cell (keep its link)
    let imageCell = '';
    const img = col.querySelector('.tn-image img, img');
    const headingSrc = [...col.querySelectorAll('h1, h2, h3, h4, h5, h6')].find((h) => clean(h.textContent));
    const headingLink = headingSrc && headingSrc.querySelector('a[href]');
    if (img) {
      const imgLinkSrc = img.closest('a[href]');
      const href = (imgLinkSrc && imgLinkSrc.getAttribute('href')) || (headingLink && headingLink.getAttribute('href'));
      if (href) {
        const a = document.createElement('a');
        a.href = href;
        a.append(img);
        imageCell = a;
      } else {
        imageCell = img;
      }
    }

    // Text cell: linked H3 caption
    const text = [];
    if (headingSrc) {
      const h3 = document.createElement('h3');
      if (headingLink) {
        const a = document.createElement('a');
        a.href = headingLink.getAttribute('href');
        a.textContent = clean(headingLink.textContent);
        h3.append(a);
      } else {
        h3.textContent = clean(headingSrc.textContent);
      }
      text.push(h3);
    }
    [...col.querySelectorAll('p')].filter((p) => clean(p.textContent)).forEach((p) => text.push(p));

    if (!img && !text.length) return;
    cells.push([imageCell, text]);
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards', variants: ['tiles'], cells });
  element.replaceWith(block);
}
