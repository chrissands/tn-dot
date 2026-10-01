/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the TDOT "Traveling in Tennessee" page.
 * Source: https://www.tn.gov/tdot/driver-how-do-i/find-traveler-information.html
 * Target: /driver-how-do-i/find-traveler-information (template: full-width)
 *
 * Output
 *   - Sections 1-3: H1 | Hero (banner) – single-slide "Welcome" photo banner (own
 *     section, full bleed) | intro text + Summary Box (panel)
 *   - Section 2 (Section Metadata style "rule" = the source's horizontal rule):
 *     Columns (link-lists) – one cell per tn-linklist: H2 title link, list of links,
 *     optional "See More" link; one row per source column control
 *   - Metadata: title, description, template
 */
import {
  clean, el, href, cleanRte, imageSrc, mapSitePath, metadata,
  localizeImages,
} from './lib/tn-common.js';

function buildLinkList(document, list) {
  const cell = el(document, 'div');
  if (!list) return cell;
  const titleLink = list.querySelector(':scope > a[href]');
  const titleText = clean((list.querySelector('.title') || {}).textContent);
  if (titleText) {
    cell.append(el(document, 'h2', {}, [titleLink ? el(document, 'a', { href: href(titleLink.getAttribute('href')) }, [titleText]) : titleText]));
  }
  const ul = el(document, 'ul');
  list.querySelectorAll('ul li > a[href]').forEach((a) => {
    if (a.classList.contains('text-button')) return;
    ul.append(el(document, 'li', {}, [el(document, 'a', { href: href(a.getAttribute('href')) }, [clean(a.textContent)])]));
  });
  if (ul.children.length) cell.append(ul);
  const more = list.querySelector('a.text-button[href]');
  if (more) cell.append(el(document, 'p', {}, [el(document, 'a', { href: href(more.getAttribute('href')) }, [clean(more.textContent)])]));
  return cell;
}

export default {
  transform: ({ document, params }) => {
    const main = el(document, 'div');
    const root = document.querySelector('#main');

    const title = clean((root.querySelector('.tn-pagetitle h1') || document.querySelector('h1')).textContent);
    main.append(el(document, 'h1', {}, [title]));

    const components = [...root.querySelectorAll('.tn-basicslider, .tn-rte, .tn-panel, .tn-horizontalrulev2, .tn-columnctrl')]
      .filter((c) => !c.parentElement.closest('.tn-panel, .tn-columnctrl, .tn-basicslider'));
    let rows = [];
    const flushColumns = () => {
      if (!rows.length) return;
      const width = Math.max(...rows.map((r) => r.length));
      rows = rows.map((r) => [...r, ...Array(width - r.length).fill('')]);
      main.append(WebImporter.Blocks.createBlock(document, { name: 'Columns', variants: ['link-lists'], cells: rows }));
      rows = [];
    };
    components.forEach((part) => {
      if (part.classList.contains('tn-basicslider')) {
        const slide = part.querySelector('.carousel-item') || part;
        const img = slide.querySelector('img');
        const cell = el(document, 'div');
        if (img) cell.append(el(document, 'p', {}, [el(document, 'img', { src: imageSrc(img.getAttribute('src')), alt: clean(img.getAttribute('alt')) })]));
        const heading = clean((slide.querySelector('.title') || {}).textContent);
        if (heading) cell.append(el(document, 'h2', {}, [heading]));
        slide.querySelectorAll('.text p').forEach((p) => { if (clean(p.textContent)) cell.append(el(document, 'p', {}, [clean(p.textContent)])); });
        // own section: the banner runs full bleed
        main.append(el(document, 'hr'), WebImporter.Blocks.createBlock(document, { name: 'Hero', variants: ['banner'], cells: [[cell]] }), el(document, 'hr'));
      } else if (part.classList.contains('tn-panel')) {
        const cell = el(document, 'div', {}, cleanRte(document, part.querySelector('.tn-rte') || part));
        main.append(WebImporter.Blocks.createBlock(document, { name: 'Summary Box', variants: ['panel'], cells: [[cell]] }));
      } else if (part.classList.contains('tn-rte')) {
        main.append(...cleanRte(document, part));
      } else if (part.classList.contains('tn-horizontalrulev2')) {
        // horizontal rule: new section, styled with a top rule
        main.append(el(document, 'hr'), WebImporter.Blocks.createBlock(document, { name: 'Section Metadata', cells: [['style', 'rule']] }));
      } else if (part.classList.contains('tn-columnctrl')) {
        const cols = [...part.querySelectorAll('.row.parsys_column > .parsys_column')];
        const row = cols.map((col) => buildLinkList(document, col.querySelector('.tn-linklist')));
        if (row.some((cell) => cell.childNodes && cell.childNodes.length)) rows.push(row);
      }
    });
    flushColumns();

    const description = clean((document.querySelector('meta[name="description"]') || {}).content)
      || clean((root.querySelector('.tn-basicslider .text p') || {}).textContent) || title;
    const pageTitle = clean(document.title) || title;
    main.append(el(document, 'hr'), metadata(document, { title: pageTitle, description, template: 'full-width' }));

    const path = mapSitePath(new URL(params.originalURL).pathname);
    const media = localizeImages(main, path);
    return [{ element: main, path, report: { title, media } }];
  },
};
