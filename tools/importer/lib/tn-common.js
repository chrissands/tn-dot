/* eslint-disable */
/* global WebImporter */

/**
 * Shared helpers for tn.gov/tdot page imports (left nav, rich text, links).
 * Bundled into each import script by aem-import-bundle.sh.
 */
import NEWS from '../news-articles.json';

export const ORIGIN = 'https://www.tn.gov';

// tn.gov pages migrated to this site: source path -> site path
// (news articles come from news-articles.json)
export const MIGRATED = {
  '/tdot.html': '/',
  '/tdot/news.html': '/news',
  '/tdot/maintenance/maintenance-request.html': '/maintenance/maintenance-request',
  '/tdot/engineering-operations-division/maintenance-request.html': '/maintenance/maintenance-request',
  '/tdot/driver-how-do-i/maintenance-request-form.html': '/maintenance/maintenance-request',
  '/tdot/local-programs-community-investments/community-investments-office/highway-beautification-office/beautification-national-scenic-byways.html':
    '/local-programs-community-investments/community-investments-office/highway-beautification-office/beautification-national-scenic-byways',
  '/tdot/driver-how-do-i/find-traveler-information.html': '/driver-how-do-i/find-traveler-information',
  '/tdot/traffic-operations-division/yellow-dot-program.html': '/traffic-operations-division/yellow-dot-program',
  // redirects to the Yellow DOT Program page on tn.gov
  '/tdot/driver-how-do-i/enroll-in-yellow-dot-program.html': '/traffic-operations-division/yellow-dot-program',
};

export const clean = (t) => (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

export function el(document, tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  children.forEach((c) => e.append(c));
  return e;
}

/** Site path for a migrated tn.gov path (without /content/tn/), else null. */
export function mapSitePath(pathname) {
  const p = pathname.replace(/^\/content\/tn\/+/, '/');
  if (MIGRATED[p]) return MIGRATED[p];
  if (NEWS.articles[p]) return NEWS.articles[p].path;
  return null;
}

/** tn.gov links: migrated pages -> site path, others absolute (without /content/tn/). */
export function href(value) {
  if (!value || /^(mailto:|tel:|#)/i.test(value)) return value;
  let url;
  try { url = new URL(value, ORIGIN); } catch (e) { return value; }
  if (url.hostname !== 'www.tn.gov' && url.hostname !== 'tn.gov') return url.href;
  const mapped = mapSitePath(url.pathname);
  if (mapped) return `${mapped}${url.search}${url.hash}`;
  url.pathname = url.pathname.replace(/^\/content\/tn\/+/, '/');
  return url.href;
}

/** Absolute URL for a source image (tn.gov relative paths). */
export function imageSrc(value) {
  return new URL(value, ORIGIN).href;
}

/** YouTube embed/share links -> https://www.youtube.com/watch?v=ID */
export function youtubeUrl(value) {
  const m = String(value).match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : value;
}

/** tn.gov left nav -> Side Nav (subnav) block: heading link, toggle label, nested links. */
export function buildSideNav(document) {
  const nav = document.querySelector('.tn-leftnav nav') || document.querySelector('.tn-leftnav');
  if (!nav) return null;
  const title = nav.querySelector('.title a');
  const toggle = nav.querySelector('.title .icon-menu');
  const toList = (srcList) => {
    const list = el(document, 'ul');
    srcList.querySelectorAll(':scope > li').forEach((li) => {
      const a = li.querySelector(':scope > a');
      if (!a) return;
      const item = el(document, 'li', {}, [el(document, 'a', { href: href(a.getAttribute('href')) }, [clean(a.textContent)])]);
      const sub = li.querySelector(':scope > ul');
      if (sub) item.append(toList(sub));
      list.append(item);
    });
    return list;
  };
  const cell = el(document, 'div');
  if (title) cell.append(el(document, 'p', {}, [el(document, 'a', { href: href(title.getAttribute('href')) }, [clean(title.textContent)])]));
  cell.append(el(document, 'p', {}, [clean(toggle && toggle.textContent) || 'Section Menu']));
  cell.append(toList(nav.querySelector('ul.block-list') || nav.querySelector('ul')));
  return WebImporter.Blocks.createBlock(document, { name: 'Side Nav', variants: ['subnav'], cells: [[cell]] });
}

const RTE_NODES = ':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > ul, :scope > ol, :scope > table';

/** Rich text from a source RTE: semantic tags only, no Word spans/styles, no empty lines. */
export function cleanRte(document, root) {
  const out = [];
  root.querySelectorAll(RTE_NODES).forEach((node) => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('span, font').forEach((s) => s.replaceWith(...s.childNodes));
    copy.querySelectorAll('u').forEach((u) => {
      // underline only matters on plain text (links are underlined anyway)
      if (u.querySelector('a') || u.closest('a')) u.replaceWith(...u.childNodes);
    });
    // nested <strong><strong> from the RTE
    copy.querySelectorAll('strong strong, b b').forEach((s) => s.replaceWith(...s.childNodes));
    // line breaks: keep them between content; a break at the end of an inline element
    // (<strong>Name<br></strong>Title) moves after it; trailing/doubled breaks go
    const nextContent = (node) => {
      let n = node.nextSibling;
      while (n && n.nodeType === 3 && !clean(n.textContent)) n = n.nextSibling;
      return n;
    };
    copy.querySelectorAll('br').forEach((br) => {
      let node = br;
      while (!nextContent(node) && node.parentElement !== copy && /^(STRONG|B|EM|I|U|SPAN|FONT)$/.test(node.parentElement.tagName)) {
        node = node.parentElement;
      }
      const next = nextContent(node);
      if (!next || next.nodeName === 'BR') br.remove();
      else if (node !== br) node.after(br);
    });
    copy.querySelectorAll('strong, b, em, i, u').forEach((s) => { if (!clean(s.textContent)) s.remove(); });
    copy.querySelectorAll('a[href]').forEach((a) => {
      const link = el(document, 'a', { href: href(a.getAttribute('href')) }, [...a.childNodes]);
      a.replaceWith(link);
    });
    copy.querySelectorAll('img').forEach((img) => {
      const copyImg = el(document, 'img', { src: imageSrc(img.getAttribute('src')), alt: clean(img.getAttribute('alt')) });
      img.replaceWith(copyImg);
    });
    const attrs = ['style', 'class', 'id', 'lang', 'title', 'data-emptytext', 'target', 'rel', 'aria-label', 'onclick'];
    copy.querySelectorAll('*').forEach((e) => attrs.forEach((attr) => { if (attr !== 'title' || e.tagName !== 'A') e.removeAttribute(attr); }));
    attrs.forEach((attr) => copy.removeAttribute(attr));
    copy.querySelectorAll('a').forEach((a) => a.removeAttribute('title'));
    if (/^H[1-6]$/.test(copy.tagName)) {
      // headings keep their text only (the RTE wraps them in strong/u for looks)
      copy.textContent = clean(copy.textContent);
    }
    copy.innerHTML = copy.innerHTML.replace(/(&nbsp;|\s)+$/g, '').replace(/^(&nbsp;|\s)+/g, '');
    if (clean(copy.textContent) || copy.querySelector('img')) out.push(copy);
  });
  return out;
}

/** Single image (tn-image): <p><img></p> plus optional caption paragraph. */
export function buildImage(document, component) {
  const img = component.querySelector('img');
  if (!img) return [];
  const out = [el(document, 'p', {}, [el(document, 'img', { src: imageSrc(img.getAttribute('src')), alt: clean(img.getAttribute('alt')) })])];
  const caption = component.querySelector('small, .caption');
  if (caption && clean(caption.textContent)) out.push(el(document, 'p', {}, [el(document, 'em', {}, [clean(caption.textContent)])]));
  return out;
}

export function metadata(document, meta) {
  return WebImporter.Blocks.getMetadataBlock(document, meta);
}
