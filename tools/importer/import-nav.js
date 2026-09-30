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
 * Images reference the local copies in content/images/ (downloaded separately).
 */

const ORIGIN = 'https://www.tn.gov';
const IMAGES = {
  tnLogo: 'images/tn-logo.png',
  logo: 'images/tdot-logo.png',
  background: 'images/header-background.jpg',
  home: 'images/home.svg',
  print: 'images/print.svg',
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
      const home = link(document, a.getAttribute('href'), img(document, IMAGES.home, ''));
      home.append(label);
      item.append(home);
    } else {
      const label = [...a.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
      item.append(link(document, a.getAttribute('href'), label));
      const sub = li.querySelector(':scope > ul');
      if (sub) {
        const subList = document.createElement('ul');
        sub.querySelectorAll(':scope > li > a').forEach((sa) => {
          subList.append(el(document, 'li', {}, [link(document, sa.getAttribute('href'), sa.textContent.replace(/\s+/g, ' ').trim())]));
        });
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
    const a = el(document, 'a', { href: '#print' }, [img(document, IMAGES.print, ''), label]);
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
