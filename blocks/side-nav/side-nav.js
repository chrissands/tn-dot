/**
 * side-nav block
 * USWDS side navigation. Styled with CSS; authored content is turned into
 * usa-sidenav markup when it is a plain list:
 *   - optional first paragraph link = section heading (e.g. "Newsroom")
 *   - optional plain-text paragraph = label of a toggle that collapses the list
 *     on small screens (e.g. "Section Menu")
 *   - list of links = navigation items; the item matching the current page
 *     (path + query) is marked current. A nested list under an item becomes a
 *     collapsible usa-sidenav__sublist with a chevron toggle (open when it holds
 *     the current page).
 * A block holding only a link to a /fragments/ document loads that document's
 * side-nav content (shared sidebars, e.g. the newsroom category filters).
 */

/**
 * Loads a fragment's side-nav content.
 * Local preview serves documents under /content, published pages at the root.
 * @param {string} path fragment path
 * @returns {Promise<Element|null>}
 */
async function loadFragmentNav(path) {
  let resp = await fetch(`/content${path}.plain.html`);
  if (!resp.ok) resp = await fetch(`${path}.plain.html`);
  if (!resp.ok) return null;
  const container = document.createElement('div');
  container.innerHTML = await resp.text();
  const nav = container.querySelector('.side-nav');
  return nav ? nav.firstElementChild?.firstElementChild || nav : container;
}

/** Keeps root-relative links working in local preview (content lives under /content). */
function localHref(href) {
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) return url.href;
  if (window.location.pathname.startsWith('/content/') && !url.pathname.startsWith('/content/')) {
    url.pathname = `/content${url.pathname}`;
  }
  return url.pathname + url.search;
}

/**
 * Normalized key for comparing a link to the current page
 * (ignores /content, trailing slash and the listing's ?page= pagination param).
 */
function pageKey(url) {
  const path = url.pathname.replace(/^\/content(?=\/)/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
  const params = new URLSearchParams(url.search);
  params.delete('page');
  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ''}`;
}

function buildSidenav(content) {
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Secondary navigation');

  const headingLink = content.querySelector(':scope > p a');
  if (headingLink) {
    const heading = document.createElement('p');
    heading.className = 'side-nav-heading';
    const a = document.createElement('a');
    a.href = localHref(headingLink.getAttribute('href'));
    a.textContent = headingLink.textContent.trim();
    heading.append(a);
    nav.append(heading);
    nav.setAttribute('aria-label', a.textContent);
  }

  const list = document.createElement('ul');
  list.className = 'usa-sidenav';
  list.id = `side-nav-${Math.random().toString(36).slice(2, 8)}`;

  const toggleLabel = [...content.querySelectorAll(':scope > p')]
    .find((para) => !para.querySelector('a') && para.textContent.trim());
  if (toggleLabel) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'side-nav-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', list.id);
    toggle.textContent = toggleLabel.textContent.trim();
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      nav.classList.toggle('side-nav-open', open);
    });
    (nav.querySelector('.side-nav-heading') || nav).append(toggle);
  }
  const here = pageKey(new URL(window.location.href));
  const hereSection = here.split('?')[0];
  let current = null;
  let fallback = null;
  const buildItems = (srcList, target) => {
    srcList.querySelectorAll(':scope > li').forEach((srcItem) => {
      const src = srcItem.querySelector(':scope > a, :scope > p > a');
      if (!src) return;
      const li = document.createElement('li');
      li.className = 'usa-sidenav__item';
      const a = document.createElement('a');
      a.href = localHref(src.getAttribute('href'));
      a.textContent = src.textContent.trim();
      li.append(a);
      target.append(li);
      const key = pageKey(new URL(src.getAttribute('href'), window.location.origin));
      if (key === here) current = a;
      // pages below a listed section (e.g. articles under /news) mark the section's
      // unfiltered link as current
      if (!key.includes('?') && hereSection.startsWith(`${key}/`)) fallback = fallback || a;

      const srcSub = srcItem.querySelector(':scope > ul');
      if (!srcSub) return;
      const sub = document.createElement('ul');
      sub.className = 'usa-sidenav__sublist';
      sub.id = `${list.id}-${target.children.length}`;
      buildItems(srcSub, sub);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'side-nav-subtoggle';
      toggle.setAttribute('aria-controls', sub.id);
      toggle.setAttribute('aria-label', `${a.textContent} submenu`);
      const setOpen = (open) => {
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        sub.hidden = !open;
      };
      setOpen(!!sub.querySelector('a[href]') && [current, fallback].some((c) => c && sub.contains(c)));
      toggle.addEventListener('click', () => setOpen(sub.hidden));
      li.classList.add('side-nav-has-sublist');
      li.append(toggle, sub);
    });
  };
  buildItems(content.querySelector('ul') || document.createElement('ul'), list);
  const active = current || fallback;
  if (active) {
    active.classList.add('usa-current');
    active.setAttribute('aria-current', 'page');
  }
  nav.append(list);
  return nav;
}

export default async function decorate(block) {
  let content = block.firstElementChild?.firstElementChild || block;
  const links = content.querySelectorAll('a');
  const onlyLink = links.length === 1 && content.textContent.trim() === links[0].textContent.trim();
  if (onlyLink && new URL(links[0].href).pathname.startsWith('/fragments/')) {
    const loaded = await loadFragmentNav(new URL(links[0].href).pathname);
    if (!loaded) {
      block.remove();
      return;
    }
    content = loaded;
  }
  if (!content.querySelector('ul')) return; // already USWDS markup or nothing to build
  const nav = buildSidenav(content);
  block.textContent = '';
  block.append(nav);
}
