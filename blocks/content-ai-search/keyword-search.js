/**
 * Keyword search over the site's search index (/search-index.json, helix-query.yaml "search":
 * path, title, description, content = first 300 words of the page text). Used by the Content AI
 * Search block when Content AI is not connected or does not respond.
 *
 * Every query word must match (prefix match from 4 letters, so "bridge" finds "bridges"; shorter
 * words match exactly or as a plural); when nothing matches
 * all words, pages matching any word are returned. Title matches weigh most, then description,
 * then page text; the exact phrase scores extra.
 */
import { fetchContent, isLocalPreview } from '../../scripts/content-fetch.js';

const STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to', 'what', 'when', 'where', 'who', 'why', 'with']);
const WEIGHTS = { title: 6, description: 3, content: 1 };

/** lowercase, accents removed, punctuation -> spaces */
export const normalizeText = (text) => String(text || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/** Query words to match (stop words dropped; a query of only stop words matches nothing) */
export function queryTerms(query) {
  const words = normalizeText(query).split(' ').filter(Boolean);
  return [...new Set(words.filter((w) => !STOP_WORDS.has(w)))];
}

let indexPromise = null;
/** Search index rows (loaded once per page), without noindex pages */
export function loadIndex(path) {
  if (!indexPromise) {
    indexPromise = fetchContent(`${path}${path.includes('?') ? '&' : '?'}limit=5000`)
      .then((resp) => {
        if (!resp.ok) throw new Error(`index ${resp.status}`);
        return resp.json();
      })
      .then((json) => (json.data || [])
        .filter((row) => row.path && !/noindex/i.test(row.robots || ''))
        .map((row) => {
          const fields = {
            title: normalizeText(row.title),
            description: normalizeText(row.description),
            content: normalizeText(row.content),
          };
          return { row, fields, words: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.split(' ')])) };
        }))
      .catch((e) => { indexPromise = null; throw e; });
  }
  return indexPromise;
}

/** word matches term: prefix match from 4 letters ("bridge" -> "bridges"), else exact or plural */
const matches = (word, term) => (term.length >= 4
  ? word.startsWith(term)
  : word === term || (term.length === 3 && (word === `${term}s` || word === `${term}es`)));

function score(entry, terms, phrase) {
  let total = 0;
  let matched = 0;
  terms.forEach((term) => {
    let termScore = 0;
    Object.entries(WEIGHTS).forEach(([field, weight]) => {
      const hits = entry.words[field].filter((w) => matches(w, term)).length;
      if (hits) termScore += weight * (1 + Math.min(hits - 1, 4) * 0.2);
    });
    if (termScore) matched += 1;
    total += termScore;
  });
  if (phrase && terms.length > 1) {
    if (entry.fields.title.includes(phrase)) total += 8;
    else if (`${entry.fields.description} ${entry.fields.content}`.includes(phrase)) total += 3;
  }
  return { total, matched };
}

/** Excerpt of the page text around the first matching word (description when it matches) */
export function excerpt(row, terms, length = 32) {
  // a description that is only a path or URL (e.g. a video link) is not a summary
  const description = /^(\/|https?:)\S*$/.test(String(row.description || '').trim()) ? '' : row.description;
  const hasTerm = (text) => normalizeText(text).split(' ').some((w) => terms.some((t) => matches(w, t)));
  if (description && hasTerm(description)) return description;
  const words = String(row.content || '').split(/\s+/).filter(Boolean);
  const at = words.findIndex((w) => terms.some((t) => matches(normalizeText(w), t)));
  if (at < 0) return description || words.slice(0, length).join(' ');
  const start = Math.max(0, at - 8);
  const text = words.slice(start, start + length).join(' ');
  return `${start > 0 ? '… ' : ''}${text}${start + length < words.length ? ' …' : ''}`;
}

/**
 * Ranked results for a query.
 * @returns {Promise<{ results: object[], terms: string[] }>} results: id, title, description, url
 */
export async function keywordSearch(query, indexPath, currentPath = window.location.pathname) {
  const entries = await loadIndex(indexPath);
  const terms = queryTerms(query);
  if (!terms.length) return { results: [], terms };
  const phrase = normalizeText(query);
  const scored = entries
    .filter((e) => e.row.path !== currentPath.replace(/^\/content(?=\/)/, ''))
    .map((e) => ({ e, ...score(e, terms, phrase) }))
    .filter((s) => s.total > 0);
  const all = scored.filter((s) => s.matched === terms.length);
  const ranked = (all.length ? all : scored)
    .sort((a, b) => b.matched - a.matched || b.total - a.total);
  return {
    terms,
    results: ranked.map(({ e }) => ({
      id: e.row.path,
      // page titles may carry the site name ("Maps | TDOT")
      title: (e.row.title || e.row.path).replace(/\s*\|\s*TDOT$/, ''),
      description: excerpt(e.row, terms),
      // local preview serves pages under /content
      url: new URL(`${isLocalPreview() ? '/content' : ''}${e.row.path}`, window.location.origin).href,
    })),
  };
}

/** Text with the query words wrapped in <mark> (DOM nodes, no HTML parsing) */
export function highlight(text, terms) {
  if (!terms.length) return [text];
  const out = [];
  String(text).split(/(\s+)/).forEach((part) => {
    const word = normalizeText(part);
    if (word && terms.some((t) => word.split(' ').some((w) => matches(w, t)))) {
      const mark = document.createElement('mark');
      mark.textContent = part;
      out.push(mark);
    } else out.push(part);
  });
  return out;
}
