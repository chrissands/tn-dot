/* eslint-disable */
/* global WebImporter */
/**
 * Parser for hero-video. Base: hero (existing USWDS block, variant class "video").
 * Source: https://www.tn.gov/tdot.html  Generated: 2026-09-29
 *
 * Emits DA table "Hero (video)" with ONE row / ONE cell, ordered as blocks/hero/hero.js expects:
 *   [poster picture, video link (.mp4), logo picture, H1, tagline paragraph]
 * hero.js (video variant): the .mp4 link becomes the background <video>; with two pictures
 * the LAST picture is the logo and the first one is the poster/background.
 *
 * Selectors validated against migration-work/block-context/hero-video/source.html:
 *   img.placeholder, .heading-image img, h2#hero-heading.heading, .description p, video source[src]
 */
const SOURCE_ORIGIN = 'https://www.tn.gov';

function absolutize(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `${SOURCE_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function parse(element, { document }) {
  // Poster image (fallback: any direct img that is not the logo)
  const poster = element.querySelector('img.placeholder')
    || [...element.querySelectorAll('img')].find((img) => !img.closest('.heading-image'));

  // Background video source
  const sourceEl = element.querySelector('video source[src], video[src]');
  const rawVideoSrc = sourceEl ? sourceEl.getAttribute('src') : null;

  // Logo (tristar) image
  const logo = element.querySelector('.heading-image img');

  // Heading (promoted to H1)
  const headingSrc = element.querySelector('.heading, h1, h2');

  // Tagline paragraph(s) - only non-empty ones
  const taglines = [...element.querySelectorAll('.description p')]
    .filter((p) => p.textContent.replace(/ /g, ' ').trim());

  if (!headingSrc && !taglines.length && !poster) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const contentCell = [];
  if (poster) contentCell.push(poster);

  if (rawVideoSrc) {
    const href = absolutize(rawVideoSrc);
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = href;
    a.textContent = href;
    p.append(a);
    contentCell.push(p);
  }

  if (logo) {
    if (!logo.getAttribute('alt')) logo.setAttribute('alt', 'Tennessee Department of Transportation logo');
    contentCell.push(logo);
  }

  if (headingSrc) {
    const h1 = document.createElement('h1');
    h1.textContent = headingSrc.textContent.trim();
    contentCell.push(h1);
  }

  taglines.forEach((p) => contentCell.push(p));

  // DA table header must reuse the existing block: "Hero (video)"
  const block = WebImporter.Blocks.createBlock(document, { name: 'Hero', variants: ['video'], cells: [[contentCell]] });
  element.replaceWith(block);
}
