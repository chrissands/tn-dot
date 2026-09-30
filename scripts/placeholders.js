/**
 * Site placeholders: interface text managed in the /placeholders sheet
 * (columns: key | text), so it can be changed without a code change.
 *
 * - Blocks call `await loadPlaceholders()` once, then `t(key, fallback, values)`; the
 *   fallback is used until the sheet has a text for the key. `{name}` in a text is
 *   filled from `values` (e.g. t('page-number', 'Page {page}', { page: 3 })).
 * - Authors can insert placeholders from the Document Authoring library as {{key}};
 *   replacePlaceholderTokens() swaps those for the sheet text.
 * Keys are matched case-insensitively (EDS toCamelCase); `Key`/`Text` headers work too.
 */
import { toCamelCase } from './aem.js';
import { fetchContent } from './content-fetch.js';

let cache = {};
let loading = null;

/** Loads the placeholders sheet once per page. @returns {Promise<object>} */
export function loadPlaceholders() {
  if (!loading) {
    loading = fetchContent('/placeholders.json')
      .then((resp) => (resp.ok ? resp.json() : {}))
      .then((json) => {
        cache = {};
        (json.data || []).forEach((row) => {
          const key = row.key || row.Key;
          const text = row.text ?? row.Text;
          if (key && text) cache[toCamelCase(key)] = text;
        });
        return cache;
      })
      .catch(() => cache);
  }
  return loading;
}

/**
 * Placeholder text for a key (call after loadPlaceholders()).
 * @param {string} key sheet key, e.g. 'first-page'
 * @param {string} fallback text used when the sheet has none
 * @param {object} [values] fills {name} tokens
 */
export function t(key, fallback, values = {}) {
  const text = cache[toCamelCase(key)] || fallback;
  return Object.entries(values).reduce((out, [name, value]) => out.split(`{${name}}`).join(value), text);
}

/** Replaces {{key}} tokens authored in page text with the placeholder text. */
export async function replacePlaceholderTokens(root) {
  if (!root.textContent.includes('{{')) return;
  await loadPlaceholders();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) if (walker.currentNode.nodeValue.includes('{{')) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    node.nodeValue = node.nodeValue.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (match, key) => cache[toCamelCase(key)] ?? match);
  });
}
