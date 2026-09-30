/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the TDOT Maintenance Request page.
 * Source: https://www.tn.gov/tdot/maintenance/maintenance-request.html
 * Target: /maintenance/maintenance-request (template: left-nav)
 *
 * Output
 *   - Section 1: Side Nav (subnav) – "Asset Management Division" left nav with its
 *     collapsible sub-menus (links to tn.gov: those pages are not migrated)
 *   - Section 2: H1, Summary Box (panel) emergency notice, intro text, Form block, claim note
 *   - Metadata: title, description, template
 *
 * The source form is a Formstack embed (form 3533382). Its fields and show/hide logic
 * are rebuilt natively as a Form block from maintenance-request-form.json
 * (tools/importer/build-maintenance-form.mjs). Submissions POST as JSON to the URL in
 * the block's "action" row – left empty until TDOT's receiving endpoint exists – with a
 * reCAPTCHA v2 Invisible token; the "captcha" row holds the site key (empty until TDOT
 * registers one for the site's domains).
 */
import FORM from './maintenance-request-form.json';
import {
  clean, el, buildSideNav, cleanRte, mapSitePath,
} from './lib/tn-common.js';

function htmlCell(document, html) {
  const div = el(document, 'div');
  div.innerHTML = html;
  return div;
}

/** Form block: header row, then one row per field (see blocks/form/form.js). */
function buildForm(document) {
  const header = ['Type', 'Name', 'Label', 'Options', 'Required', 'Show If', 'Style'];
  const rows = FORM.rows.map((r) => {
    const label = /^(heading|note|callout)$/.test(r.type) ? htmlCell(document, r.label) : r.label;
    let options = '';
    if (r.options && r.options.length) {
      options = el(document, 'ul', {}, r.options.map((o) => el(document, 'li', {}, [o])));
    }
    return [r.type, r.name, label, options, r.required ? 'true' : '', r.showIf || '', r.style || ''];
  });
  // where answers are sent: fill in the receiving endpoint URL (JSON POST)
  rows.push(['action', 'action', '', '', '', '', '']);
  // spam protection: reCAPTCHA v2 Invisible site key (TDOT's key registered for the site's domains)
  rows.push(['captcha', 'captcha', '', '', '', '', '']);
  rows.push(['success', 'success', htmlCell(document, '<p><strong>Thank you.</strong> Your maintenance request has been submitted to TDOT.</p>'), '', '', '', '']);
  rows.push(['error', 'error', htmlCell(document, '<p>Your request could not be sent. Please try again, or call the TDOT Road Repair Hotline at 833-TDOTFIX (836-8349).</p>'), '', '', '', '']);
  return WebImporter.Blocks.createBlock(document, { name: 'Form', cells: [header, ...rows] });
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
      if (part.classList.contains('tn-panel')) {
        const rte = part.querySelector('.tn-rte') || part;
        const cell = el(document, 'div', {}, cleanRte(document, rte));
        // call-out headings (e.g. the hotline number) directly under the page H1 -> H2
        cell.querySelectorAll('h3, h4, h5, h6').forEach((h) => {
          const h2 = el(document, 'h2', {}, [...h.childNodes]);
          h.replaceWith(h2);
        });
        main.append(WebImporter.Blocks.createBlock(document, { name: 'Summary Box', variants: ['panel'], cells: [[cell]] }));
      } else if (part.classList.contains('tn-formstack')) {
        main.append(buildForm(document));
      } else if (part.classList.contains('tn-rte')) {
        main.append(...cleanRte(document, part));
      }
    });

    const description = clean((document.querySelector('meta[name="description"]') || {}).content) || title;
    main.append(el(document, 'hr'), WebImporter.Blocks.getMetadataBlock(document, {
      title,
      description,
      template: 'left-nav',
    }));

    return [{
      element: main,
      path: mapSitePath(new URL(params.originalURL).pathname),
      report: { title, formRows: FORM.rows.length },
    }];
  },
};
