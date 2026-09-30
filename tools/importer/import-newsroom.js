/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the TDOT newsroom listing (https://www.tn.gov/tdot/news.html).
 * Output: /news – "Newsroom" heading + index-driven Collection (news) block.
 * The category sidebar is imported separately (import-news-sidebar.js).
 */

const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();

function el(document, tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  children.forEach((c) => e.append(c));
  return e;
}

function buildListing(document) {
  const main = el(document, 'div');
  const title = clean((document.querySelector('.tn-newsroomresults .tn-pagetitle h1') || document.querySelector('h1') || {}).textContent) || 'Newsroom';
  main.append(el(document, 'h1', {}, [title]));
  // items per page as rendered on the source
  const perPage = document.querySelectorAll('.tn-newsroomresults article.news').length || 15;
  main.append(WebImporter.Blocks.createBlock(document, {
    name: 'Collection',
    variants: ['news'],
    cells: [
      ['Source', '/news/query-index.json'],
      ['Page Size', String(perPage)],
      ['Link Text', clean((document.querySelector('.tn-newsroomresults article.news a.button') || {}).textContent) || 'Read full story'],
      ['Empty Text', 'There are no news stories in this category yet.'],
    ],
  }));
  main.append(document.createElement('hr'), WebImporter.Blocks.getMetadataBlock(document, {
    title: 'News',
    description: 'The latest news and press releases from the Tennessee Department of Transportation.',
    template: 'newsroom',
  }));
  return main;
}

export default {
  transform: ({ document }) => [
    { element: buildListing(document), path: '/news', report: { title: 'news' } },
  ],
};
