import {
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateBlocks,
  decorateTemplateAndTheme,
  getMetadata,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  sampleRUM,
  readBlockConfig,
  toClassName,
  toCamelCase,
} from './aem.js';
import { replacePlaceholderTokens } from './placeholders.js';
import { formatNewsDate } from './news.js';

/**
 * Auto-generates a side nav from page headings and prepends it as the first section.
 * Called only when body has the `sidenav-left` template class.
 * @param {Element} main The container element
 */
function buildSideNavLeft(main) {
  const headings = [...main.querySelectorAll('h2, h3')];
  if (!headings.length) return;

  // Assign IDs to headings so the nav links can anchor to them
  headings.forEach((h) => {
    if (!h.id) h.id = toClassName(h.textContent.trim());
  });

  // Build USWDS sidenav structure with h2 → items, h3 → subitems
  const ul = document.createElement('ul');
  ul.className = 'usa-sidenav';

  const allLinks = [];
  let currentItem = null;
  let currentSublist = null;

  headings.forEach((h) => {
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.textContent = h.textContent.trim();
    allLinks.push(a);

    if (h.tagName === 'H2') {
      const li = document.createElement('li');
      li.className = 'usa-sidenav__item';
      li.append(a);
      ul.append(li);
      currentItem = li;
      currentSublist = null;
    } else {
      if (!currentSublist) {
        currentSublist = document.createElement('ul');
        currentSublist.className = 'usa-sidenav__sublist';
        if (currentItem) currentItem.append(currentSublist);
        else ul.append(currentSublist);
      }
      const li = document.createElement('li');
      li.className = 'usa-sidenav__sublist-item';
      li.append(a);
      currentSublist.append(li);
    }
  });

  const navBlock = buildBlock('side-nav', [[ul]]);
  const navSection = document.createElement('div');
  navSection.append(navBlock);
  main.prepend(navSection);

  // Scroll spy: highlight the nav link for the heading currently in view
  requestAnimationFrame(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            allLinks.forEach((l) => l.classList.remove('usa-current'));
            const active = allLinks.find((l) => l.getAttribute('href') === `#${entry.target.id}`);
            if (active) active.classList.add('usa-current');
          }
        });
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));
  });
}

/**
 * Sa11y Accessibility Checker - Sidekick Toggle Plugin
 * Injects/removes Sa11y when the Accessibility button is clicked.
 * https://sa11y.netlify.app/
 */
const SA11Y_VERSION = '4';
const SA11Y_CSS_URL = `https://cdn.jsdelivr.net/gh/ryersondmp/sa11y@${SA11Y_VERSION}/dist/css/sa11y.min.css`;
const SA11Y_LANG_URL = `https://cdn.jsdelivr.net/gh/ryersondmp/sa11y@${SA11Y_VERSION}/dist/js/lang/en.umd.js`;
const SA11Y_JS_URL = `https://cdn.jsdelivr.net/gh/ryersondmp/sa11y@${SA11Y_VERSION}/dist/js/sa11y.umd.min.js`;

let sa11yActive = false;
let sa11yLoaded = false;

function injectCSS(url, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = resolve;
    link.onerror = () => reject(new Error('Failed to load Sa11y CSS'));
    document.head.appendChild(link);
  });
}

function injectScript(url, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const script = document.createElement('script');
    script.id = id;
    script.src = url;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Sa11y script'));
    document.head.appendChild(script);
  });
}

async function loadSa11y() {
  if (sa11yLoaded) return;

  await injectCSS(SA11Y_CSS_URL, 'sa11y-injected-styles');
  await injectScript(SA11Y_LANG_URL, 'sa11y-lang-script');
  await new Promise((r) => { setTimeout(r, 100); });
  await injectScript(SA11Y_JS_URL, 'sa11y-main-script');

  // Wait for Sa11y to be available
  await new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts += 1;
      if (window.Sa11y && window.Sa11yLangEn) resolve();
      else if (attempts > 50) reject(new Error('Sa11y load timeout'));
      else setTimeout(check, 100);
    };
    check();
  });

  window.Sa11y.Lang.addI18n(window.Sa11yLangEn.strings);
  sa11yLoaded = true;
}

async function startSa11y() {
  if (sa11yActive) return;

  try {
    await loadSa11y();

    window.sa11yInstance = new window.Sa11y.Sa11y({
      checkRoot: 'main, [role="main"], .main-content, body',
      containerIgnore: '.sidekick-library, .hlx-sk, #hlx-sk, [data-aue-type], .aue-edit',
      showGoodLinkButton: true,
      showHinPageOutline: true,
      detectPageLanguage: true,
      panelPosition: 'left',
    });

    sa11yActive = true;
    // eslint-disable-next-line no-console
    console.log('[Sa11y] Started');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Sa11y] Error starting:', error);
  }
}

function stopSa11y() {
  if (!sa11yActive) return;

  try {
    if (window.sa11yInstance) {
      try { window.sa11yInstance.destroy(); } catch (e) { /* ignore */ }
      delete window.sa11yInstance;
    }

    // Remove Sa11y UI elements (keep scripts/styles loaded for re-use)
    [
      '#sa11y-container', '#sa11y-panel', '#sa11y-toast-container',
      '#sa11y-control-panel', '.sa11y-annotation', '.sa11y-instance',
    ].forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        try { el.remove(); } catch (e) { /* ignore */ }
      });
    });

    // Remove Sa11y custom elements (web components with shadow DOM)
    [
      'sa11y-control-panel', 'sa11y-panel', 'sa11y-annotation',
      'sa11y-heading-label', 'sa11y-heading-anchor', 'sa11y-tooltips',
    ].forEach((tagName) => {
      document.querySelectorAll(tagName).forEach((el) => {
        try { el.remove(); } catch (e) { /* ignore */ }
      });
    });

    sa11yActive = false;
    // eslint-disable-next-line no-console
    console.log('[Sa11y] Stopped');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Sa11y] Error stopping:', error);
  }
}

function toggleSa11y() {
  if (sa11yActive) {
    stopSa11y();
  } else {
    startSa11y();
  }
}

// Listen for sidekick sa11y event
function initSa11ySidekick() {
  const sk = document.querySelector('aem-sidekick');
  if (sk) {
    sk.addEventListener('custom:sa11y', toggleSa11y);
  } else {
    document.addEventListener('sidekick-ready', () => {
      document.querySelector('aem-sidekick')?.addEventListener('custom:sa11y', toggleSa11y);
    }, { once: true });
  }
}

initSa11ySidekick();

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

/**
 * Loads the full USWDS stylesheet after first render. head.html only loads
 * uswds-critical.css (the rules the pages use at first render, built by
 * tools/perf/build-uswds-critical.cjs); the full sheet adds interaction states
 * (open menus, form errors, …). It is inserted before the subset, so rule order –
 * and therefore the cascade – is the same as with the single original stylesheet.
 */
function loadFullUswds() {
  const href = `${window.hlx.codeBasePath}/styles/uswds-core.css`;
  if (document.querySelector(`link[href="${href}"]`)) return;
  const critical = document.querySelector('link[href$="/styles/uswds-critical.css"]');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  if (critical) critical.before(link);
  else document.head.prepend(link);
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

function autolinkModals(doc) {
  doc.addEventListener('click', async (e) => {
    const origin = e.target.closest('a');
    if (origin && origin.href && origin.href.includes('/modals/')) {
      e.preventDefault();
      const { openModal } = await import(`${window.hlx.codeBasePath}/blocks/modal/modal.js`);
      openModal(origin.href);
    }
  });
}

/**
 * Newsroom templates (newsroom listing + news-article): prepend the shared category
 * sidebar (side-nav block loaded from /fragments/news-sidebar) and, on articles,
 * render the publication date line below the title.
 * @param {Element} main The container element
 */
function buildNewsroomLayout(main) {
  const { classList } = document.body;
  if (!classList.contains('newsroom') && !classList.contains('news-article')) return;

  const link = document.createElement('a');
  link.href = '/fragments/news-sidebar';
  link.textContent = link.href;
  const sidebar = buildBlock('side-nav', [[link]]);
  sidebar.classList.add('newsroom');
  const section = document.createElement('div');
  section.append(sidebar);
  main.prepend(section);

  const published = getMetadata('publication-date');
  if (classList.contains('news-article') && published) {
    const { date, time } = formatNewsDate(published);
    const p = document.createElement('p');
    p.className = 'news-article-date';
    const datetime = document.createElement('time');
    datetime.dateTime = published;
    datetime.textContent = date;
    p.append(datetime);
    if (time) {
      const small = document.createElement('small');
      small.textContent = time;
      p.append(' | ', small);
    }
    const title = main.querySelector('h1');
    const subtitle = title && title.nextElementSibling && title.nextElementSibling.tagName === 'H2'
      ? title.nextElementSibling : null;
    (subtitle || title)?.after(p);
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    if (!main.querySelector('.hero')) buildHeroBlock(main);
    if (document.body.classList.contains('sidenav-left')) buildSideNavLeft(main);
    buildNewsroomLayout(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Published images come as optimized media URLs sized for content (?width=750);
 * full-bleed section backgrounds need the wide rendition.
 * @param {string} src image URL
 * @returns {string}
 */
function fullWidthImage(src) {
  try {
    const url = new URL(src, window.location.href);
    if (url.searchParams.has('width')) url.searchParams.set('width', '2000');
    return url.href;
  } catch (e) {
    return src;
  }
}

/**
 * Decorates all sections in a container element.
 * @param {Element} main The container element
 */
function decorateSections(main) {
  main.querySelectorAll(':scope > div').forEach((section) => {
    const wrappers = [];
    let defaultContent = false;
    [...section.children].forEach((e) => {
      if (e.classList.contains('richtext')) {
        e.removeAttribute('class');
        if (!defaultContent) {
          const wrapper = document.createElement('div');
          wrapper.classList.add('default-content-wrapper', 'usa-prose');
          wrappers.push(wrapper);
          defaultContent = true;
        }
      } else if (e.tagName === 'DIV' || !defaultContent) {
        const wrapper = document.createElement('div');
        wrappers.push(wrapper);
        defaultContent = e.tagName !== 'DIV';
        if (defaultContent) wrapper.classList.add('default-content-wrapper', 'usa-prose');
      }
      wrappers[wrappers.length - 1].append(e);
    });

    // Add wrapped content back
    wrappers.forEach((wrapper) => section.append(wrapper));
    section.classList.add('section');
    section.dataset.sectionStatus = 'initialized';
    section.style.display = 'none';

    // Process section metadata
    const sectionMeta = section.querySelector('div.section-metadata');
    if (sectionMeta) {
      const meta = readBlockConfig(sectionMeta);
      Object.keys(meta).forEach((key) => {
        if (key === 'style') {
          const styles = meta.style
            .split(',')
            .filter((style) => style)
            .map((style) => toClassName(style.trim()));
          styles.forEach((style) => section.classList.add(style));
        } else {
          section.dataset[toCamelCase(key)] = meta[key];
        }
      });
      sectionMeta.parentNode.remove();
    }

    // Section Metadata "background" image → section background. Local preview keeps
    // the section-metadata table (read above); published pages deliver it as a
    // data-background attribute on the section.
    const bgValue = section.dataset.background;
    if (bgValue) {
      const bg = Array.isArray(bgValue) ? bgValue[0] : bgValue;
      section.style.backgroundImage = `url("${fullWidthImage(bg)}")`;
      section.classList.add('has-background');
    }
  });
}

/**
 * Converts :icon-name: text notation into icon spans.
 * The EDS pipeline normally does this server-side; this covers content served
 * as raw HTML (e.g. local preview of imported pages).
 * @param {Element} main The container element
 */
function convertIconNotation(main) {
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (/:[a-z][a-z0-9-]*:/.test(node.nodeValue) && !node.parentElement.closest('code, pre')) {
      nodes.push(node);
    }
  }
  nodes.forEach((node) => {
    const frag = document.createDocumentFragment();
    node.nodeValue.split(/(:[a-z][a-z0-9-]*:)/).forEach((part) => {
      const match = part.match(/^:([a-z][a-z0-9-]*):$/);
      if (match) {
        const span = document.createElement('span');
        span.className = `icon icon-${match[1]}`;
        frag.append(span);
      } else if (part) {
        frag.append(part);
      }
    });
    node.replaceWith(frag);
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  convertIconNotation(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  doc.documentElement.lang = 'en';
  decorateTemplateAndTheme();

  // Load template CSS early (before body is revealed) to avoid layout shift
  const templateName = toClassName(getMetadata('template'));
  if (templateName) loadCSS(`${window.hlx.codeBasePath}/styles/templates/${templateName}.css`);

  // Set header variant for CSS height calculation (prevents CLS)
  const headerVariant = getMetadata('header') || getMetadata('header-variant') || 'basic';
  doc.body.dataset.headerVariant = headerVariant;

  if (getMetadata('breadcrumbs').toLowerCase() === 'true') {
    doc.body.dataset.breadcrumbs = true;
  }
  const main = doc.querySelector('main');
  if (main) {
    await replacePlaceholderTokens(main);
    decorateMain(main);
    doc.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  sampleRUM.enhance();

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  autolinkModals(doc);

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadFullUswds();
  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  const loadQuickEdit = async (...args) => {
    // eslint-disable-next-line import/no-cycle
    const { default: initQuickEdit } = await import('../tools/quick-edit/quick-edit.js');
    initQuickEdit(...args);
  };

  const addSidekickListeners = (sk) => {
    sk.addEventListener('custom:quick-edit', loadQuickEdit);
  };

  const sk = document.querySelector('aem-sidekick');
  if (sk) {
    addSidekickListeners(sk);
  } else {
    document.addEventListener('sidekick-ready', () => {
      addSidekickListeners(document.querySelector('aem-sidekick'));
    }, { once: true });
  }
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadSidekick() {
  if (document.querySelector('aem-sidekick')) {
    import('./sidekick.js');
    return;
  }

  document.addEventListener('sidekick-ready', () => {
    import('./sidekick.js');
  });
}

export async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
  loadSidekick();
}

// UE Editor support before page load
if (window.location.hostname.includes('ue.da.live')) {
  await import(`${window.hlx.codeBasePath}/ue/scripts/ue.js`).then(({ default: ue }) => ue());
}

loadPage();

(() => {
  const hasQE = new URL(window.location.href).searchParams.has('quick-edit');
  if (hasQE) import('../tools/quick-edit/quick-edit.js').then((mod) => mod.default());
})();

(function da() {
  const { searchParams } = new URL(window.location.href);

  const lp = searchParams.get('dapreview');
  // eslint-disable-next-line import/no-unresolved
  if (lp) import('https://da.live/scripts/dapreview.js').then((mod) => mod.default(loadPage));

  const exp = searchParams.get('daexperiment');
  // eslint-disable-next-line import/no-unresolved
  if (exp) import('https://da.live/nx/public/plugins/exp/exp.js');
}());
