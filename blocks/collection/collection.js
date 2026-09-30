/**
 * Collection block - USWDS Collection component
 * Transforms simple authored content into USWDS collection structure
 *
 * @see https://designsystem.digital.gov/components/collection/
 */

import { readBlockConfig } from '../../scripts/aem.js';
import { loadPlaceholders, t as placeholderText } from '../../scripts/placeholders.js';
import {
  fetchNewsIndex, categoryId, formatNewsDate, newsHref,
} from '../../scripts/news.js';

function pagerIcon(name) {
  const span = document.createElement('span');
  span.className = 'news-pager-icon';
  span.setAttribute('aria-hidden', 'true');
  span.style.setProperty('--news-pager-icon', `url("${window.hlx.codeBasePath}/icons/usa-icons/${name}.svg")`);
  return span;
}

/**
 * Builds USWDS pagination for the news list (source layout: first/previous arrows,
 * page numbers with the current page as plain text, next arrow).
 * @param {number} page current page (1-based)
 * @param {number} pages total pages
 * @param {function(number): string} hrefFor link for a page
 */
function buildPagination(page, pages, hrefFor) {
  const nav = document.createElement('nav');
  nav.className = 'usa-pagination news-pager';
  nav.setAttribute('aria-label', placeholderText('pagination', 'Pagination'));
  const list = document.createElement('ul');
  list.className = 'usa-pagination__list';

  const addItem = (className, ...content) => {
    const li = document.createElement('li');
    li.className = `usa-pagination__item ${className}`;
    li.append(...content);
    list.append(li);
    return li;
  };
  const control = (target, enabled, icon, label) => {
    const el = document.createElement(enabled ? 'a' : 'span');
    el.className = 'usa-pagination__link news-pager-arrow';
    if (enabled) el.href = hrefFor(target);
    else el.setAttribute('aria-disabled', 'true');
    el.setAttribute('aria-label', label);
    el.append(pagerIcon(icon));
    return el;
  };

  addItem(
    'usa-pagination__arrow news-pager-back',
    control(1, page > 1, 'navigate_far_before', placeholderText('first-page', 'First page')),
    control(page - 1, page > 1, 'navigate_before', placeholderText('previous-page', 'Previous page')),
  );
  // up to three consecutive pages around the current one, plus the last page
  const start = Math.max(1, Math.min(page - 1, pages - 2));
  const shown = [];
  for (let n = start; n <= Math.min(pages, start + 2); n += 1) shown.push(n);
  if (!shown.includes(pages)) shown.push(pages);
  shown.forEach((n, i) => {
    if (i > 0 && n - shown[i - 1] > 1) addItem('usa-pagination__overflow', '…');
    if (n === page) {
      const current = document.createElement('span');
      current.className = 'usa-pagination__button usa-current';
      current.setAttribute('aria-current', 'page');
      current.textContent = n;
      addItem('usa-pagination__page-no', current);
    } else {
      const a = document.createElement('a');
      a.className = 'usa-pagination__button';
      a.href = hrefFor(n);
      a.setAttribute('aria-label', n === pages
        ? placeholderText('last-page-number', 'Last page, page {page}', { page: n })
        : placeholderText('page-number', 'Page {page}', { page: n }));
      a.textContent = n;
      addItem('usa-pagination__page-no', a);
    }
  });
  addItem('usa-pagination__arrow', control(page + 1, page < pages, 'navigate_next', placeholderText('next-page', 'Next page')));
  nav.append(list);
  return nav;
}

/**
 * Index-driven news list (variant "news"): config rows Source, Page Size, Link Text.
 * Filters by ?category= (sidebar ids) and paginates with ?page=.
 * @param {HTMLElement} block
 */
async function decorateNews(block) {
  await loadPlaceholders();
  const config = readBlockConfig(block);
  const pageSize = Math.max(1, parseInt(config['page-size'], 10) || 15);
  const linkText = config['link-text'] || '';
  const emptyText = config['empty-text'] || '';
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');

  let items = await fetchNewsIndex(config.source || undefined);
  if (category) {
    items = items.filter((item) => item.categories.some((c) => categoryId(c) === category));
  }

  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, parseInt(params.get('page'), 10) || 1), pages);
  const visible = items.slice((page - 1) * pageSize, page * pageSize);

  const list = document.createElement('ul');
  list.className = 'usa-collection news-list';
  visible.forEach((entry, i) => {
    const href = newsHref(entry.path);
    const li = document.createElement('li');
    li.className = `usa-collection__item news-list-item${i === 0 ? ' news-list-item-featured' : ''}`;
    const body = document.createElement('div');
    body.className = 'usa-collection__body';

    const heading = document.createElement('h2');
    heading.className = 'usa-collection__heading';
    const a = document.createElement('a');
    a.className = 'usa-link';
    a.href = href;
    a.textContent = entry.title;
    heading.append(a);
    body.append(heading);

    const { date, time } = formatNewsDate(entry.date);
    if (date) {
      const meta = document.createElement('ul');
      meta.className = 'usa-collection__meta';
      meta.setAttribute('aria-label', placeholderText('published', 'Published'));
      const metaItem = document.createElement('li');
      metaItem.className = 'usa-collection__meta-item';
      const t = document.createElement('time');
      t.dateTime = entry.date;
      t.textContent = date;
      metaItem.append(t);
      if (time) {
        const small = document.createElement('small');
        small.textContent = time;
        metaItem.append(' | ', small);
      }
      meta.append(metaItem);
      body.append(meta);
    }
    li.append(body);

    if (linkText) {
      const more = document.createElement('a');
      more.className = 'news-list-more';
      more.href = href;
      more.textContent = linkText;
      more.setAttribute('aria-label', `${linkText}: ${entry.title}`);
      li.append(more);
    }
    list.append(li);
  });

  block.textContent = '';
  block.classList.add('usa-collection-block');
  block.append(list);
  if (!visible.length && emptyText) {
    const empty = document.createElement('p');
    empty.className = 'news-list-empty';
    empty.textContent = emptyText;
    block.append(empty);
  }
  if (pages > 1) {
    block.append(buildPagination(page, pages, (n) => {
      const next = new URLSearchParams(params);
      if (n > 1) next.set('page', n); else next.delete('page');
      const qs = next.toString();
      return `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    }));
  }
}

/**
 * Parse metadata from a paragraph (e.g., "By: Author Name", "Date: 2024-01-27")
 * @param {string} text - The text to parse
 * @returns {object} Parsed metadata
 */
function parseMetadata(text) {
  const byMatch = text.match(/^By:?\s*(.+)/i);
  const dateMatch = text.match(/^Date:?\s*(.+)/i);
  const tagsMatch = text.match(/^Tags?:?\s*(.+)/i);

  let type = null;
  if (byMatch) type = 'by';
  else if (dateMatch) type = 'date';
  else if (tagsMatch) type = 'tags';

  return {
    isMetadata: !!(byMatch || dateMatch || tagsMatch),
    type,
    value: byMatch?.[1] || dateMatch?.[1] || tagsMatch?.[1] || text,
  };
}

/**
 * Create metadata list items
 * @param {string} type - Type of metadata (by, date, tags)
 * @param {string} value - The metadata value
 * @returns {Array} Array of li elements
 */
function createMetaItems(type, value) {
  const items = [];

  if (type === 'tags') {
    // Split tags by comma and create tag elements
    const tags = value.split(',').map((tag) => tag.trim()).filter((tag) => tag);
    tags.forEach((tag) => {
      const li = document.createElement('li');
      li.className = 'usa-collection__meta-item usa-tag';
      li.textContent = tag;
      items.push(li);
    });
  } else if (type === 'date') {
    // Create time element for dates
    const li = document.createElement('li');
    li.className = 'usa-collection__meta-item';
    const time = document.createElement('time');
    // Try to parse date for datetime attribute
    const dateObj = new Date(value);
    if (!Number.isNaN(dateObj.getTime())) {
      time.setAttribute('datetime', dateObj.toISOString());
    }
    time.textContent = value;
    li.appendChild(time);
    items.push(li);
  } else {
    // Regular metadata item
    const li = document.createElement('li');
    li.className = 'usa-collection__meta-item';
    li.textContent = value;
    items.push(li);
  }

  return items;
}

/**
 * Decorates a collection block
 * @param {HTMLElement} block - The collection block element
 */
export default async function decorate(block) {
  if (block.classList.contains('news')) {
    await decorateNews(block);
    return;
  }

  // Check for condensed variant
  const isCondensed = block.classList.contains('condensed');

  // Create the collection list
  const collection = document.createElement('ul');
  collection.className = 'usa-collection';
  if (isCondensed) {
    collection.classList.add('usa-collection--condensed');
  }

  // Get all rows from the block (each row is a collection item)
  const rows = Array.from(block.children);

  rows.forEach((row) => {
    const cells = Array.from(row.children);
    if (cells.length === 0) return;

    // Create collection item
    const item = document.createElement('li');
    item.className = 'usa-collection__item';

    // Get content from first cell
    const content = cells[0];
    const children = Array.from(content.children);

    // Extract components
    let image = null;
    let heading = null;
    const descriptions = [];
    const metadata = [];
    const tags = [];

    children.forEach((child) => {
      if (child.querySelector('img, picture')) {
        // Image
        const img = child.querySelector('img');
        if (img) {
          image = document.createElement('img');
          image.className = 'usa-collection__img';
          image.src = img.src;
          image.alt = img.alt || '';
        }
      } else if (child.matches('h1, h2, h3, h4, h5, h6') && !heading) {
        // First heading
        heading = child;
      } else if (child.matches('p')) {
        // Could be description or metadata
        const text = child.textContent.trim();
        const meta = parseMetadata(text);

        if (meta.isMetadata) {
          if (meta.type === 'tags') {
            tags.push(meta.value);
          } else {
            metadata.push(meta);
          }
        } else if (text) {
          descriptions.push(child);
        }
      }
    });

    // Add image if present
    if (image) {
      item.appendChild(image);
    }

    // Create body container
    const body = document.createElement('div');
    body.className = 'usa-collection__body';

    // Add heading with link
    if (heading) {
      const collectionHeading = document.createElement('h4');
      collectionHeading.className = 'usa-collection__heading';

      const link = heading.querySelector('a');
      if (link) {
        const headingLink = document.createElement('a');
        headingLink.className = 'usa-link';
        headingLink.href = link.href;
        headingLink.textContent = link.textContent;
        collectionHeading.appendChild(headingLink);
      } else {
        collectionHeading.textContent = heading.textContent;
      }

      body.appendChild(collectionHeading);
    }

    // Add description
    descriptions.forEach((desc) => {
      const description = document.createElement('p');
      description.className = 'usa-collection__description';
      description.textContent = desc.textContent;
      body.appendChild(description);
    });

    // Add metadata list
    if (metadata.length > 0) {
      const metaList = document.createElement('ul');
      metaList.className = 'usa-collection__meta';
      metaList.setAttribute('aria-label', 'More information');

      metadata.forEach((meta) => {
        const items = createMetaItems(meta.type, meta.value);
        items.forEach((metaItem) => metaList.appendChild(metaItem));
      });

      body.appendChild(metaList);
    }

    // Add tags list
    if (tags.length > 0) {
      const tagsList = document.createElement('ul');
      tagsList.className = 'usa-collection__meta';
      tagsList.setAttribute('aria-label', 'Topics');

      tags.forEach((tagString) => {
        const items = createMetaItems('tags', tagString);
        items.forEach((tagItem) => tagsList.appendChild(tagItem));
      });

      body.appendChild(tagsList);
    }

    item.appendChild(body);
    collection.appendChild(item);
  });

  // Replace block content
  block.textContent = '';
  block.appendChild(collection);

  // Add class for styling hooks
  block.classList.add('usa-collection-block');
}
