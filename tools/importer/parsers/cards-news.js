/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-news. Base: cards (existing USWDS block, variant class "news").
 * Source: https://www.tn.gov/tdot.html  Generated: 2026-09-29
 *
 * Emits DA table "Cards (news, latest)": one row per card, 2 cells [image | text], as
 * blocks/cards/cards.js expects (image-only cell -> usa-card__media; first heading ->
 * header; link-only paragraph -> footer; other paragraphs -> body). The "latest" option
 * makes cards.js swap in the newest /news/query-index.json entries (authored cards are
 * the fallback).
 *
 * Selectors validated against migration-work/block-context/cards-news/source.html:
 *   .row.parsys_column > .parsys_column  - one card per column (block-level div, safe to iterate)
 *   .textimage-top img                    - card image
 *   .textimage-text h1-h6                 - headline (empty &nbsp; spacer headings skipped)
 *   .textimage-text p                     - excerpt (empty &nbsp; spacers skipped)
 *   .tn-cta a                             - "Read more" link
 */
const clean = (s) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

export default function parse(element, { document }) {
  let columns = [...element.querySelectorAll('.row.parsys_column > .parsys_column')];
  if (!columns.length) columns = [...element.querySelectorAll('.tn-textandimage')].map((t) => t.parentElement);

  const cells = [];
  columns.forEach((col) => {
    const img = col.querySelector('.textimage-top img, .textimage img, img');
    const textRoot = col.querySelector('.textimage-text') || col;

    const text = [];
    const headingSrc = [...textRoot.querySelectorAll('h1, h2, h3, h4, h5, h6')].find((h) => clean(h.textContent));
    if (headingSrc) {
      const h3 = document.createElement('h3');
      h3.textContent = clean(headingSrc.textContent);
      text.push(h3);
    }
    [...textRoot.querySelectorAll('p')]
      .filter((p) => clean(p.textContent))
      .forEach((p) => text.push(p));

    const cta = col.querySelector('.tn-cta a[href]');
    if (cta && clean(cta.textContent)) {
      const a = document.createElement('a');
      a.href = cta.getAttribute('href');
      a.textContent = clean(cta.textContent);
      const p = document.createElement('p');
      p.append(a);
      text.push(p);
    }

    if (!img && !text.length) return;
    cells.push([img || '', text]);
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards', variants: ['news', 'latest'], cells });
  element.replaceWith(block);
}
