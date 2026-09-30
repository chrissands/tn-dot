/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the TDOT Scenic Roadways page.
 * Source: https://www.tn.gov/tdot/local-programs-community-investments/community-investments-office/highway-beautification-office/beautification-national-scenic-byways.html
 * Target: same path without /tdot (template: left-nav)
 *
 * Output
 *   - Section 1: Side Nav (subnav) – Highway Beautification Office left nav
 *   - Section 2: H1; Columns (contact) photo + caption | contact card; content tile as
 *     H2 link + link paragraph; intro text + resource list; Cards (media) for the three
 *     scenic roadway types (image, H3, text with "Overview" link)
 *   - Metadata: title, description, template
 */
import {
  clean, el, href, buildSideNav, cleanRte, buildImage, imageSrc, mapSitePath, metadata,
} from './lib/tn-common.js';

/** 2-column text-and-image components, in visual (row-major) order. */
function buildMediaCards(document, row) {
  const columns = [...row.querySelectorAll(':scope > .parsys_column')]
    .map((col) => [...col.querySelectorAll('.tn-textandimage')]);
  const ordered = [];
  for (let i = 0; i < Math.max(...columns.map((c) => c.length)); i += 1) {
    columns.forEach((c) => { if (c[i]) ordered.push(c[i]); });
  }
  const cells = ordered.map((item) => {
    const img = item.querySelector('img');
    const media = img ? el(document, 'img', { src: imageSrc(img.getAttribute('src')), alt: clean(img.getAttribute('alt')) }) : '';
    const textRoot = item.querySelector('.textimage-text') || item;
    const heading = [...textRoot.querySelectorAll('h1, h2, h3, h4, h5, h6')].find((h) => clean(h.textContent));
    const text = [];
    if (heading) text.push(el(document, 'h3', {}, [clean(heading.textContent)]));
    text.push(...cleanRte(document, textRoot).filter((n) => !/^H[1-6]$/.test(n.tagName)));
    return [media, text];
  });
  return WebImporter.Blocks.createBlock(document, { name: 'Cards', variants: ['media'], cells });
}

export default {
  transform: ({ document, params }) => {
    const article = document.querySelector('#main .content article') || document.querySelector('#main article');
    const main = el(document, 'div');

    const sideNav = buildSideNav(document);
    if (sideNav) main.append(sideNav, el(document, 'hr'));

    const title = clean((article.querySelector('.tn-pagetitle h1') || document.querySelector('h1')).textContent);
    main.append(el(document, 'h1', {}, [title]));

    const content = article.querySelector(':scope > div:not(.tn-pagetitle)') || article;
    [...content.children].forEach((part) => {
      if (part.classList.contains('tn-columnctrl')) {
        const row = part.querySelector('.row.parsys_column');
        if (!row) return;
        if (row.querySelector('.tn-textandimage')) {
          main.append(buildMediaCards(document, row));
          return;
        }
        // photo + caption | contact card
        const cols = [...row.querySelectorAll(':scope > .parsys_column')].map((col) => {
          const cell = el(document, 'div');
          col.querySelectorAll('.tn-image').forEach((img) => cell.append(...buildImage(document, img)));
          col.querySelectorAll('.tn-rte').forEach((rte) => cell.append(...cleanRte(document, rte)));
          return cell;
        });
        main.append(WebImporter.Blocks.createBlock(document, { name: 'Columns', variants: ['contact'], cells: [cols] }));
      } else if (part.classList.contains('tn-contenttile')) {
        const link = part.querySelector('a[href]');
        const heading = el(document, 'h2', {}, [el(document, 'a', { href: href(link.getAttribute('href')) }, [clean(part.querySelector('.title').textContent)])]);
        main.append(heading);
        const cta = part.querySelector('.tn-cta a[href]');
        if (cta) main.append(el(document, 'p', {}, [el(document, 'a', { href: href(cta.getAttribute('href')) }, [clean(cta.textContent)])]));
      } else if (part.classList.contains('tn-rte')) {
        main.append(...cleanRte(document, part));
      } else if (part.classList.contains('tn-image')) {
        main.append(...buildImage(document, part));
      }
    });

    const firstText = [...main.querySelectorAll(':scope > p')].map((p) => clean(p.textContent)).find((t) => t.length > 60) || title;
    const description = clean((document.querySelector('meta[name="description"]') || {}).content)
      || (firstText.length > 160 ? `${firstText.slice(0, 157).replace(/\s+\S*$/, '')}…` : firstText);
    main.append(el(document, 'hr'), metadata(document, { title, description, template: 'left-nav' }));

    const sourcePath = new URL(params.originalURL).pathname;
    return [{ element: main, path: mapSitePath(sourcePath), report: { title } }];
  },
};
