/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the TDOT newsroom category sidebar (from https://www.tn.gov/tdot/news.html).
 * Output: /fragments/news-sidebar – Side Nav (newsroom) block with the category filters,
 * shared by the listing and every article (newsroom / news-article templates).
 *
 * Category links use /news?category={id}; ids are the sanitized filter names and
 * match the article "Category" metadata.
 */

const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
const sanitize = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function el(document, tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  children.forEach((c) => e.append(c));
  return e;
}

function buildSidebar(document) {
  const filters = document.querySelector('.tn-newsroomfilters');
  const heading = filters ? clean(filters.querySelector('.title a').textContent) : 'Newsroom';
  const list = el(document, 'ul');
  (filters ? [...filters.querySelectorAll('ul li a')] : []).forEach((a) => {
    const name = clean(a.textContent);
    const isAll = a.closest('li').classList.contains('all-news');
    const href = isAll ? '/news' : `/news?category=${sanitize(name)}`;
    list.append(el(document, 'li', {}, [el(document, 'a', { href }, [name])]));
  });
  // mobile toggle label (plain-text paragraph)
  const toggle = filters && filters.querySelector('.icon-menu');
  const toggleLabel = (toggle && clean(toggle.textContent)) || 'Section Menu';
  const cell = el(document, 'div', {}, [
    el(document, 'p', {}, [el(document, 'a', { href: '/news' }, [heading])]),
    el(document, 'p', {}, [toggleLabel]),
    list,
  ]);
  const main = el(document, 'div');
  main.append(WebImporter.Blocks.createBlock(document, { name: 'Side Nav', variants: ['newsroom'], cells: [[cell]] }));
  return main;
}

export default {
  transform: ({ document }) => [
    { element: buildSidebar(document), path: '/fragments/news-sidebar', report: { title: 'news sidebar' } },
  ],
};
