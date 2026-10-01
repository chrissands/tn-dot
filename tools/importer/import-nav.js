/* eslint-disable */
import { mapSitePath } from './lib/tn-common.js';
/* global WebImporter */

/**
 * Import script for the site navigation fragment (content/nav.plain.html).
 * Source: TDOT agency header on https://www.tn.gov/tdot.html
 *
 * Output (flat, DA-friendly — top-level sections only, no classes):
 *   1. Brand:  TN mark (linked) + TDOT wordmark (linked) + header background photo
 *   2. Nav:    list of primary items; dropdown items carry a nested list
 *   3. Tools:  "Go to TN.gov" link, search placeholder + results link,
 *              mobile menu labels (plain text: open, close), print link
 *
 * Icons (home, print) are :name: notation (served from /icons/ in the code); the logos and
 * header photo are hosted in Document Authoring, in the document's media folder (.nav)
 * (content/images/ locally; header.js maps them in local preview).
 */

const ORIGIN = 'https://www.tn.gov';
// Brand images are hosted in Document Authoring, in the document's own media folder
// (.nav). The workspace-to-DA content sync relinks every image to
// .nav/<name>-<md5(original URL) first 8 hex>.<ext>; upload-da.mjs uploads both names.
// Small UI icons are :name: text, served from /icons/<name>.svg in the code.
const DA_MEDIA = 'https://content.da.live/chrissands/tn-dot/.nav';
const IMAGES = {
  tnLogo: `${DA_MEDIA}/tn-logo.png`,
  logo: `${DA_MEDIA}/tdot-logo.png`,
  background: `${DA_MEDIA}/header-background.jpg`,
};

function toSite(href) {
  if (!href) return href;
  if (/^https?:\/\//i.test(href)) return href;
  return `${ORIGIN}${href.replace(/^\/content\/tn\/+/, '/')}`;
}

/** Absolute tn.gov link, or the migrated page on this site. */
function abs(href) {
  const url = toSite(href);
  if (!url || !/^https?:/i.test(url)) return url;
  const { hostname, pathname } = new URL(url);
  const path = pathname.replace(/^\/content\/tn\/+/, '/');
  const mapped = /(^|\.)tn\.gov$/.test(hostname) ? mapSitePath(path) : null;
  return mapped || url;
}

function el(document, tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  children.forEach((c) => e.append(c));
  return e;
}

function img(document, src, alt) {
  return el(document, 'img', { src, alt });
}

function link(document, href, content) {
  return el(document, 'a', { href: abs(href) }, [content]);
}

function buildBrand(document) {
  const section = document.createElement('div');
  const logoLink = document.querySelector('#header .title a, #header a:has(#entity-name)');
  const logoImg = document.querySelector('#entity-name');
  const alt = 'TDOT Department of Transportation';
  // State "TN" mark (rendered as a CSS background on the source) links to TN.gov
  const tnLogo = document.querySelector('#header-logo, #header a.logo');
  section.append(el(document, 'p', {}, [
    link(document, tnLogo ? tnLogo.getAttribute('href') : 'https://www.tn.gov/', img(document, IMAGES.tnLogo, 'TN.gov')),
  ]));
  section.append(el(document, 'p', {}, [
    link(document, logoLink ? logoLink.getAttribute('href') : '/tdot.html', img(document, IMAGES.logo, (logoImg && logoImg.getAttribute('alt')) || alt)),
  ]));
  section.append(el(document, 'p', {}, [img(document, IMAGES.background, '')]));
  return section;
}

// Pages that exist only on this site, added to a source menu after a given item
// (source paths without /content/tn). Migrated pages need no entry: their source
// links are mapped to the site path (MIGRATED in lib/tn-common.js).
const EXTRA_ITEMS = [
  { menu: '/tdot/driver-how-do-i.html', after: '/tdot/driver-how-do-i/look--at-traffic-conditions.html', href: '/live-traffic', label: 'View live traffic' },
];

const sourcePath = (href) => (href || '').replace(/^https?:\/\/(www\.)?tn\.gov/, '').replace(/^\/content\/tn\/+/, '/');

function buildNav(document) {
  const section = document.createElement('div');
  const list = document.createElement('ul');
  document.querySelectorAll('#nav ul.nav-items > li').forEach((li) => {
    const a = li.querySelector(':scope > a');
    if (!a) return;
    const item = document.createElement('li');
    if (a.classList.contains('icon-home')) {
      const hidden = a.querySelector('.visually-hidden');
      const label = (hidden && hidden.textContent.trim()) || a.getAttribute('aria-label') || 'Home';
      // icon + label text (label is rendered screen-reader-only by header.js)
      const home = link(document, a.getAttribute('href'), document.createTextNode(':home:'));
      home.append(label);
      item.append(home);
    } else {
      const label = [...a.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
      item.append(link(document, a.getAttribute('href'), label));
      const sub = li.querySelector(':scope > ul');
      if (sub) {
        const subList = document.createElement('ul');
        const extras = EXTRA_ITEMS.filter((x) => x.menu === sourcePath(a.getAttribute('href')));
        sub.querySelectorAll(':scope > li > a').forEach((sa) => {
          subList.append(el(document, 'li', {}, [link(document, sa.getAttribute('href'), sa.textContent.replace(/\s+/g, ' ').trim())]));
          extras.filter((x) => x.after === sourcePath(sa.getAttribute('href'))).forEach((x) => {
            subList.append(el(document, 'li', {}, [el(document, 'a', { href: x.href }, [x.label])]));
            x.placed = true;
          });
        });
        // extras whose anchor item is gone from the source menu go last
        extras.filter((x) => !x.placed).forEach((x) => subList.append(el(document, 'li', {}, [el(document, 'a', { href: x.href }, [x.label])])));
        item.append(subList);
      }
    }
    list.append(item);
  });
  section.append(list);
  return section;
}

function buildTools(document) {
  const section = document.createElement('div');
  const tngov = [...document.querySelectorAll('#header a')].find((a) => a.textContent.includes('TN.gov'));
  if (tngov) {
    section.append(el(document, 'p', {}, [link(document, tngov.getAttribute('href'), tngov.textContent.replace(/\s+/g, ' ').trim())]));
  }
  // Search: placeholder text + results page (Coveo search box is rebuilt as a form in header.js)
  const box = document.querySelector('atomic-search-box');
  const placeholder = (box && box.getAttribute('placeholder')) || 'Search TDOT';
  section.append(el(document, 'p', {}, [link(document, '/tdot/search-results.html', placeholder)]));
  // Mobile menu toggle label (plain text paragraph)
  const menu = document.querySelector('#nav .mobile-menu');
  const menuLabel = menu ? menu.textContent.replace(/\s+/g, ' ').trim() : '';
  section.append(el(document, 'p', {}, [menuLabel || 'Menu']));
  // label the source swaps in (via script) while the mobile menu is open
  section.append(el(document, 'p', {}, ['Close Menu']));
  const print = document.querySelector('#nav a.icon-print');
  if (print) {
    const label = (print.textContent || 'Print This Page').replace(/\s+/g, ' ').trim() || 'Print This Page';
    const a = el(document, 'a', { href: '#print' }, [document.createTextNode(':print:'), label]);
    section.append(el(document, 'p', {}, [a]));
  }
  return section;
}

export default {
  transform: ({ document }) => {
    // Sections are separated by <hr> (section breaks) so the fragment keeps 3 top-level divs
    const main = document.createElement('div');
    [buildBrand(document), buildNav(document), buildTools(document)].forEach((section, i) => {
      if (i > 0) main.append(document.createElement('hr'));
      main.append(...section.childNodes);
    });
    return [{
      element: main,
      path: '/nav',
      report: { title: 'nav', sections: main.children.length },
    }];
  },
};
