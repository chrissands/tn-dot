/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-news. Base: cards (existing USWDS block, variant class "news").
 * Source: https://www.tn.gov/tdot.html  Generated: 2026-09-29
 *
 * The source homepage hand-curates its news cards; the migrated homepage shows the
 * newest articles from the news index instead. Emits DA table "Cards (news, latest)"
 * with settings rows (no copied stories) – blocks/cards/cards.js builds the cards:
 *   | Source    | /news/query-index.json |
 *   | Count     | number of source cards |
 *   | Link Text | source CTA text ("Read more") |
 *
 * Selectors validated against migration-work/block-context/cards-news/source.html:
 *   .row.parsys_column > .parsys_column  - one card per column (block-level div, safe to iterate)
 *   .tn-cta a                             - "Read more" link
 */
const clean = (s) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

export default function parse(element, { document }) {
  let columns = [...element.querySelectorAll('.row.parsys_column > .parsys_column')];
  if (!columns.length) columns = [...element.querySelectorAll('.tn-textandimage')].map((t) => t.parentElement);
  columns = columns.filter((col) => clean(col.textContent) || col.querySelector('img'));

  if (!columns.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const cta = element.querySelector('.tn-cta a[href]');
  const cells = [
    ['Source', '/news/query-index.json'],
    ['Count', String(columns.length)],
    ['Link Text', (cta && clean(cta.textContent)) || 'Read more'],
  ];
  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards', variants: ['news', 'latest'], cells });
  element.replaceWith(block);
}
