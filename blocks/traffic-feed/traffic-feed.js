/**
 * Traffic feed block: live list of traffic events from a JSON feed.
 *
 * Authoring – settings rows (first cell: name, second cell: value):
 *   Feed     | link or URL of the JSON feed (site path, e.g. /data/traffic-feed-sample.json,
 *              or another site that allows browser requests)
 *   Refresh  | seconds between automatic updates (default 60, minimum 30, 0 = off)
 *   Link     | optional link shown below the list (e.g. "More traffic information")
 *
 * Feed formats: an EDS/Document Authoring sheet ({ data: [...] }), a plain array, ArcGIS
 * ({ features: [{ attributes }] }) or GeoJSON ({ features: [{ properties }] }). Columns are
 * matched by name, case-insensitively (see FIELDS): type, title, route, direction, county,
 * region, location, description, lanes, severity, start, end, updated.
 *
 * Renders USWDS cards with event type / region filters, a status line (count, last update,
 * announced politely to screen readers) and a Refresh button. Updates pause while the page
 * is hidden; failed updates keep the last list and say so.
 */
import { toClassName } from '../../scripts/aem.js';
import { fetchContent } from '../../scripts/content-fetch.js';
import { loadPlaceholders, t } from '../../scripts/placeholders.js';

const FIELDS = {
  id: ['id', 'eventid', 'objectid', 'globalid'],
  type: ['type', 'eventtype', 'category', 'event'],
  title: ['title', 'headline', 'name', 'summary'],
  route: ['route', 'road', 'roadway', 'highway'],
  direction: ['direction', 'dir'],
  county: ['county'],
  region: ['region', 'district'],
  location: ['location', 'crossstreet', 'near', 'milemarker'],
  description: ['description', 'details', 'message', 'comments'],
  lanes: ['lanes', 'lanesaffected', 'impact', 'lanestatus'],
  severity: ['severity', 'priority'],
  start: ['start', 'starttime', 'startdate', 'begin'],
  end: ['end', 'endtime', 'enddate', 'expectedend'],
  updated: ['updated', 'lastupdated', 'modified', 'lastmodified', 'updatetime'],
};
const DEFAULT_REFRESH = 60;
const MIN_REFRESH = 30;
let idCounter = 0;

const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Feed records as plain objects, whatever the feed format. */
function records(json) {
  if (Array.isArray(json)) return json;
  const list = json.data || json.events || json.items || json.features || [];
  return list.map((r) => r.attributes || r.properties || r);
}

/** Date from ISO text or epoch seconds / milliseconds, else null. */
function toDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  let date;
  if (Number.isFinite(n)) date = new Date(n < 1e11 ? n * 1000 : n);
  else date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** One normalized event per record (fields matched by FIELDS aliases). */
function normalize(record, index) {
  const byKey = {};
  Object.entries(record).forEach(([k, v]) => { byKey[normKey(k)] = v; });
  const event = {};
  Object.entries(FIELDS).forEach(([field, aliases]) => {
    const key = aliases.find((a) => byKey[a] !== undefined && byKey[a] !== null && byKey[a] !== '');
    event[field] = key ? byKey[key] : '';
  });
  ['type', 'title', 'route', 'direction', 'county', 'region', 'location', 'description', 'lanes', 'severity']
    .forEach((f) => { event[f] = String(event[f]).trim(); });
  event.id = String(event.id || index);
  event.start = toDate(event.start);
  event.end = toDate(event.end);
  event.updated = toDate(event.updated);
  return event;
}

const formatTime = (date) => date.toLocaleString('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => { if (v !== undefined && v !== '') node.setAttribute(k, v); });
  node.append(...children.filter((c) => c !== undefined && c !== null && c !== ''));
  return node;
}

/** Settings rows -> { feed, refresh, link } */
function readSettings(block) {
  const settings = { feed: '', refresh: DEFAULT_REFRESH, link: null };
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    if (!keyCell || !valueCell) return;
    const key = toClassName(keyCell.textContent);
    const a = valueCell.querySelector('a[href]');
    if (key === 'feed') settings.feed = a ? a.getAttribute('href') : valueCell.textContent.trim();
    if (key === 'refresh') {
      const n = parseInt(valueCell.textContent, 10);
      if (Number.isFinite(n)) settings.refresh = n <= 0 ? 0 : Math.max(MIN_REFRESH, n);
    }
    if (key === 'link' && a) {
      // plain text link (not the button style decorateButtons gives a lone link)
      settings.link = a.cloneNode(true);
      settings.link.removeAttribute('class');
    }
  });
  return settings;
}

/** Fetches the feed: site paths through fetchContent (local preview aware), others directly. */
async function fetchFeed(feed) {
  const url = new URL(feed, window.location.href);
  const resp = url.origin === window.location.origin
    ? await fetchContent(`${url.pathname.replace(/^\/content(?=\/)/, '')}${url.search}`)
    : await fetch(url.href, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`feed ${resp.status}`);
  return records(await resp.json()).map(normalize);
}

function select(id, label, allLabel) {
  const control = el('select', { class: 'usa-select', id, name: id }, el('option', { value: '' }, allLabel));
  const group = el('div', { class: 'usa-form-group traffic-feed-filter' }, el('label', { class: 'usa-label', for: id }, label), control);
  return { group, control };
}

/** Replaces a select's options with the given values, keeping the current choice. */
function setOptions(control, values) {
  const current = control.value;
  const [all] = control.options;
  control.replaceChildren(all, ...values.map((v) => el('option', { value: v }, v)));
  control.value = values.includes(current) ? current : '';
}

function eventCard(event) {
  const heading = event.title || [event.route, event.direction].filter(Boolean).join(' ') || t('traffic-feed-event', 'Traffic event');
  const place = [event.location, event.county && !/county/i.test(event.county) ? `${event.county} County` : event.county, event.region]
    .filter(Boolean).join(' · ');
  const meta = el('dl', { class: 'traffic-feed-meta' });
  [
    [t('traffic-feed-route', 'Route'), event.title ? [event.route, event.direction].filter(Boolean).join(' ') : ''],
    [t('traffic-feed-lanes', 'Lanes'), event.lanes],
    [t('traffic-feed-start', 'Started'), event.start ? formatTime(event.start) : ''],
    [t('traffic-feed-end', 'Expected to end'), event.end ? formatTime(event.end) : ''],
  ].forEach(([label, value]) => {
    if (value) meta.append(el('div', {}, el('dt', {}, label), el('dd', {}, value)));
  });
  const typeClass = toClassName(event.type) || 'event';
  return el(
    'li',
    { class: `usa-card traffic-feed-event traffic-feed-event--${typeClass}` },
    el(
      'div',
      { class: 'usa-card__container' },
      el(
        'div',
        { class: 'usa-card__header' },
        event.type ? el('span', { class: `usa-tag traffic-feed-tag traffic-feed-tag--${typeClass}` }, event.type) : '',
        el('h3', { class: 'usa-card__heading' }, heading),
        place ? el('p', { class: 'traffic-feed-place' }, place) : '',
      ),
      el(
        'div',
        { class: 'usa-card__body' },
        event.description ? el('p', {}, event.description) : '',
        meta.children.length ? meta : '',
      ),
      event.updated ? el('div', { class: 'usa-card__footer' }, el('p', { class: 'traffic-feed-time' }, t('traffic-feed-event-updated', 'Updated {time}', { time: formatTime(event.updated) }))) : '',
    ),
  );
}

export default async function decorate(block) {
  const settings = readSettings(block);
  await loadPlaceholders();
  idCounter += 1;
  const uid = `traffic-feed-${idCounter}`;

  const type = select(`${uid}-type`, t('traffic-feed-type', 'Event type'), t('traffic-feed-all-types', 'All event types'));
  const region = select(`${uid}-region`, t('traffic-feed-region', 'Region'), t('traffic-feed-all-regions', 'All regions'));
  const status = el('p', { class: 'traffic-feed-status', role: 'status', 'aria-live': 'polite' });
  const refreshButton = el('button', { class: 'usa-button usa-button--outline traffic-feed-refresh', type: 'button' }, t('traffic-feed-refresh', 'Refresh'));
  const alert = el(
    'div',
    { class: 'usa-alert usa-alert--warning usa-alert--slim traffic-feed-alert', hidden: 'hidden' },
    el('div', { class: 'usa-alert__body' }, el('p', { class: 'usa-alert__text' })),
  );
  const list = el('ul', { class: 'usa-card-group traffic-feed-list' });
  const empty = el('p', { class: 'traffic-feed-empty', hidden: 'hidden' });
  const toolbar = el(
    'div',
    { class: 'traffic-feed-toolbar' },
    el('div', { class: 'traffic-feed-filters' }, type.group, region.group),
    el('div', { class: 'traffic-feed-actions' }, status, refreshButton),
  );
  block.replaceChildren(toolbar, alert, list, empty);
  if (settings.link) block.append(el('p', { class: 'traffic-feed-more' }, settings.link));

  let events = [];
  let loadedAt = null;
  let loading = false;

  const render = () => {
    const shown = events.filter((e) => (!type.control.value || e.type === type.control.value)
      && (!region.control.value || e.region === region.control.value));
    list.replaceChildren(...shown.map(eventCard));
    empty.hidden = shown.length > 0 || !loadedAt;
    empty.textContent = events.length
      ? t('traffic-feed-no-match', 'No traffic events match the selected filters.')
      : t('traffic-feed-none', 'No traffic events are currently reported.');
    if (loadedAt) {
      status.textContent = t('traffic-feed-status', '{count} of {total} events · Updated {time}', {
        count: shown.length, total: events.length, time: formatTime(loadedAt),
      });
    }
  };

  const showAlert = (text) => {
    alert.querySelector('.usa-alert__text').textContent = text;
    alert.hidden = !text;
  };

  const load = async () => {
    if (loading || !settings.feed) return;
    loading = true;
    block.setAttribute('aria-busy', 'true');
    try {
      events = (await fetchFeed(settings.feed))
        .sort((a, b) => (b.updated || b.start || 0) - (a.updated || a.start || 0));
      loadedAt = new Date();
      const uniq = (field) => [...new Set(events.map((e) => e[field]).filter(Boolean))].sort();
      setOptions(type.control, uniq('type'));
      setOptions(region.control, uniq('region'));
      showAlert('');
    } catch (e) {
      showAlert(loadedAt
        ? t('traffic-feed-stale', 'Traffic information could not be updated. Showing information from {time}.', { time: formatTime(loadedAt) })
        : t('traffic-feed-error', 'Traffic information is not available right now. Please try again later.'));
    } finally {
      loading = false;
      block.removeAttribute('aria-busy');
      render();
    }
  };

  type.control.addEventListener('change', render);
  region.control.addEventListener('change', render);
  refreshButton.addEventListener('click', load);

  if (!settings.feed) {
    showAlert(t('traffic-feed-no-feed', 'No traffic feed is configured.'));
    return;
  }
  await load();

  if (settings.refresh) {
    const ms = settings.refresh * 1000;
    let timer = setInterval(load, ms);
    document.addEventListener('visibilitychange', () => {
      clearInterval(timer);
      if (document.hidden) return;
      if (!loadedAt || Date.now() - loadedAt >= ms) load();
      timer = setInterval(load, ms);
    });
  }
}
