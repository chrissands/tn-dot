/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: TDOT (tn.gov/tdot) site-wide cleanup.
 * All selectors verified in migration-work/cleaned.html.
 *
 * Ordering rule: page-templates.json uses positional selectors under
 * "#main > div:nth-of-type(2) > div...:nth-of-type(N)". Nothing inside #main
 * is removed in beforeTransform (e.g. div.tn-pagetitle is #main > div:nth-of-type(1),
 * the empty tn-rte placeholder is div #2 of the content container), so parser
 * and section selectors keep resolving. Only body-level chrome outside #main
 * is removed before parsing.
 */
import { mapSitePath } from '../lib/tn-common.js';

const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };


// Stats block tail container. columns-stats parser handles div.columnctrl:nth-of-type(9)
// and absorbs this sibling. We only tag it here (attribute does not affect nth-of-type)
// so the afterTransform can drop an empty remnant without relying on positions.
const STATS_TAIL_SELECTOR = '#main > div:nth-of-type(2) > div.columnctrl:nth-of-type(10)';
const STATS_TAIL_ATTR = 'data-excat-stats-tail';

function isEmpty(el) {
  return !el.textContent.trim() && !el.querySelector('img, picture, video, iframe, table');
}

export default function transform(hookName, element, payload) {
  if (hookName === TransformHook.beforeTransform) {
    // Body-level chrome outside #main (does not shift #main positional selectors):
    // - a.skip-to-main: "Skip to Main Content" link
    // - noindex: wraps header#header + .tn-alerts (1st) and footer (2nd)
    // - #header / footer: fallback in case noindex wrappers are absent
    // - div.tn-backtotop: back-to-top link
    // - #overlay, #videoModal: site overlay + dynamic video modal
    // - #goog-gt-tt, .VIpgJd-ZVi9od-aZ2wEe-wOHMyf: Google Translate widgets
    // - iframe: Adobe ID syncing iframe (demdex), modal iframes
    WebImporter.DOMUtils.remove(element, [
      'a.skip-to-main',
      'noindex',
      '#header',
      'footer',
      '.tn-backtotop',
      '#overlay',
      '#videoModal',
      '#goog-gt-tt',
      '.VIpgJd-ZVi9od-aZ2wEe-wOHMyf',
      'iframe',
      'script',
      'noscript',
    ]);

    const statsTail = element.querySelector(STATS_TAIL_SELECTOR);
    if (statsTail) statsTail.setAttribute(STATS_TAIL_ATTR, '');
  }

  if (hookName === TransformHook.afterTransform) {
    // Visually hidden page title (<div class="tn-pagetitle hidden"><h1>TDOT</h1>);
    // the hero heading becomes the H1.
    WebImporter.DOMUtils.remove(element, ['.tn-pagetitle']);

    // Empty RTE placeholder: <div class="tn-rte"><p class="cq-placeholder"></p></div>
    element.querySelectorAll('.tn-rte > p.cq-placeholder').forEach((p) => {
      const rte = p.parentElement;
      if (rte && isEmpty(rte)) rte.remove();
      else p.remove();
    });

    // Stats tail remnant: remove only if the parser left it empty.
    element.querySelectorAll(`[${STATS_TAIL_ATTR}]`).forEach((el) => {
      if (isEmpty(el)) el.remove();
      else el.removeAttribute(STATS_TAIL_ATTR);
    });

    // Leftover non-authorable elements.
    WebImporter.DOMUtils.remove(element, [
      'noindex',
      'header',
      'footer',
      'iframe',
      'link',
      'style',
      'script',
      'noscript',
      '.tn-backtotop',
    ]);

    element.querySelectorAll('[onclick]').forEach((el) => el.removeAttribute('onclick'));

    // Decorative div.bgimg backgrounds: section backgrounds were already captured by
    // the sections transformer; drop the styles so transformBackgroundImages doesn't
    // emit stray (or empty-src) images into default content.
    element.querySelectorAll('.bgimg[style]').forEach((el) => el.removeAttribute('style'));

    // Images with no src (placeholders) and their now-empty wrappers.
    element.querySelectorAll('img:not([src]), img[src=""]').forEach((img) => {
      const wrapper = img.closest('p') || img.closest('picture') || img;
      wrapper.remove();
    });

    // Empty spacer headings (<h2>&nbsp;</h2>) from the source RTE.
    element.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
      if (!h.textContent.replace(/ /g, ' ').trim() && !h.querySelector('img, picture')) h.remove();
    });

    // Site-relative links point at tn.gov; make them absolute so they keep working
    // (/content/tn/tdot/... and /content/tn//tdot/... both resolve as /tdot/...).
    element.querySelectorAll('a[href^="/"]').forEach((a) => {
      // site-hosted media (e.g. the hero video published as /media/*.mp4) stays local
      if (a.getAttribute('href').startsWith('/media/')) return;
      const path = a.getAttribute('href').replace(/^\/content\/tn\/+/, '/');
      a.setAttribute('href', `https://www.tn.gov${path}`);
    });

    // Migrated pages (see MIGRATED in lib/tn-common.js): link to them on this site.
    element.querySelectorAll('a[href^="https://www.tn.gov/"]').forEach((a) => {
      const url = new URL(a.getAttribute('href'));
      const mapped = mapSitePath(url.pathname);
      if (mapped) a.setAttribute('href', `${mapped}${url.search}${url.hash}`);
    });
  }
}
