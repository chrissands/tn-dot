/**
 * Icons in fragments (nav, footer) are authored as :name: text, like the icons in page
 * content, and served from /icons/<name>.svg in the code. Authoring them as text keeps
 * them intact when the document is edited (images get relocated by the editor).
 *
 * Published fragments arrive with <span class="icon icon-name"> (converted server-side);
 * the local preview serves the raw :name: text. Both become
 * <img src="/icons/<name>.svg" data-icon="<name>">, so blocks can read img.src and
 * recognize special links by icon name (e.g. print, translate).
 */

const NOTATION = /:([a-z][a-z0-9-]*):/g;

function iconImage(name) {
  const img = document.createElement('img');
  img.src = `${window.hlx.codeBasePath}/icons/${name}.svg`;
  img.alt = '';
  img.dataset.icon = name;
  img.loading = 'lazy';
  return img;
}

/**
 * Replaces icon spans and :name: notation in a fragment with icon images.
 * @param {Element} root fragment content
 */
export default function normalizeIcons(root) {
  root.querySelectorAll('span.icon').forEach((span) => {
    const cls = [...span.classList].find((c) => c.startsWith('icon-'));
    if (cls) span.replaceWith(iconImage(cls.slice(5)));
  });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    NOTATION.lastIndex = 0;
    if (NOTATION.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
  }
  nodes.forEach((node) => {
    const parts = node.nodeValue.split(NOTATION);
    // split() with one capture group alternates text, name, text, name, ...
    const out = parts.map((part, i) => (i % 2 ? iconImage(part) : document.createTextNode(part)));
    node.replaceWith(...out.filter((n) => n.nodeType !== 3 || n.nodeValue));
  });
}

/** Icon name of the first icon image inside an element ('' when none). */
export function iconName(el) {
  return el?.querySelector('img[data-icon]')?.dataset.icon || '';
}
