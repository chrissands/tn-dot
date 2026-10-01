/* eslint-disable */
import { mapSitePath } from './lib/tn-common.js';
/* global WebImporter */

/**
 * Import script for the site footer fragment (content/footer.plain.html).
 * Source: TN.gov/TDOT footer on https://www.tn.gov/tdot.html
 *
 * Output (flat, DA-friendly — top-level sections only, no classes), sections split by <hr>:
 *   1. Social:   label paragraph + list of social links (icon image + network name)
 *   2. Links:    per column a bold heading link paragraph followed by its link list
 *   3. Contact:  agency name / commissioner, address + phone (italic), email, state seal image
 *   4. Utility:  left list (flag status, chat), right list (help, translate, font size with
 *                its options as a nested list), center emblem image
 *   5. Bottom:   left and right lists of TN.gov links
 *   6. Back to top: link whose text is the button's accessible label
 *
 * Icons are :name: notation (served from /icons/ in the code); the seal and emblem images
 * are hosted in Document Authoring, in the document's media folder (.footer)
 * (content/images/ locally; footer.js maps them in local preview).
 */

const ORIGIN = 'https://www.tn.gov';
// Brand images are hosted in Document Authoring, in the document's own media folder
// (.footer). The workspace-to-DA content sync relinks every image to
// .footer/<name>-<md5(original URL) first 8 hex>.<ext>; upload-da.mjs uploads both names.
// Small UI icons are :name: text, served from /icons/<name>.svg in the code.
const DA_MEDIA = 'https://content.da.live/chrissands/tn-dot/.footer';
const SOCIAL_ICONS = {
  facebook: 'facebook',
  twitter: 'twitter',
  youtube: 'youtube',
  instagram: 'instagram',
  linkedin: 'linkedin',
};
const UTILITY_ICONS = {
  'icon-flag': 'flag',
  'icon-chat': 'chat',
  'icon-help-circled': 'help',
  'icon-book': 'translate',
};
const FONT_SIZE_ICON = 'font-size';
const SEAL = `${DA_MEDIA}/tn-seal.png`;
const EMBLEM = `${DA_MEDIA}/footer-starball.png`;
const CHAT_URL = 'https://help.tn.gov/sn_customerservice_tn_chat_selector.do';

const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();

function toSite(href) {
  if (!href) return href;
  if (/^(https?:|mailto:|tel:|#)/i.test(href)) return href;
  return `${ORIGIN}${href.replace(/^\/content\/tn\/+/, '/')}`;
}

/** Absolute tn.gov link, or the migrated page on this site. */
function abs(href) {
  const url = toSite(href);
  if (!url || !/^https?:/i.test(url)) return url;
  const { hostname, pathname } = new URL(url);
  const path = pathname.replace(/^\/content\/tn\/+/, '/');
  const mapped = /(^|\.)tn\.gov$/.test(hostname) ? mapSitePath(path) : null;
  return mapped || url;
}

function el(document, tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  children.forEach((c) => e.append(c));
  return e;
}

const img = (document, src, alt = '') => el(document, 'img', { src, alt });
/** :name: icon notation (rendered from /icons/<name>.svg) */
const icon = (document, name) => document.createTextNode(`:${name}:`);
const link = (document, href, ...content) => el(document, 'a', { href: abs(href) }, content);

function buildSocial(document) {
  const nodes = [];
  const bar = document.querySelector('.tn-socialmediabarfooter');
  if (!bar) return nodes;
  const title = bar.querySelector('.title');
  nodes.push(el(document, 'p', {}, [clean(title && title.textContent) || 'Social Media']));
  const list = document.createElement('ul');
  bar.querySelectorAll('a[href]').forEach((a) => {
    const network = [...a.classList].map((c) => c.replace(/^icon-/, '')).find((c) => SOCIAL_ICONS[c]);
    const label = clean(a.textContent) || network || a.getAttribute('href');
    const content = network ? [icon(document, SOCIAL_ICONS[network]), label] : [label];
    list.append(el(document, 'li', {}, [link(document, a.getAttribute('href'), ...content)]));
  });
  nodes.push(list);
  return nodes;
}

function buildLinks(document) {
  const nodes = [];
  document.querySelectorAll('#agency-footer .title[id^="agency-footer-col"]').forEach((title) => {
    const a = title.querySelector('a');
    // bold paragraph = column heading (headings would get auto-generated ids, which the fragment disallows)
    const heading = a ? link(document, a.getAttribute('href'), clean(a.textContent)) : clean(title.textContent);
    nodes.push(el(document, 'p', {}, [el(document, 'strong', {}, [heading])]));
    const col = title.parentElement;
    const list = document.createElement('ul');
    col.querySelectorAll('ul > li > a').forEach((la) => {
      list.append(el(document, 'li', {}, [link(document, la.getAttribute('href'), clean(la.textContent))]));
    });
    nodes.push(list);
  });
  return nodes;
}

function buildContact(document) {
  const nodes = [];
  const contact = document.querySelector('#agency-footer .contact');
  if (contact) {
    // name + commissioner (text before the address)
    const intro = el(document, 'p');
    const strong = contact.querySelector('strong');
    if (strong) intro.append(el(document, 'strong', {}, [clean(strong.textContent)]));
    const rest = [...contact.childNodes]
      .filter((n) => n.nodeType === 3 && clean(n.textContent))
      .map((n) => clean(n.textContent));
    rest.forEach((t) => { intro.append(document.createElement('br'), t); });
    nodes.push(intro);

    const address = contact.querySelector('address');
    if (address) {
      const lines = [...address.childNodes]
        .filter((n) => n.nodeType === 3 && clean(n.textContent))
        .map((n) => clean(n.textContent));
      const em = document.createElement('em');
      lines.forEach((t, i) => {
        if (i) em.append(document.createElement('br'));
        em.append(t);
      });
      const p = el(document, 'p', {}, [em]);
      const mail = address.querySelector('a[href^="mailto:"]');
      if (mail) p.append(document.createElement('br'), link(document, mail.getAttribute('href'), clean(mail.textContent)));
      nodes.push(p);
    }
  }
  if (document.querySelector('#agency-footer .last img')) nodes.push(el(document, 'p', {}, [img(document, SEAL, 'The Great Seal of the State of Tennessee')]));
  return nodes;
}

function utilityItem(document, li) {
  const a = li.querySelector(':scope > a');
  if (!a) return null;
  const label = clean(a.textContent);
  const iconKey = [...a.classList].map((c) => UTILITY_ICONS[c]).find(Boolean);
  let href = a.getAttribute('href');
  if (a.classList.contains('icon-chat')) href = CHAT_URL;
  if (li.id === 'footer-translate') href = '#translate';
  if (li.id === 'footer-fontsize') href = '#font-size';
  const content = [];
  if (li.id === 'footer-fontsize') content.push(icon(document, FONT_SIZE_ICON));
  else if (iconKey) content.push(icon(document, iconKey));
  content.push(label);
  const item = el(document, 'li', {}, [link(document, href, ...content)]);
  // font size options become a nested list of labels
  const buttons = li.querySelectorAll('.drop button');
  if (buttons.length) {
    const sub = document.createElement('ul');
    buttons.forEach((btn) => sub.append(el(document, 'li', {}, [clean(btn.textContent)])));
    item.append(sub);
  }
  return item;
}

function buildUtility(document) {
  const nodes = [];
  document.querySelectorAll('#footer-top .row > .columns').forEach((colEl) => {
    const list = document.createElement('ul');
    colEl.querySelectorAll(':scope ul.inline-list > li').forEach((li) => {
      const item = utilityItem(document, li);
      if (item) list.append(item);
    });
    if (list.children.length) nodes.push(list);
  });
  if (document.querySelector('#footer .starball img')) nodes.push(el(document, 'p', {}, [img(document, EMBLEM, '')]));
  return nodes;
}

function buildBottom(document) {
  const nodes = [];
  document.querySelectorAll('#footer-bottom .row > .columns').forEach((colEl) => {
    const list = document.createElement('ul');
    colEl.querySelectorAll('a[href]').forEach((a) => {
      list.append(el(document, 'li', {}, [link(document, a.getAttribute('href'), clean(a.textContent))]));
    });
    if (list.children.length) nodes.push(list);
  });
  return nodes;
}

// The importer strips text-less links before transform, so the icon-only back-to-top
// anchor may be gone; its label (aria-label on the live page) is used as the fallback.
const BACK_TO_TOP_LABEL = 'Go back to the top of the page';

function buildBackToTop(document) {
  const wrap = document.querySelector('.tn-backtotop');
  if (!wrap) return [];
  const a = wrap.querySelector('a');
  const label = (a && clean(a.getAttribute('aria-label') || a.textContent)) || BACK_TO_TOP_LABEL;
  return [el(document, 'p', {}, [link(document, '#top', label)])];
}

export default {
  transform: ({ document }) => {
    const main = document.createElement('div');
    [buildSocial, buildLinks, buildContact, buildUtility, buildBottom, buildBackToTop].forEach((build, i) => {
      if (i > 0) main.append(document.createElement('hr'));
      main.append(...build(document));
    });
    return [{
      element: main,
      path: '/footer',
      report: { title: 'footer' },
    }];
  },
};
