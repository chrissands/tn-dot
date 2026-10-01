# Content AI search proxy

A Cloudflare Worker between the [Content AI Search block](../../blocks/content-ai-search/content-ai-search.js)
and the AEM Content AI API.

## Why it's needed

Content AI does not accept browser requests from other sites (no CORS, and preflight
requests get `401`). The page therefore cannot call it directly. The Worker calls it
server-side and keeps the API key as a secret, so the key never appears in the page or
in the published configuration sheet.

## What it allows

- **Routes:** only `POST /content-sources/search` and `POST /content-sources/gensearch`.
  Everything else gets `404`.
- **Content source:** always `CONTENT_SOURCE` from the Worker settings. The page cannot
  search other sources.
- **Results:** at most 50 per page. Request bodies are limited to 16 KB.
- **Origins:** CORS only for `ALLOWED_ORIGINS`. Other sites get `403`.
- **Errors:** Content AI's status codes are passed through, and its response headers are
  dropped.

## Deploy

```sh
cd tools/content-ai-proxy
# 1. set CONTENT_SOURCE (and check CONTENT_AI_ENVIRONMENT / ALLOWED_ORIGINS) in wrangler.toml
# 2. store the API key as a secret (you are prompted for it; it is not echoed or saved in files)
npx wrangler secret put CONTENT_AI_API_KEY
# 3. deploy
npx wrangler deploy
```

`wrangler deploy` prints the Worker URL, e.g. `https://tdot-content-ai-search.<account>.workers.dev`.

## Connect the site

1. In Document Authoring, open the sheet `/config/content-ai-search`.
2. Put the Worker URL in the `endpoint` row.
3. Leave `api-key` empty.
4. Preview and publish the sheet.

When the site gets its production domain, add it to `ALLOWED_ORIGINS` and deploy again.

Optional: add a Cloudflare rate-limiting rule for the Worker route to cap requests per
visitor.
