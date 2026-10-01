/**
 * Content AI Search block: site search powered by the AEM Content AI Search API
 * (https://developer.adobe.com/experience-cloud/experience-manager-apis/api/experimental/contentai/).
 *
 * Settings come from the configuration sheet /config/content-ai-search (columns: key | value),
 * and from optional settings rows in the block (first cell: name, second cell: value), which
 * override the sheet. The sheet is the place for the connection settings and the API key;
 * the block for per-page display settings. Names (sheet keys or block rows):
 *   Config         | (block only) other configuration sheet path, e.g. /config/other-search
 *   Environment    | AEM environment ("bucket"), e.g. author-p12345-e67890
 *   Endpoint       | search proxy URL (tools/content-ai-proxy), which holds the API key and the
 *                    content source: Content AI does not accept browser (CORS) requests, so
 *                    this is how the live site connects. Overrides Environment.
 *   Content Source | name of the Content AI content source to search
 *   Source Type    | ACQUISITION (default), AEM_PUBLISH, AEM_AUTHOR or CUSTOM
 *   API Key        | only without a proxy: Content AI API key with read-only access to public
 *                    content sources (sent as X-Api-Key; the published sheet is public). Leave
 *                    empty with a proxy, which keeps the key secret.
 *   Mode           | hybrid (default: semantic + keyword), semantic or keyword
 *   Answer         | on: also show a generated answer (Generative Search API) with sources
 *   Results        | results per page (default 10, maximum 50)
 *   Placeholder    | search box text
 *
 * The query is kept in the page URL (?q=), so searches can be shared and bookmarked.
 * Result and answer text is rendered as text (never as HTML).
 */
import { toClassName } from '../../scripts/aem.js';
import { fetchContent } from '../../scripts/content-fetch.js';
import { loadPlaceholders, t } from '../../scripts/placeholders.js';

const API_PATH = '/adobe/experimental/aemcontentai-expires-20261231/contentAI';
const MAX_RESULTS = 50;
const CONFIG_SHEET = '/config/content-ai-search';
let idCounter = 0;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v); });
  node.append(...children.filter((c) => c !== undefined && c !== null && c !== ''));
  return node;
}

/** Block settings rows -> { name: value } (empty values are left out) */
function blockSettings(block) {
  const settings = {};
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    if (!keyCell || !valueCell) return;
    const value = (valueCell.querySelector('a[href]')?.getAttribute('href') || valueCell.textContent).trim();
    if (value) settings[toClassName(keyCell.textContent)] = value;
  });
  return settings;
}

/** Configuration sheet (key | value) -> { name: value }; {} when missing */
async function sheetSettings(path) {
  try {
    // site path of the sheet (a linked value arrives as a full URL)
    const sheet = new URL(path, window.location.origin).pathname.replace(/^\/content(?=\/)/, '').replace(/\.json$/, '');
    const resp = await fetchContent(`${sheet}.json`);
    if (!resp.ok) return {};
    const json = await resp.json();
    const settings = {};
    (json.data || []).forEach((row) => {
      const key = row.key ?? row.Key;
      const value = String(row.value ?? row.Value ?? '').trim();
      if (key && value) settings[toClassName(key)] = value;
    });
    return settings;
  } catch (e) {
    return {};
  }
}

/** Sheet settings, overridden by the block's own rows -> config */
async function readConfig(block) {
  const own = blockSettings(block);
  const settings = { ...(await sheetSettings(own.config || CONFIG_SHEET)), ...own };
  const config = {
    environment: '', endpoint: '', source: '', type: 'ACQUISITION', key: '', mode: 'hybrid', answer: false, limit: 10, placeholder: '',
  };
  Object.entries(settings).forEach(([name, value]) => {
    switch (name) {
      case 'environment': config.environment = value.replace(/^https?:\/\//, '').replace(/\..*$/, ''); break;
      case 'endpoint': config.endpoint = value.replace(/\/+$/, ''); config.proxy = true; break;
      case 'content-source': config.source = value; break;
      case 'source-type': config.type = value.toUpperCase().replace(/[^A-Z_]/g, '_') || 'ACQUISITION'; break;
      case 'api-key': config.key = value; break;
      case 'mode': config.mode = toClassName(value) || 'hybrid'; break;
      case 'answer': config.answer = /^(on|yes|true)$/i.test(value); break;
      case 'results': config.limit = Math.min(MAX_RESULTS, Math.max(1, parseInt(value, 10) || 10)); break;
      case 'placeholder': config.placeholder = value; break;
      default:
    }
  });
  if (!config.endpoint && config.environment) config.endpoint = `https://${config.environment}.adobeaemcloud.com${API_PATH}`;
  return config;
}

/** Content AI query for the text, by mode */
function buildQuery(text, mode) {
  const vector = { type: 'vector', text, options: {} };
  const fulltext = { type: 'fulltext', text, options: {} };
  if (mode === 'semantic') return vector;
  if (mode === 'keyword' || mode === 'fulltext') return fulltext;
  return { type: 'composite', operator: 'OR', queries: [vector, fulltext] };
}

async function post(config, path, body) {
  const resp = await fetch(`${config.endpoint}${path}`, {
    method: 'POST',
    // the proxy adds the key; direct calls send it
    headers: { 'Content-Type': 'application/json', ...(config.key ? { 'X-Api-Key': config.key } : {}) },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const error = new Error(`Content AI ${resp.status}`);
    error.status = resp.status;
    throw error;
  }
  return resp.json();
}

/** First non-empty string among the candidates (nested "a.b" paths allowed) */
function pick(data, paths) {
  for (let i = 0; i < paths.length; i += 1) {
    const value = paths[i].split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), data);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/** Safe link target: http(s) or site-relative, else '' */
function safeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch (e) {
    return '';
  }
}

/** Search result -> { id, title, description, url } */
function normalize(result) {
  const data = result.data || {};
  const url = safeUrl(pick(data, ['url', 'path', 'link', 'metadata.url', 'metadata.path', 'metadata.reference', 'metadata.sourceUrl']))
    || (/^https?:\/\//.test(result.id) ? safeUrl(result.id) : '');
  const chunk = (result.chunks || []).map((c) => c.chunkData && c.chunkData.text).find(Boolean) || '';
  const description = pick(data, ['description', 'metadata.description', 'summary', 'text', 'content']) || chunk;
  return {
    id: result.id,
    title: pick(data, ['title', 'metadata.title', 'name', 'headline']) || url || result.id,
    description: description.length > 300 ? `${description.slice(0, 297).replace(/\s+\S*$/, '')}…` : description,
    url,
  };
}

/** Generated answer (plain text / light markdown) -> safe DOM: paragraphs, lists, bold */
function answerNodes(text) {
  const inline = (line) => {
    const out = [];
    line.split(/(\*\*[^*]+\*\*)/).forEach((part) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) out.push(el('strong', {}, part.slice(2, -2)));
      else if (part) out.push(part);
    });
    return out;
  };
  const nodes = [];
  let list = null;
  text.split(/\n/).map((l) => l.trim()).forEach((line) => {
    if (!line) { list = null; return; }
    const item = line.match(/^(?:[-*•]|\d+\.)\s+(.*)$/);
    if (item) {
      if (!list) { list = el('ul'); nodes.push(list); }
      list.append(el('li', {}, ...inline(item[1])));
      return;
    }
    list = null;
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    nodes.push(heading ? el('p', {}, el('strong', {}, heading[1])) : el('p', {}, ...inline(line)));
  });
  return nodes;
}

function resultItem(result) {
  const heading = el('h3', { class: 'usa-collection__heading' }, result.url
    ? el('a', { class: 'usa-link', href: result.url }, result.title)
    : result.title);
  const meta = result.url
    ? el('ul', { class: 'usa-collection__meta', 'aria-label': t('content-ai-search-address', 'Address') }, el('li', { class: 'usa-collection__meta-item' }, result.url.replace(/^https?:\/\//, '').replace(/\/$/, '')))
    : '';
  return el(
    'li',
    { class: 'usa-collection__item content-ai-search-result' },
    el('div', { class: 'usa-collection__body' }, heading, result.description ? el('p', { class: 'usa-collection__description' }, result.description) : '', meta),
  );
}

export default async function decorate(block) {
  const [config] = await Promise.all([readConfig(block), loadPlaceholders()]);
  idCounter += 1;
  const uid = `content-ai-search-${idCounter}`;

  const input = el('input', {
    class: 'content-ai-search-input',
    id: `${uid}-q`,
    type: 'search',
    name: 'q',
    autocomplete: 'off',
    placeholder: config.placeholder || t('content-ai-search-placeholder', 'Search TDOT'),
  });
  const submit = el('button', { class: 'usa-button content-ai-search-submit', type: 'submit' }, t('content-ai-search-button', 'Search'));
  const form = el(
    'form',
    { class: 'content-ai-search-form', role: 'search', 'aria-label': t('content-ai-search-label', 'Site search') },
    el('label', { class: 'usa-sr-only', for: input.id }, t('content-ai-search-label', 'Site search')),
    input,
    submit,
  );
  const status = el('p', { class: 'content-ai-search-status', role: 'status', 'aria-live': 'polite' });
  const answer = el('section', { class: 'content-ai-search-answer', hidden: true, 'aria-label': t('content-ai-search-answer', 'Answer') });
  const notice = el('div', { class: 'usa-alert usa-alert--info usa-alert--slim content-ai-search-notice', hidden: true }, el('div', { class: 'usa-alert__body' }, el('p', { class: 'usa-alert__text' })));
  const resultsHeading = el('h2', { class: 'usa-sr-only', id: `${uid}-results` }, t('content-ai-search-results', 'Search results'));
  const list = el('ul', { class: 'usa-collection content-ai-search-results', 'aria-labelledby': resultsHeading.id });
  const more = el('button', { class: 'usa-button usa-button--outline content-ai-search-more', type: 'button', hidden: true }, t('content-ai-search-more', 'More results'));
  block.replaceChildren(form, notice, status, answer, resultsHeading, list, more);

  const showNotice = (text) => {
    notice.querySelector('.usa-alert__text').textContent = text;
    notice.hidden = !text;
  };
  // a proxy holds the key and the content source; direct calls need both here
  const configured = config.endpoint && (config.proxy || (config.source && config.key));
  if (!configured) {
    showNotice(t('content-ai-search-not-configured', 'Search is not set up yet. Please check back soon.'));
    input.disabled = true;
    submit.disabled = true;
    return;
  }

  let current = {
    query: '', cursor: '', results: [], total: 0,
  };
  let request = 0;

  const failure = (error) => (error.status === 401 || error.status === 403
    ? t('content-ai-search-unavailable', 'Search is not available right now.')
    : t('content-ai-search-error', 'Something went wrong with the search. Please try again.'));

  const renderAnswer = (data) => {
    const text = (data && data.result) || '';
    if (!text.trim()) { answer.hidden = true; return; }
    const byId = new Map(current.results.map((r) => [r.id, r]));
    const sources = (data.hits || []).map((h) => byId.get(h.id)).filter((r) => r && r.url);
    answer.replaceChildren(
      el('h2', { class: 'content-ai-search-answer-heading' }, t('content-ai-search-answer', 'Answer')),
      ...answerNodes(text),
      sources.length ? el('p', { class: 'content-ai-search-sources-label' }, t('content-ai-search-sources', 'Sources')) : '',
      sources.length ? el('ul', { class: 'content-ai-search-sources' }, ...sources.map((s) => el('li', {}, el('a', { class: 'usa-link', href: s.url }, s.title)))) : '',
      el('p', { class: 'content-ai-search-disclaimer' }, t('content-ai-search-disclaimer', 'This answer was generated by AI from TDOT content. Check the sources for details.')),
    );
    answer.hidden = false;
  };

  const runSearch = async (query, append = false) => {
    request += 1;
    const id = request;
    showNotice('');
    block.setAttribute('aria-busy', 'true');
    more.hidden = true;
    if (!append) {
      list.replaceChildren();
      answer.hidden = true;
      status.textContent = t('content-ai-search-searching', 'Searching…');
    }
    const body = {
      contentSource: { name: config.source, type: config.type },
      query: buildQuery(query, config.mode),
      queryOptions: {
        pagination: {
          limit: config.limit,
          ...(append && current.cursor ? { cursor: current.cursor } : {}),
        },
      },
    };
    const answerRequest = !append && config.answer && query.length >= 3
      ? post(config, '/content-sources/gensearch', { query, contentSource: { name: config.source, type: config.type } }).catch(() => null)
      : null;
    try {
      const json = await post(config, '/content-sources/search', body);
      if (id !== request) return;
      const results = (json.results || []).map(normalize);
      current = {
        query, cursor: json.cursor || '', results: append ? [...current.results, ...results] : results, total: json.totalResults || 0,
      };
      list.append(...results.map(resultItem));
      const countKey = current.total === 1 ? 'content-ai-search-count-one' : 'content-ai-search-count';
      const countText = current.total === 1 ? '1 result for “{query}”' : '{total} results for “{query}”';
      status.textContent = current.results.length
        ? t(countKey, countText, { total: current.total.toLocaleString('en-US'), query })
        : t('content-ai-search-none', 'No results for “{query}”. Try different or fewer words.', { query });
      more.hidden = !(current.cursor && current.results.length < current.total);
      if (append && results.length) list.children[current.results.length - results.length]?.querySelector('a, h3')?.focus?.();
      if (answerRequest) {
        if (config.answer) {
          answer.replaceChildren(el('p', { class: 'content-ai-search-answer-loading' }, t('content-ai-search-answering', 'Generating an answer…')));
          answer.hidden = false;
        }
        const data = await answerRequest;
        if (id === request) renderAnswer(data);
      }
    } catch (error) {
      if (id !== request) return;
      status.textContent = '';
      showNotice(failure(error));
    } finally {
      if (id === request) block.removeAttribute('aria-busy');
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) { input.focus(); return; }
    const url = new URL(window.location.href);
    url.searchParams.set('q', query);
    window.history.replaceState({}, '', url);
    runSearch(query);
  });
  more.addEventListener('click', () => runSearch(current.query, true));

  const initial = new URLSearchParams(window.location.search).get('q');
  if (initial && initial.trim()) {
    input.value = initial.trim();
    runSearch(initial.trim());
  }
}
