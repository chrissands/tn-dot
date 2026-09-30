/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: TDOT section breaks + Section Metadata.
 * Uses payload.template.sections from page-templates.json.
 *
 * beforeTransform: resolve every section element while the DOM is untouched
 *   (positional :nth-of-type selectors are still valid - the cleanup transformer
 *   removes nothing inside #main before parsing) and insert <hr> breaks.
 *   <hr> is not a <div>, so div:nth-of-type() positions used by parsers are unaffected.
 *   For styled sections, a marker attribute is placed on the <hr>; for sections with
 *   a photographic background, the bg image src (div.bgimg > img, verified in
 *   cleaned.html) is captured on the marker before parsers replace the element.
 * afterTransform: insert Section Metadata after each marker (reverse order).
 */
const SECTION_MARKER_ATTR = 'data-excat-section-id';
const SECTION_BG_ATTR = 'data-excat-section-bg';

// Sections whose source wrapper has a photographic background image
// (authoring-analysis.json sectionMetadata.background). Section 3's bgimg is a
// flat navy rectangle, covered by style "dark", so it is intentionally excluded.
const SECTIONS_WITH_BG_IMAGE = ['5', '7'];

function querySection(root, selectors) {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  for (const sel of list) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  return null;
}

export default function transform(hookName, element, payload) {
  const sections = (payload && payload.template && payload.template.sections) || [];
  if (sections.length < 2) return;

  if (hookName === 'beforeTransform') {
    // Resolve all section elements first, before any DOM mutation.
    const resolved = sections.map((section) => querySection(element, section.selector));

    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      if (i === 0 && !section.style) continue;
      const sectionEl = resolved[i];
      if (!sectionEl) continue;

      const hr = document.createElement('hr');
      if (section.style) {
        hr.setAttribute(SECTION_MARKER_ATTR, section.id);
        if (SECTIONS_WITH_BG_IMAGE.includes(String(section.id))) {
          const bgImg = sectionEl.querySelector(':scope > div > .bgimg > img')
            || sectionEl.querySelector('.bgimg > img');
          let src = bgImg && bgImg.getAttribute('src');
          if (!src) {
            // Live DOM: background is an inline style on div.bgimg, not an <img>
            const bgEl = sectionEl.querySelector('.bgimg[style*="background-image"]');
            const match = bgEl && bgEl.getAttribute('style').match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
            if (match) src = new URL(match[1], 'https://www.tn.gov').href;
          }
          if (src) hr.setAttribute(SECTION_BG_ATTR, src);
        }
      }
      sectionEl.before(hr);
    }
  }

  if (hookName === 'afterTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      if (!section.style) continue;

      const marker = element.querySelector(`[${SECTION_MARKER_ATTR}="${section.id}"]`);
      const anchor = marker || querySection(element, section.selector);
      if (!anchor) continue;

      const cells = { style: section.style };
      const bgSrc = marker && marker.getAttribute(SECTION_BG_ATTR);
      if (bgSrc) {
        const img = document.createElement('img');
        img.src = bgSrc;
        img.alt = '';
        cells.background = img;
      }

      const metadataBlock = WebImporter.Blocks.createBlock(document, {
        name: 'Section Metadata',
        cells,
      });
      anchor.after(metadataBlock);

      if (marker) {
        marker.removeAttribute(SECTION_MARKER_ATTR);
        marker.removeAttribute(SECTION_BG_ATTR);
        if (i === 0) marker.remove();
      }
    }
  }
}
