/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the TDOT Small Business Development Program page.
 * Source: https://www.tn.gov/tdot/civil-rights/small-business-development-program.html
 * Target: /civil-rights/small-business-development-program (template: left-nav)
 *
 * Output
 *   - Section 1: Side Nav (subnav) – Civil Rights Division menu
 *   - Section 2: H1, contact + intro (RTE); the RTE's dashed line becomes a section break
 *     (style "rule")
 *   - Section 3: "DBE News and Events" – linked images, RTE text and PDF links,
 *     media heading, Video (YouTube link), link buttons (bold links = buttons),
 *     Accordion (one row per item: title | content), one Summary Box (panel) per
 *     source panel (H4 titles -> H3)
 *   - Metadata: title, description, template
 * Images are hosted in Document Authoring (localizeImages), PDFs next to the page
 * (localizeDocuments); both are listed in the import report for download-media.mjs.
 */
import {
  clean, el, href, buildSideNav, cleanRte, imageSrc, youtubeUrl, mapSitePath, metadata,
  localizeImages, localizeDocuments,
} from './lib/tn-common.js';

/** tn-image: image paragraph, linked when the source image is linked */
function linkedImage(document, part) {
  const img = part.querySelector('img');
  if (!img) return [];
  const image = el(document, 'img', { src: imageSrc(img.getAttribute('src')), alt: clean(img.getAttribute('alt') || img.getAttribute('title')) });
  // keep the link unless it only opens the image file itself
  const a = img.closest('a[href]');
  const target = a && !/\.(png|jpe?g|gif|webp)$/i.test(a.getAttribute('href')) ? href(a.getAttribute('href')) : '';
  return [el(document, 'p', {}, [target ? el(document, 'a', { href: target }, [image]) : image])];
}

/** RTE nodes; a paragraph of dashes (the source's text "rule") is returned as 'RULE' */
function rte(document, part) {
  return cleanRte(document, part).map((node) => (/^[-–—_\s]{10,}$/.test(node.textContent) ? 'RULE' : node));
}

/**
 * Consecutive paragraphs that each start with a link (a link list written as paragraphs)
 * become one paragraph with line breaks: a link alone in a paragraph would be a button.
 */
function joinLinkParagraphs(document, nodes) {
  const isLinkLine = (n) => n.tagName === 'P' && n.firstElementChild && n.firstElementChild.tagName === 'A'
    && !(n.firstChild.nodeType === 3 && clean(n.firstChild.textContent));
  const out = [];
  nodes.forEach((n) => {
    const prev = out[out.length - 1];
    if (isLinkLine(n) && prev && prev.dataset && prev.dataset.links) {
      prev.append(el(document, 'br'), ...n.childNodes);
    } else if (isLinkLine(n)) {
      const p = el(document, 'p', {}, [...n.childNodes]);
      p.dataset.links = 'true';
      out.push(p);
    } else out.push(n);
  });
  out.forEach((n) => { if (n.dataset) delete n.dataset.links; });
  return out;
}

function panel(document, part) {
  const nodes = cleanRte(document, part.querySelector('.tn-rte') || part).map((node) => {
    if (!/^H[1-6]$/.test(node.tagName)) return node;
    return el(document, 'h3', {}, [clean(node.textContent)]);
  });
  if (!nodes.length) return null;
  return WebImporter.Blocks.createBlock(document, { name: 'Summary Box', variants: ['panel'], cells: [[el(document, 'div', {}, joinLinkParagraphs(document, nodes))]] });
}

export default {
  transform: ({ document, params }) => {
    const article = document.querySelector('#main .content article') || document.querySelector('#main article');
    const main = el(document, 'div');

    const sideNav = buildSideNav(document);
    if (sideNav) main.append(sideNav, el(document, 'hr'));

    const title = clean((article.querySelector('.tn-pagetitle h1') || document.querySelector('h1')).textContent);
    main.append(el(document, 'h1', {}, [title]));

    // top-level components in page order (the accordion is not in the RTE container)
    const COMPONENTS = '.tn-rte, .tn-image, .tn-video, .tn-linkbuttons, .tn-accordion, .tn-panel';
    const parts = [...article.querySelectorAll(COMPONENTS)]
      .filter((c) => !c.parentElement.closest(COMPONENTS) && !c.closest('.tn-pagetitle'));
    parts.forEach((part) => {
      if (part.classList.contains('tn-rte')) {
        rte(document, part).forEach((node) => {
          // new section, styled with a top rule
          if (node === 'RULE') main.append(el(document, 'hr'), WebImporter.Blocks.createBlock(document, { name: 'Section Metadata', cells: [['style', 'rule']] }));
          else main.append(node);
        });
      } else if (part.classList.contains('tn-image')) {
        main.append(...linkedImage(document, part));
      } else if (part.classList.contains('tn-video')) {
        const frame = part.querySelector('iframe[src], a[href]');
        if (!frame) return;
        const url = youtubeUrl(frame.getAttribute('src') || frame.getAttribute('href'));
        const label = clean(frame.getAttribute('title')) || 'Watch video';
        main.append(WebImporter.Blocks.createBlock(document, { name: 'Video', cells: [[el(document, 'p', {}, [el(document, 'a', { href: url }, [label])])]] }));
      } else if (part.classList.contains('tn-linkbuttons')) {
        part.querySelectorAll('a[href]').forEach((a) => {
          main.append(el(document, 'p', {}, [el(document, 'strong', {}, [el(document, 'a', { href: href(a.getAttribute('href')) }, [clean(a.textContent)])])]));
        });
      } else if (part.classList.contains('tn-accordion')) {
        const rows = [...part.querySelectorAll('.accordion-item')].map((item) => {
          // the importer drops <button>s: read the title from its heading wrapper
          const label = clean((item.querySelector('.accordion-heading, .accordion-title, .accordion-button') || {}).textContent);
          const body = item.querySelector('.accordion-body .tn-rte') || item.querySelector('.accordion-body');
          return [label, el(document, 'div', {}, body ? cleanRte(document, body) : [])];
        }).filter(([label]) => label);
        if (rows.length) main.append(WebImporter.Blocks.createBlock(document, { name: 'Accordion', cells: rows }));
      } else if (part.classList.contains('tn-panel')) {
        const box = panel(document, part);
        if (box) main.append(box);
      }
    });

    // first real paragraph (not the contact block)
    const intro = [...main.querySelectorAll(':scope > p')].map((p) => clean(p.textContent))
      .find((t) => t.length > 80 && !/@|Phone:/.test(t)) || title;
    const description = clean((document.querySelector('meta[name="description"]') || {}).content)
      || (intro.length > 160 ? `${intro.slice(0, 157).replace(/\s+\S*$/, '')}…` : intro);
    main.append(el(document, 'hr'), metadata(document, { title, description, template: 'left-nav' }));

    const path = mapSitePath(new URL(params.originalURL).pathname);
    const media = localizeImages(main, path);
    const documents = localizeDocuments(main, path);
    return [{ element: main, path, report: { title, media, documents } }];
  },
};
