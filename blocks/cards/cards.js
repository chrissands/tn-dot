/**
 * cards block
 *
 * This component does not require JavaScript initialization.
 *
 * EDS enhancement: when a card-group option class (news, people, tiles, media) is set,
 * each authored row (image cell | text cell) is decorated into a USWDS
 * usa-card-group of usa-card items. Without an option class the block is left
 * untouched (CSS only), as before.
 */

import { createOptimizedPicture, readBlockConfig } from '../../scripts/aem.js';
import { fetchNewsIndex, newsHref } from '../../scripts/news.js';

const CARD_GROUP_OPTIONS = ['news', 'people', 'tiles', 'media'];

/** Picture for an index image: optimized when served from this site, plain img otherwise. */
function indexPicture(src, alt) {
  if (/^https?:/i.test(src) && new URL(src).origin !== window.location.origin) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.loading = 'lazy';
    return img;
  }
  return createOptimizedPicture(src, alt, false, [{ width: '750' }]);
}

/** Stand-in media for articles without a photo: navy tile with the TN mark + TDOT wordmark. */
function newsPlaceholder() {
  const tile = document.createElement('div');
  tile.className = 'news-card-placeholder';
  [['tn-logo.png', 'news-card-placeholder-mark'], ['tdot-logo-white.png', 'news-card-placeholder-wordmark']]
    .forEach(([file, className]) => {
      const img = document.createElement('img');
      img.src = `${window.hlx.codeBasePath}/images/${file}`;
      img.alt = '';
      img.className = className;
      img.loading = 'lazy';
      tile.append(img);
    });
  return tile;
}

/**
 * "latest" option: cards built from the news index (newest first). The block holds
 * settings rows instead of cards:
 *   | Source    | /news/query-index.json |  (optional, default)
 *   | Count     | 3                      |
 *   | Link Text | Read more              |
 * Each card: the article's image (or a TDOT placeholder tile), title, description and
 * a link to the article. The block is removed when the index has no entries.
 * @param {Element} block The cards block
 */
async function applyLatestNews(block) {
  const config = readBlockConfig(block);
  const count = Math.max(1, parseInt(config.count, 10) || 3);
  const linkText = config['link-text'] || 'Read more';
  let entries = [];
  try {
    entries = (await fetchNewsIndex(config.source || undefined)).slice(0, count);
  } catch (e) {
    entries = [];
  }
  block.textContent = '';
  entries.forEach((entry) => {
    const row = document.createElement('div');
    const mediaCell = document.createElement('div');
    mediaCell.append(entry.image ? indexPicture(entry.image, entry.title) : newsPlaceholder());

    const text = document.createElement('div');
    const heading = document.createElement('h3');
    heading.textContent = entry.title;
    text.append(heading);
    if (entry.description) {
      const desc = document.createElement('p');
      desc.textContent = entry.description;
      text.append(desc);
    }
    // same markup decorateButtons gives an authored "Read more" link
    const linkPara = document.createElement('p');
    linkPara.className = 'button-container';
    const link = document.createElement('a');
    link.className = 'usa-button';
    link.href = newsHref(entry.path);
    link.textContent = linkText;
    link.setAttribute('aria-label', `${linkText}: ${entry.title}`);
    linkPara.append(link);
    text.append(linkPara);

    row.append(mediaCell, text);
    block.append(row);
  });
}

/**
 * Builds a USWDS card list item from an authored row.
 * @param {Element} row The authored row (div > div cells)
 * @returns {Element} li.usa-card
 */
function buildCard(row) {
  const card = document.createElement('li');
  card.className = 'usa-card';

  const container = document.createElement('div');
  container.className = 'usa-card__container';

  const elements = [...row.children].flatMap((cell) => {
    // A cell holding only a picture (optionally wrapped in a link) is media.
    const picture = cell.querySelector('picture, img');
    if (picture && !cell.textContent.trim()) return [{ type: 'media', node: cell }];
    return [...cell.children].map((child) => ({ type: 'content', node: child }));
  });

  let header = null;
  let body = null;
  let footer = null;

  elements.forEach(({ type, node }) => {
    if (type === 'media') {
      const media = document.createElement('div');
      media.className = 'usa-card__media';
      const img = document.createElement('div');
      img.className = 'usa-card__img';
      img.append(...node.childNodes);
      media.append(img);
      container.append(media);
      return;
    }

    if (!header && node.matches('h1, h2, h3, h4, h5, h6')) {
      header = document.createElement('div');
      header.className = 'usa-card__header';
      node.classList.add('usa-card__heading');
      header.append(node);
      return;
    }

    // A trailing paragraph containing only a link becomes the card footer.
    const links = node.querySelectorAll('a');
    const linkOnly = links.length === 1 && node.textContent.trim() === links[0].textContent.trim();
    if (linkOnly) {
      if (!footer) {
        footer = document.createElement('div');
        footer.className = 'usa-card__footer';
      }
      footer.append(node);
      return;
    }

    if (!body) {
      body = document.createElement('div');
      body.className = 'usa-card__body';
    }
    body.append(node);
  });

  [header, body, footer].filter(Boolean).forEach((el) => container.append(el));
  if (!container.querySelector('.usa-card__media')) card.classList.add('usa-card--no-media');

  card.append(container);
  return card;
}

export default async function decorate(block) {
  // Component is styled with CSS only
  // Add any EDS-specific enhancements here if needed
  if (!block || !CARD_GROUP_OPTIONS.some((cls) => block.classList.contains(cls))) return;
  if (block.classList.contains('latest')) {
    await applyLatestNews(block);
    if (!block.children.length) {
      block.closest('.cards-wrapper')?.remove();
      return;
    }
  }

  const group = document.createElement('ul');
  group.className = 'usa-card-group';
  [...block.children].forEach((row) => group.append(buildCard(row)));

  block.textContent = '';
  block.append(group);
}
