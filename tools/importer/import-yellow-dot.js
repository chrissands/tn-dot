/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the TDOT Yellow DOT Program page.
 * Source: https://www.tn.gov/tdot/traffic-operations-division/yellow-dot-program.html
 * Target: /traffic-operations-division/yellow-dot-program (template: left-nav)
 *
 * Output
 *   - Section 1: Side Nav (subnav) – Traffic Operations left nav
 *   - Section 2: H1, intro text, Tabs block – one row per tab: label | content.
 *     Tab content keeps the source order: rich text, centered images, the video as a
 *     poster image followed by a YouTube link ("Watch video"; tabs.js turns the pair
 *     into a Video block), and Related Links as an H2 + list of links (tabs.js shows
 *     it as the gray-headed links panel).
 *   - Metadata: title, description, template
 */
import {
  clean, el, href, buildSideNav, cleanRte, buildImage, imageSrc, youtubeUrl, mapSitePath, metadata,
} from './lib/tn-common.js';

/** poster image from the tn-video background-image style (\2f-escaped path) */
function videoPoster(video) {
  const styled = video.querySelector('[style*="background-image"]');
  if (!styled) return null;
  const m = styled.getAttribute('style').match(/url\(([^)]+)\)/);
  if (!m) return null;
  const path = m[1].replace(/['"]/g, '').replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return imageSrc(path);
}

function tabContent(document, pane) {
  const out = [];
  const parts = pane.querySelectorAll('.tn-rte, .tn-image, .tn-video, .tn-relatedcontent');
  parts.forEach((part) => {
    if (part.parentElement.closest('.tn-rte, .tn-image, .tn-video, .tn-relatedcontent')) return;
    if (part.classList.contains('tn-rte')) {
      out.push(...cleanRte(document, part));
    } else if (part.classList.contains('tn-image')) {
      out.push(...buildImage(document, part));
    } else if (part.classList.contains('tn-video')) {
      const link = part.querySelector('a[href]');
      if (!link) return;
      const poster = videoPoster(part);
      if (poster) out.push(el(document, 'p', {}, [el(document, 'img', { src: poster, alt: '' })]));
      out.push(el(document, 'p', {}, [el(document, 'a', { href: youtubeUrl(link.getAttribute('href')) }, [clean(link.textContent) || 'Watch video'])]));
    } else if (part.classList.contains('tn-relatedcontent')) {
      out.push(el(document, 'h2', {}, [clean((part.querySelector('.title') || {}).textContent) || 'Related Links']));
      const ul = el(document, 'ul');
      part.querySelectorAll('li a[href]').forEach((a) => {
        ul.append(el(document, 'li', {}, [el(document, 'a', { href: href(a.getAttribute('href')) }, [clean(a.textContent)])]));
      });
      out.push(ul);
    }
  });
  return out;
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
      if (part.classList.contains('tn-tabs')) {
        const labels = [...part.querySelectorAll('.nav-tabs [role="tab"]')];
        const rows = labels.map((tab) => {
          const pane = part.querySelector(tab.getAttribute('data-bs-target'));
          return [clean(tab.textContent), pane ? tabContent(document, pane) : ''];
        });
        main.append(WebImporter.Blocks.createBlock(document, { name: 'Tabs', cells: rows }));
      } else if (part.classList.contains('tn-rte')) {
        main.append(...cleanRte(document, part));
      } else if (part.classList.contains('tn-image')) {
        main.append(...buildImage(document, part));
      }
    });

    const firstText = clean((main.querySelector(':scope > p') || {}).textContent) || title;
    const description = clean((document.querySelector('meta[name="description"]') || {}).content)
      || (firstText.length > 160 ? `${firstText.slice(0, 157).replace(/\s+\S*$/, '')}…` : firstText);
    main.append(el(document, 'hr'), metadata(document, { title, description, template: 'left-nav' }));

    const sourcePath = new URL(params.originalURL).pathname;
    return [{ element: main, path: mapSitePath(sourcePath), report: { title } }];
  },
};
