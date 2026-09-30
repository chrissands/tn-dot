/**
 * header block
 * Based on the USWDS usa-header component, styled after the TDOT (tn.gov) agency header:
 *   row 1 – agency bar: state mark + agency wordmark, utility link, site search
 *   row 2 – primary nav: home icon, hover dropdowns, links, print
 *
 * Content comes from the nav fragment (content/nav.plain.html):
 *   section 1 – brand: linked images (first = state mark, second = agency wordmark),
 *               a standalone image = header background photo
 *   section 2 – nav: list; an item with a nested list becomes a dropdown
 *   section 3 – tools: utility link(s), search link (text = placeholder, href = results page),
 *               "#print" link
 *
 * @see https://designsystem.digital.gov/components/header/
 */

import { getMetadata, decorateBlock, loadBlock } from '../../scripts/aem.js';
import { fetchContent, isLocalPreview } from '../../scripts/content-fetch.js';
import normalizeIcons, { iconName } from '../../scripts/fragment-icons.js';
import { loadPlaceholders, t } from '../../scripts/placeholders.js';

const DESKTOP = window.matchMedia('(width >= 900px)');
let idCounter = 0;

/**
 * Local preview has no access to content.da.live: use the local copy of DA images
 * (/content/<path>; images kept in a document's .nav / .footer media folder -> /content/images/).
 */
function localImage(src) {
  const m = isLocalPreview() && src.match(/^https:\/\/content\.da\.live\/[^/]+\/[^/]+(\/.*)$/);
  if (!m) return src;
  const media = m[1].match(/^\/\.[a-z-]+\/([^/]+)$/);
  return media ? `/content/images/${media[1]}` : `/content${m[1]}`;
}

/**
 * Fetches the nav fragment. Metadata-independent dual fetch (fetchContent):
 * /nav.plain.html on the published site, /content/nav.plain.html in local preview,
 * each falling back to the other.
 * @returns {Promise<Element|null>} container with the fragment sections
 */
async function fetchNav() {
  const resp = await fetchContent('/nav.plain.html');
  if (!resp.ok) return null;
  const html = await resp.text();
  const container = document.createElement('div');
  container.innerHTML = html;
  // resolve relative media paths against the fragment location
  container.querySelectorAll('img[src], source[srcset]').forEach((el) => {
    if (el.hasAttribute('src')) el.src = localImage(new URL(el.getAttribute('src'), resp.url).href);
    if (el.hasAttribute('srcset')) el.srcset = localImage(new URL(el.getAttribute('srcset').split(' ')[0], resp.url).href);
  });
  normalizeIcons(container);
  return container;
}

function srOnly(text) {
  const span = document.createElement('span');
  span.className = 'usa-sr-only';
  span.textContent = text;
  return span;
}

function createIcon(name) {
  const img = document.createElement('img');
  img.src = `${window.hlx.codeBasePath}/icons/usa-icons/${name}.svg`;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.className = 'header-icon';
  return img;
}

/**
 * Builds the brand area (logos) from the brand section.
 * @param {Element} section brand section
 * @param {Element} agency agency bar element (receives the background photo)
 */
function buildBrand(section, agency) {
  const brand = document.createElement('div');
  brand.className = 'header-brand';
  if (!section) return brand;
  section.querySelectorAll('img').forEach((img) => {
    const a = img.closest('a');
    if (a) {
      const link = document.createElement('a');
      link.href = a.href;
      const logo = document.createElement('img');
      logo.src = img.src;
      logo.alt = img.alt;
      logo.className = 'header-brand-img';
      link.append(logo);
      link.className = brand.children.length ? 'header-brand-wordmark' : 'header-brand-mark';
      brand.append(link);
    } else {
      agency.style.setProperty('--header-photo', `url("${img.src}")`);
    }
  });
  return brand;
}

/**
 * Builds the site search form from a tools link (text = placeholder, href = results page).
 * @param {Element} link search link from the tools section
 */
function buildSearch(link) {
  const form = document.createElement('form');
  form.className = 'header-search';
  form.setAttribute('role', 'search');
  form.action = link.href;

  const id = `header-search-${idCounter += 1}`;
  const label = document.createElement('label');
  label.className = 'usa-sr-only';
  label.htmlFor = id;
  label.textContent = link.textContent.trim();

  const input = document.createElement('input');
  input.className = 'header-search-input';
  input.id = id;
  input.type = 'search';
  input.name = 'q';
  input.placeholder = link.textContent.trim();

  const button = document.createElement('button');
  button.className = 'header-search-button';
  button.type = 'submit';
  button.setAttribute('aria-label', t('search', 'Search'));
  button.append(createIcon('search'));

  form.append(label, input, button);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    const url = new URL(form.action);
    if (q) url.hash = `q=${encodeURIComponent(q)}&tab=department`;
    window.location.href = url.href;
  });
  return form;
}

/**
 * Builds the tools (utility links, search, print) from the tools section.
 * @param {Element} section tools section
 * @returns {{ tools: Element, print: Element|null, menuLabel: { open: string, close: string } }}
 */
function buildTools(section) {
  const tools = document.createElement('div');
  tools.className = 'header-tools';
  let print = null;
  if (!section) return { tools, print, menuLabel: { open: '', close: '' } };

  // plain-text paragraphs are the mobile menu toggle labels (closed, open)
  const [openLabel = '', closeLabel = ''] = [...section.querySelectorAll('p')]
    .filter((p) => !p.querySelector('a, img') && p.textContent.trim())
    .map((p) => p.textContent.trim());
  const menuLabel = { open: openLabel, close: closeLabel || openLabel };

  section.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const img = a.querySelector('img');
    // the print link is recognized by its :print: icon (editing can rewrite '#print')
    if (href === '#print' || iconName(a) === 'print') {
      // icon link; its text is the screen-reader label
      const label = a.textContent.trim() || (img && img.alt) || 'Print this page';
      print = document.createElement('a');
      print.href = '#print';
      print.className = 'header-print';
      print.setAttribute('role', 'button');
      if (img) {
        const icon = document.createElement('img');
        icon.src = img.src;
        icon.alt = '';
        icon.className = 'header-icon';
        print.append(icon);
      }
      print.append(srOnly(label));
      print.addEventListener('click', (e) => {
        e.preventDefault();
        window.print();
      });
    } else if (/search/i.test(href)) {
      tools.append(buildSearch(a));
    } else {
      const link = document.createElement('a');
      link.href = a.href;
      link.className = 'header-utility-link';
      link.append(createIcon('home'), document.createTextNode(a.textContent.trim()));
      tools.prepend(link);
    }
  });
  return { tools, print, menuLabel };
}

function closeAll(navList, except) {
  navList.querySelectorAll(':scope > .header-nav-item[aria-expanded="true"]').forEach((item) => {
    if (item !== except) {
      item.setAttribute('aria-expanded', 'false');
      item.querySelector('.header-nav-toggle').setAttribute('aria-expanded', 'false');
    }
  });
}

function setOpen(item, open) {
  item.setAttribute('aria-expanded', open ? 'true' : 'false');
  item.querySelector('.header-nav-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
}

/**
 * Builds the primary navigation list from the nav section.
 * Items with a nested list become dropdowns: hover (desktop) or toggle button opens,
 * the item link still navigates to its landing page.
 * @param {Element} section nav section
 */
function buildNavList(section) {
  const navList = document.createElement('ul');
  navList.className = 'header-nav-list';
  const source = section && section.querySelector('ul');
  if (!source) return navList;

  [...source.children].forEach((li) => {
    const a = li.querySelector('a');
    if (!a) return;
    const item = document.createElement('li');
    item.className = 'header-nav-item';

    const link = document.createElement('a');
    link.href = a.href;
    link.className = 'header-nav-link';
    const img = a.querySelector('img');
    if (img) {
      const icon = document.createElement('img');
      icon.src = img.src;
      icon.alt = '';
      icon.className = 'header-icon';
      link.append(icon, srOnly(a.textContent.trim() || img.alt));
      item.classList.add('header-nav-item-icon');
    } else {
      link.textContent = a.textContent.trim();
    }
    item.append(link);

    const sub = li.querySelector('ul');
    if (sub) {
      const id = `header-submenu-${idCounter += 1}`;
      item.classList.add('header-nav-item-dropdown');
      item.setAttribute('aria-expanded', 'false');

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'header-nav-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', id);
      toggle.setAttribute('aria-label', t('submenu', '{label} submenu', { label: link.textContent }));
      // caret on desktop, chevron on mobile (switched in CSS)
      const caret = createIcon('arrow_drop_down');
      caret.classList.add('header-icon-caret');
      const chevron = createIcon('expand_more');
      chevron.classList.add('header-icon-chevron');
      toggle.append(caret, chevron);
      item.append(toggle);

      const submenu = document.createElement('ul');
      submenu.id = id;
      submenu.className = 'header-submenu';
      sub.querySelectorAll(':scope > li > a').forEach((sa) => {
        const subItem = document.createElement('li');
        subItem.className = 'header-submenu-item';
        const subLink = document.createElement('a');
        subLink.href = sa.href;
        subLink.textContent = sa.textContent.trim();
        subItem.append(subLink);
        submenu.append(subItem);
      });
      item.append(submenu);

      toggle.addEventListener('click', () => {
        const open = item.getAttribute('aria-expanded') !== 'true';
        if (DESKTOP.matches) closeAll(navList, item);
        setOpen(item, open);
      });
      item.addEventListener('mouseenter', () => {
        if (!DESKTOP.matches) return;
        closeAll(navList, item);
        setOpen(item, true);
      });
      item.addEventListener('mouseleave', () => {
        if (DESKTOP.matches) setOpen(item, false);
      });
      item.addEventListener('focusout', (e) => {
        if (DESKTOP.matches && !item.contains(e.relatedTarget)) setOpen(item, false);
      });
    }
    navList.append(item);
  });

  navList.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = navList.querySelector('.header-nav-item[aria-expanded="true"]');
    if (open) {
      setOpen(open, false);
      open.querySelector('.header-nav-toggle').focus();
    }
  });
  return navList;
}

/**
 * Decorates the nav fragment into the header structure.
 * @param {Element} block header block
 * @param {Element} fragment nav fragment container
 */
function decorateNav(block, fragment) {
  const [brandSection, navSection, toolsSection] = fragment.querySelectorAll(':scope > div');

  const headerEl = block.closest('header');
  if (headerEl) headerEl.classList.add('header-tdot');

  // Row 1: agency bar
  const agency = document.createElement('div');
  agency.className = 'header-agency';
  const agencyInner = document.createElement('div');
  agencyInner.className = 'header-agency-inner';
  const brand = buildBrand(brandSection, agency);
  const { tools, print, menuLabel } = buildTools(toolsSection);

  agencyInner.append(brand, tools);
  agency.append(agencyInner);

  // Row 2: primary nav (mobile: menu toggle + collapsible list)
  const nav = document.createElement('nav');
  nav.className = 'header-nav';
  nav.setAttribute('aria-label', t('primary-navigation', 'Primary navigation'));
  const navInner = document.createElement('div');
  navInner.className = 'header-nav-inner';
  const navList = buildNavList(navSection);
  navList.id = 'header-nav-list';

  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'header-menu-btn';
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-controls', navList.id);
  const bars = document.createElement('span');
  bars.className = 'header-menu-icon';
  bars.setAttribute('aria-hidden', 'true');
  bars.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
  const label = document.createElement('span');
  label.className = 'header-menu-label';
  label.textContent = menuLabel.open;
  menuBtn.append(bars, label);

  navInner.append(menuBtn, navList);
  if (print) navInner.append(print);

  // Sticky bar search shortcut: back to the top and into the search box
  const searchInput = tools.querySelector('.header-search-input');
  if (searchInput) {
    const searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.className = 'header-search-jump';
    searchBtn.setAttribute('aria-label', searchInput.placeholder);
    searchBtn.append(createIcon('search'));
    searchBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0 });
      searchInput.focus();
    });
    navInner.append(searchBtn);
  }
  nav.append(navInner);

  // Compact state mark shown in the sticky mobile bar (reuses the brand's state mark)
  const stateMark = brand.querySelector('.header-brand-mark');
  if (stateMark) {
    const mark = stateMark.cloneNode(true);
    mark.className = 'header-nav-mark';
    navInner.prepend(mark);
  }

  // Page overlay behind the open mobile menu (tap to close)
  const overlay = document.createElement('div');
  overlay.className = 'header-overlay';

  const lockScroll = () => {
    const lock = block.classList.contains('header-sticky') && block.classList.contains('header-menu-open');
    document.body.classList.toggle('header-scroll-lock', lock);
  };

  const toggleMenu = (open) => {
    block.classList.toggle('header-menu-open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    label.textContent = open ? menuLabel.close : menuLabel.open;
    lockScroll();
  };
  menuBtn.addEventListener('click', () => toggleMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  overlay.addEventListener('click', () => toggleMenu(false));

  // The nav row pins to the top once the whole header has scrolled away,
  // and returns to the flow when the page scrolls back above the agency bar.
  let ticking = false;
  const updateSticky = () => {
    ticking = false;
    const stuck = block.classList.contains('header-sticky');
    const agencyHeight = agency.offsetHeight;
    const navHeight = nav.offsetHeight;
    if (!stuck && window.scrollY >= agencyHeight + navHeight) {
      block.style.setProperty('--header-nav-height', `${navHeight}px`);
      block.classList.add('header-sticky');
    } else if (stuck && window.scrollY <= agencyHeight) {
      block.classList.remove('header-sticky');
    }
    lockScroll();
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateSticky);
    }
  }, { passive: true });

  // Reset menu/dropdown state when crossing the desktop breakpoint
  DESKTOP.addEventListener('change', () => {
    toggleMenu(false);
    closeAll(navList);
    block.classList.remove('header-sticky'); // re-measure the in-flow nav height
    updateSticky();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !DESKTOP.matches && menuBtn.getAttribute('aria-expanded') === 'true') {
      toggleMenu(false);
      menuBtn.focus();
    }
  });

  block.textContent = '';
  block.append(agency, nav, overlay);
  updateSticky();
}

/**
 * Decorates the header block
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  await loadPlaceholders();
  // The USWDS federal "official website" banner is opt-in (page metadata `usa-banner: true`)
  if (getMetadata('usa-banner') === 'true') {
    const headerElement = block.parentElement;
    const bannerBlock = document.createElement('div');
    bannerBlock.className = 'banner block';
    bannerBlock.setAttribute('data-block-name', 'banner');
    headerElement.parentElement.insertBefore(bannerBlock, headerElement);
    decorateBlock(bannerBlock);
    await loadBlock(bannerBlock);
  }

  const fragment = await fetchNav();
  if (fragment) decorateNav(block, fragment);
}
