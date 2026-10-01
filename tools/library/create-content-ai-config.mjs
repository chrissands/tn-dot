/* eslint-disable no-console */
/**
 * Creates the Content AI Search configuration sheet in Document Authoring:
 *   /config/content-ai-search (published as /config/content-ai-search.json), columns
 *   key | value | description – read by blocks/content-ai-search.
 *
 * The sheet is created only if it does not exist yet: it holds the API key, which authors
 * enter in Document Authoring, so it is never overwritten (and deliberately has no copy in
 * content/, which the workspace-to-DA content sync would push over the authored sheet).
 * Needs admin.da.live credentials.
 *
 *   node tools/library/create-content-ai-config.mjs
 */
const SOURCE = 'https://admin.da.live/source/chrissands/tn-dot';
const PATH = '/config/content-ai-search.json';

const ROWS = [
  ['endpoint', '', 'URL of the search proxy (tools/content-ai-proxy, a Cloudflare Worker that holds the API key). Content AI does not accept browser requests, so the live site needs it.'],
  ['environment', 'author-p194952-e2312587', 'Only without a proxy: AEM as a Cloud Service environment that hosts Content AI.'],
  ['content-source', '', 'Only without a proxy: Content AI content source to search (the proxy has its own).'],
  ['source-type', 'ACQUISITION', 'Only without a proxy: ACQUISITION, AEM_PUBLISH, AEM_AUTHOR or CUSTOM.'],
  ['api-key', '', 'Leave empty with a proxy (the key is a Worker secret). This sheet is published: anything here is public.'],
];

const existing = await fetch(`${SOURCE}${PATH}`, { method: 'HEAD' });
if (existing.ok) {
  console.log(`${PATH} already exists – left unchanged`);
} else if (existing.status !== 404) {
  console.log(`${PATH}: unexpected status ${existing.status} – nothing written`);
  process.exitCode = 1;
} else {
  const data = ROWS.map(([key, value, description]) => ({ key, value, description }));
  const sheet = {
    total: data.length, offset: 0, limit: data.length, data, ':type': 'sheet',
  };
  const form = new FormData();
  form.append('data', new Blob([JSON.stringify(sheet)], { type: 'application/json' }), 'content-ai-search.json');
  const resp = await fetch(`${SOURCE}${PATH}`, { method: 'POST', body: form });
  console.log(`${resp.status} ${PATH} created`);
  if (!resp.ok) process.exitCode = 1;
}
