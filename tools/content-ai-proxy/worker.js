/**
 * Content AI search proxy (Cloudflare Worker) for the Content AI Search block.
 *
 * Content AI does not allow browser (CORS) requests, so the block calls this Worker, which
 * forwards two read-only operations with the API key kept as a Worker secret:
 *   POST /content-sources/search     -> Content AI search
 *   POST /content-sources/gensearch  -> Content AI generative search (answer)
 * Anything else is rejected. The content source is always the one configured here (the
 * request's contentSource is replaced), results per page are capped, and only the allowed
 * origins get CORS headers.
 *
 * Configuration (wrangler.toml [vars] / secrets):
 *   CONTENT_AI_ENVIRONMENT  AEM environment, e.g. author-p12345-e67890 (or CONTENT_AI_BASE)
 *   CONTENT_AI_BASE         optional full API base URL
 *   CONTENT_SOURCE          content source name; CONTENT_SOURCE_TYPE (default ACQUISITION)
 *   ALLOWED_ORIGINS         comma-separated site origins allowed to call the proxy
 *   CONTENT_AI_API_KEY      secret: wrangler secret put CONTENT_AI_API_KEY
 */

const API_PATH = '/adobe/experimental/aemcontentai-expires-20261231/contentAI';
const ROUTES = ['/content-sources/search', '/content-sources/gensearch'];
const MAX_BODY = 16 * 1024;
const MAX_RESULTS = 50;

const origins = (env) => (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);

function cors(origin, env) {
  if (!origin || !origins(env).includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function reply(status, body, headers) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

/** Request body with the configured content source and capped pagination */
function sanitize(body, env, path) {
  const contentSource = { name: env.CONTENT_SOURCE, type: env.CONTENT_SOURCE_TYPE || 'ACQUISITION' };
  if (path.endsWith('/gensearch')) {
    return { query: String(body.query || '').slice(0, 500), contentSource };
  }
  const out = { ...body, contentSource };
  const pagination = { ...(body.queryOptions && body.queryOptions.pagination) };
  pagination.limit = Math.min(MAX_RESULTS, Math.max(1, Number(pagination.limit) || 10));
  out.queryOptions = { ...body.queryOptions, pagination };
  return out;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin, env);
    const { pathname } = new URL(request.url);

    if (origin && !headers['Access-Control-Allow-Origin']) return reply(403, { error: 'origin not allowed' }, {});
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST' || !ROUTES.includes(pathname)) return reply(404, { error: 'not found' }, headers);
    if (!env.CONTENT_AI_API_KEY || !env.CONTENT_SOURCE) return reply(503, { error: 'proxy not configured' }, headers);

    const text = await request.text();
    if (text.length > MAX_BODY) return reply(413, { error: 'request too large' }, headers);
    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      return reply(400, { error: 'invalid JSON' }, headers);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'invalid request' }, headers);

    const base = (env.CONTENT_AI_BASE || `https://${env.CONTENT_AI_ENVIRONMENT}.adobeaemcloud.com${API_PATH}`).replace(/\/+$/, '');
    const upstream = await fetch(`${base}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Api-Key': env.CONTENT_AI_API_KEY },
      body: JSON.stringify(sanitize(body, env, pathname)),
    });
    // pass the result (or the error status) through, never upstream headers
    return reply(upstream.status, await upstream.text(), headers);
  },
};
