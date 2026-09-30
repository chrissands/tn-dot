/**
 * footer block
 * Based on the USWDS usa-footer component, styled after the TN.gov / TDOT footer:
 *   band 1 – social media bar
 *   band 2 – link columns (accordions on mobile) + contact info + seal
 *   band 3 – utility bar (flag status, chat, help, translate, font size) + center emblem
 *   band 4 – bottom links
 *
 * Content comes from the footer fragment (content/footer.plain.html), sections in order:
 *   1 social  – label paragraph + list of links (icon image + network name)
 *   2 links   – repeated bold heading paragraph + list
 *   3 contact – paragraphs (name, address, email) + image (seal)
 *   4 utility – lists of links (icon + label; "#translate" and "#font-size" become panels,
 *               a nested list under "#font-size" holds its option labels) + emblem image
 *   5 bottom  – lists of links
 *   6 back to top – link whose text is the floating button's accessible label
 *
 * @see https://designsystem.digital.gov/components/footer/
 */

import { fetchContent } from '../../scripts/content-fetch.js';

const FONT_SIZES = ['small', 'normal', 'large'];
const FONT_SIZE_KEY = 'footer-font-size';
const SHOW_BACK_TO_TOP_AFTER = 150;
let idCounter = 0;

/**
 * Publishing splits a link holding an image and text into two links (image link +
 * text link, each in its own paragraph). Rejoin links with the same href inside a
 * list item so icon + label stay one link, as authored.
 * @param {Element} root fragment content
 */
function mergeSplitLinks(root) {
  root.querySelectorAll('li').forEach((li) => {
    const links = [...li.querySelectorAll(':scope > a, :scope > p > a')];
    if (links.length < 2) return;
    const [first, ...rest] = links;
    if (!rest.every((a) => a.getAttribute('href') === first.getAttribute('href'))) return;
    rest.forEach((a) => {
      const parent = a.parentElement;
      first.append(' ', ...a.childNodes);
      a.remove();
      if (parent !== li && !parent.textContent.trim() && !parent.children.length) parent.remove();
    });
    const wrapper = first.parentElement;
    if (wrapper !== li && wrapper.tagName === 'P' && wrapper.children.length === 1) wrapper.replaceWith(first);
  });
}

/**
 * Fetches the footer fragment. Metadata-independent dual fetch (fetchContent):
 * /footer.plain.html on the published site, /content/footer.plain.html in local
 * preview, each falling back to the other.
 * @returns {Promise<Element|null>}
 */
async function fetchFooter() {
  const resp = await fetchContent('/footer.plain.html');
  if (!resp.ok) return null;
  const container = document.createElement('div');
  container.innerHTML = await resp.text();
  container.querySelectorAll('img[src]').forEach((img) => {
    img.src = new URL(img.getAttribute('src'), resp.url).href;
  });
  mergeSplitLinks(container);
  return container;
}

function srOnly(text) {
  const span = document.createElement('span');
  span.className = 'usa-sr-only';
  span.textContent = text;
  return span;
}

function wrap(className, ...children) {
  const band = document.createElement('div');
  band.className = className;
  const inner = document.createElement('div');
  inner.className = 'footer-inner';
  inner.append(...children);
  band.append(inner);
  return band;
}

/** Icon rendered as a CSS mask so it takes the text color (like the source icon font). */
function maskIcon(src) {
  const span = document.createElement('span');
  span.className = 'footer-icon';
  span.setAttribute('aria-hidden', 'true');
  span.style.setProperty('--footer-icon', `url("${src}")`);
  return span;
}

function copyImg(img, className, alt = img.alt) {
  const copy = document.createElement('img');
  copy.src = img.src;
  copy.alt = alt;
  copy.loading = 'lazy';
  if (className) copy.className = className;
  return copy;
}

/** Social bar: label + icon links (network name kept for screen readers). */
function buildSocial(section) {
  const label = section.querySelector('p');
  const title = document.createElement('p');
  title.className = 'footer-social-title';
  title.textContent = label ? label.textContent.trim() : '';
  const list = document.createElement('ul');
  list.className = 'footer-social-list';
  section.querySelectorAll('li > a').forEach((a) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = a.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const img = a.querySelector('img');
    if (img) link.append(maskIcon(img.src));
    link.append(srOnly(a.textContent.trim()));
    li.append(link);
    list.append(li);
  });
  return wrap('footer-social', title, list);
}

/** Link columns: each bold heading paragraph + following list; accordion toggle on mobile. */
function buildColumn(headingP) {
  const col = document.createElement('div');
  col.className = 'footer-col';
  const heading = document.createElement('p');
  heading.className = 'footer-col-title';
  const a = headingP.querySelector('a');
  if (a) {
    const link = document.createElement('a');
    link.href = a.href;
    link.textContent = a.textContent.trim();
    heading.append(link);
  } else {
    heading.textContent = headingP.textContent.trim();
  }

  const list = document.createElement('ul');
  list.className = 'footer-col-list';
  list.id = `footer-col-list-${idCounter += 1}`;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'footer-col-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', list.id);
  toggle.setAttribute('aria-label', `${heading.textContent} links`);
  toggle.append(maskIcon(`${window.hlx.codeBasePath}/icons/usa-icons/expand_more.svg`));
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    col.classList.toggle('footer-col-open', open);
  });
  heading.append(toggle);
  col.append(heading, list);
  return { col, list };
}

function buildColumns(section) {
  const cols = [];
  let current = null;
  [...section.children].forEach((el) => {
    if (el.tagName === 'P' && el.querySelector('strong')) {
      current = buildColumn(el);
      cols.push(current.col);
    } else if (el.tagName === 'UL' && current) {
      el.querySelectorAll(':scope > li > a').forEach((a) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = a.href;
        link.textContent = a.textContent.trim();
        li.append(link);
        current.list.append(li);
      });
    }
  });
  return cols;
}

/** Contact block: paragraphs as authored + seal image. */
function buildContact(section) {
  const contact = document.createElement('div');
  contact.className = 'footer-contact';
  if (!section) return contact;
  [...section.children].forEach((el) => {
    const img = el.querySelector('img');
    if (img && !el.textContent.trim()) {
      const seal = document.createElement('p');
      seal.className = 'footer-seal';
      seal.append(copyImg(img));
      contact.append(seal);
    } else {
      const p = el.cloneNode(true);
      p.querySelectorAll('picture').forEach((pic) => pic.replaceWith(...pic.childNodes));
      contact.append(p);
    }
  });
  return contact;
}

function closePanels(scope, except) {
  scope.querySelectorAll('.footer-utility-item[aria-expanded="true"]').forEach((item) => {
    if (item === except) return;
    item.setAttribute('aria-expanded', 'false');
    item.querySelector(':scope > a').setAttribute('aria-expanded', 'false');
  });
}

/** Loads the Google Translate element into the given container (once). */
function loadTranslate(container) {
  if (container.dataset.loaded) return;
  container.dataset.loaded = 'true';
  const target = document.createElement('div');
  target.id = `footer-translate-${idCounter += 1}`;
  container.append(target);
  window.footerTranslateInit = () => {
    // eslint-disable-next-line no-new
    new window.google.translate.TranslateElement({ pageLanguage: 'en' }, target.id);
  };
  const script = document.createElement('script');
  script.src = 'https://translate.google.com/translate_a/element.js?cb=footerTranslateInit';
  script.async = true;
  document.head.append(script);
}

function applyFontSize(size, buttons) {
  if (size === 'normal') delete document.documentElement.dataset.fontSize;
  else document.documentElement.dataset.fontSize = size;
  buttons.forEach((btn) => {
    const active = btn.dataset.size === size;
    btn.classList.toggle('footer-font-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  try {
    localStorage.setItem(FONT_SIZE_KEY, size);
  } catch (e) { /* storage unavailable */ }
}

/** Builds a panel (translate widget or font-size options) attached to a utility item. */
function buildPanel(item, link, kind, options) {
  const panel = document.createElement('div');
  panel.className = `footer-panel footer-panel-${kind}`;
  panel.id = `footer-panel-${idCounter += 1}`;
  link.setAttribute('role', 'button');
  link.setAttribute('aria-expanded', 'false');
  link.setAttribute('aria-controls', panel.id);

  if (kind === 'font-size') {
    const list = document.createElement('ul');
    const buttons = options.map((label, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'footer-font-btn';
      btn.dataset.size = FONT_SIZES[i] || 'normal';
      btn.textContent = label;
      btn.addEventListener('click', () => applyFontSize(btn.dataset.size, buttons));
      const li = document.createElement('li');
      li.append(btn);
      list.append(li);
      return btn;
    });
    panel.append(list);
    let saved = 'normal';
    try {
      saved = localStorage.getItem(FONT_SIZE_KEY) || 'normal';
    } catch (e) { /* storage unavailable */ }
    applyFontSize(FONT_SIZES.includes(saved) ? saved : 'normal', buttons);
  }

  link.addEventListener('click', (e) => {
    e.preventDefault();
    const open = item.getAttribute('aria-expanded') !== 'true';
    closePanels(item.closest('.footer-utility'), item);
    item.setAttribute('aria-expanded', open ? 'true' : 'false');
    link.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && kind === 'translate') loadTranslate(panel);
  });
  item.append(panel);
}

/** Utility bar: icon links; special hrefs become panels, chat opens a popup window. */
function buildUtility(section) {
  const lists = [];
  let emblem = null;
  [...section.children].forEach((el) => {
    if (el.tagName === 'UL') {
      const list = document.createElement('ul');
      list.className = 'footer-utility-list';
      el.querySelectorAll(':scope > li').forEach((srcLi) => {
        const a = srcLi.querySelector('a');
        if (!a) return;
        const item = document.createElement('li');
        item.className = 'footer-utility-item';
        const link = document.createElement('a');
        link.href = a.href;
        const img = a.querySelector('img');
        if (img) link.append(maskIcon(img.src));
        link.append(document.createTextNode(a.textContent.trim()));
        item.append(link);
        const href = a.getAttribute('href') || '';
        if (href === '#translate') {
          buildPanel(item, link, 'translate', []);
        } else if (href === '#font-size') {
          const options = [...srcLi.querySelectorAll('ul > li')].map((li) => li.textContent.trim());
          buildPanel(item, link, 'font-size', options);
        } else if (/chat/i.test(href)) {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(link.href, 'popup', 'width=900, height=600');
          });
        }
        list.append(item);
      });
      lists.push(list);
    } else if (el.querySelector('img')) {
      emblem = document.createElement('span');
      emblem.className = 'footer-emblem';
      emblem.append(copyImg(el.querySelector('img'), '', ''));
    }
  });
  const inner = [];
  if (lists[0]) inner.push(lists[0]);
  if (emblem) inner.push(emblem);
  inner.push(...lists.slice(1));
  const band = wrap('footer-utility', ...inner);
  document.addEventListener('click', (e) => {
    if (!band.contains(e.target)) closePanels(band);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanels(band);
  });
  return band;
}

/** Bottom bar: link lists. */
function buildBottom(section) {
  const lists = [...section.querySelectorAll(':scope > ul')].map((ul) => {
    const list = document.createElement('ul');
    list.className = 'footer-bottom-list';
    ul.querySelectorAll(':scope > li > a').forEach((a) => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = a.href;
      link.textContent = a.textContent.trim();
      li.append(link);
      list.append(li);
    });
    return list;
  });
  return wrap('footer-bottom', ...lists);
}

/**
 * Floating back-to-top button: shows after scrolling, docks above the footer on
 * desktop, scrolls smoothly to the top and moves focus to the header logo.
 * @param {Element} section back-to-top section
 * @param {Element} footerEl the page footer (docking reference)
 */
function buildBackToTop(section, footerEl) {
  const src = section.querySelector('a');
  if (!src) return null;
  const button = document.createElement('a');
  button.href = '#top';
  button.className = 'footer-back-to-top';
  button.setAttribute('aria-label', src.textContent.trim());
  button.append(maskIcon(`${window.hlx.codeBasePath}/icons/usa-icons/arrow_upward.svg`));

  const desktop = window.matchMedia('(width >= 900px)');
  let ticking = false;
  const update = () => {
    ticking = false;
    button.classList.toggle('footer-back-to-top-visible', window.scrollY > SHOW_BACK_TO_TOP_AFTER);
    // desktop: keep the button above the footer once the footer scrolls into view
    let bottom = 20;
    if (desktop.matches && footerEl) {
      const footerTop = footerEl.getBoundingClientRect().top;
      if (footerTop < window.innerHeight) {
        bottom = Math.max(20, window.innerHeight - footerTop + 46);
      }
    }
    button.style.bottom = `${bottom}px`;
  };
  const schedule = () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();

  button.addEventListener('click', (e) => {
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    const focusTarget = () => {
      const target = document.querySelector('header .header-brand a, header a');
      if (target) target.focus({ preventScroll: true });
    };
    if (reduce || !('onscrollend' in window)) focusTarget();
    else window.addEventListener('scrollend', focusTarget, { once: true });
  });
  return button;
}

/**
 * Decorates the footer block
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const fragment = await fetchFooter();
  if (!fragment) return;
  const [social, links, contact, utility, bottom, backToTop] = fragment
    .querySelectorAll(':scope > div');

  const footerEl = block.closest('footer');
  if (footerEl) footerEl.classList.add('footer-tdot');

  const bands = [];
  if (social) bands.push(buildSocial(social));
  const agency = wrap('footer-agency', ...(links ? buildColumns(links) : []), buildContact(contact));
  bands.push(agency);
  if (utility) bands.push(buildUtility(utility));
  if (bottom) bands.push(buildBottom(bottom));

  block.textContent = '';
  block.append(...bands);
  const topButton = backToTop && buildBackToTop(backToTop, footerEl);
  if (topButton) block.append(topButton);
}
