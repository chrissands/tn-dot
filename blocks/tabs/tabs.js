// eslint-disable-next-line import/no-unresolved
import {
  buildBlock, decorateBlock, loadBlock, toClassName,
} from '../../scripts/aem.js';

/**
 * tabs block
 * One row per tab: label | content. Tabs from 600px; below that each panel gets an
 * accordion header (all collapsed, independently expandable), as on tn.gov.
 *
 * Content enhancements inside panels (nested blocks can't be authored in a tab cell):
 *   - a picture paragraph followed by a paragraph with only a YouTube/Vimeo link becomes
 *     a Video block (picture = poster, link text = play label, e.g. "Watch video")
 *   - an H2 or H3 directly followed by a list of links becomes a links panel (tn.gov
 *     "Related Links": gray title bar, divided links)
 */

const DESKTOP = window.matchMedia('(width >= 600px)');
const VIDEO_LINK = /(youtube\.com\/watch|youtu\.be\/|youtube\.com\/embed\/|vimeo\.com\/)/;

/** el holds exactly one child element matching selector, and no other text */
const onlyChild = (el, selector) => el && el.children.length === 1
  && el.firstElementChild.matches(selector)
  && el.textContent.trim() === el.firstElementChild.textContent.trim();

async function decorateVideos(panel) {
  const links = [...panel.querySelectorAll('p > a[href]')].filter((a) => VIDEO_LINK.test(a.href) && onlyChild(a.parentElement, 'a'));
  await Promise.all(links.map(async (a) => {
    const para = a.parentElement;
    const prev = para.previousElementSibling;
    const poster = prev && prev.tagName === 'P' && onlyChild(prev, 'picture') ? prev.querySelector('picture') : null;
    const video = buildBlock('video', [[{ elems: poster ? [poster, a] : [a] }]]);
    para.replaceWith(video);
    if (poster) prev.remove();
    decorateBlock(video);
    await loadBlock(video);
  }));
}

function decorateLinkPanels(panel) {
  panel.querySelectorAll('h2, h3').forEach((heading) => {
    const list = heading.nextElementSibling;
    if (!list || list.tagName !== 'UL') return;
    const items = [...list.children];
    if (!items.length || !items.every((li) => onlyChild(li, 'a'))) return;
    const box = document.createElement('div');
    box.className = 'tabs-links';
    heading.classList.add('tabs-links-title');
    heading.replaceWith(box);
    box.append(heading, list);
  });
}

export default async function decorate(block) {
  // build tablist
  const tablist = document.createElement('div');
  tablist.className = 'tabs-list';
  tablist.setAttribute('role', 'tablist');

  const panels = [];
  let selected = null;
  const sync = () => {
    panels.forEach(({ panel, button, toggle }) => {
      const open = DESKTOP.matches ? panel === selected : toggle.getAttribute('aria-expanded') === 'true';
      panel.setAttribute('aria-hidden', !open);
      button.setAttribute('aria-selected', panel === selected);
      button.tabIndex = panel === selected ? 0 : -1;
    });
  };

  // decorate tabs and tabpanels
  const tabs = [...block.children].map((child) => child.firstElementChild);
  tabs.forEach((tab, i) => {
    const id = toClassName(tab.textContent);

    // decorate tabpanel
    const tabpanel = tab.parentElement;
    tabpanel.className = 'tabs-panel';
    tabpanel.id = `tabpanel-${id}`;
    tabpanel.setAttribute('aria-labelledby', `tab-${id}`);
    tabpanel.setAttribute('role', 'tabpanel');

    // build tab button
    const button = document.createElement('button');
    button.className = 'tabs-tab';
    button.id = `tab-${id}`;
    button.innerHTML = tab.innerHTML;
    button.setAttribute('aria-controls', `tabpanel-${id}`);
    button.setAttribute('role', 'tab');
    button.setAttribute('type', 'button');
    button.addEventListener('click', () => {
      selected = tabpanel;
      sync();
    });
    tablist.append(button);

    // mobile accordion header
    const toggle = document.createElement('button');
    toggle.className = 'tabs-accordion-toggle';
    toggle.type = 'button';
    toggle.textContent = tab.textContent.trim();
    toggle.setAttribute('aria-controls', tabpanel.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      toggle.setAttribute('aria-expanded', toggle.getAttribute('aria-expanded') !== 'true');
      sync();
    });
    tabpanel.before(toggle);

    tab.remove();
    panels.push({ panel: tabpanel, button, toggle });
    if (i === 0) selected = tabpanel;
  });

  // arrow keys move between tabs (WAI-ARIA tabs pattern)
  tablist.addEventListener('keydown', (e) => {
    const index = panels.findIndex((p) => p.panel === selected);
    let next = null;
    if (e.key === 'ArrowRight') next = (index + 1) % panels.length;
    if (e.key === 'ArrowLeft') next = (index - 1 + panels.length) % panels.length;
    if (next === null) return;
    e.preventDefault();
    selected = panels[next].panel;
    sync();
    panels[next].button.focus();
  });

  block.prepend(tablist);
  DESKTOP.addEventListener('change', sync);
  sync();

  await Promise.all(panels.map(async ({ panel }) => {
    decorateLinkPanels(panel);
    await decorateVideos(panel);
  }));
}
