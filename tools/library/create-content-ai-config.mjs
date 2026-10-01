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
  ['environment', 'author-p194952-e2065314', 'AEM as a Cloud Service environment that hosts Content AI (author-p…-e…).'],
  ['content-source', '', 'Name of the Content AI content source to search (it must have public access).'],
  ['source-type', 'ACQUISITION', 'Type of the content source: ACQUISITION, AEM_PUBLISH, AEM_AUTHOR or CUSTOM.'],
  ['api-key', '', 'Content AI API key with read-only access to public content sources. Published with this sheet, so visible to anyone: never use a key or token with more access.'],
  ['endpoint', '', 'Optional: full Content AI API URL, if not https://<environment>.adobeaemcloud.com/adobe/experimental/aemcontentai-expires-20261231/contentAI.'],
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
