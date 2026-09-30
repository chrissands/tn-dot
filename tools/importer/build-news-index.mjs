#!/usr/bin/env node
/**
 * Builds a local-preview copy of the news index (content/news/query-index.json)
 * from the imported article documents, in the same shape as the published
 * EDS index defined in helix-query.yaml. Regenerate after (re-)importing news.
 *
 *   node tools/importer/build-news-index.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('content');
const NEWS = path.join(ROOT, 'news');
const OUT = path.join(NEWS, 'query-index.json');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return walk(p);
  return e.name.endsWith('.plain.html') ? [p] : [];
});

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ')
  .trim();

function readMetadata(html) {
  const block = html.match(/<div class="metadata">([\s\S]*)$/);
  if (!block) return {};
  const meta = {};
  const rows = block[1].split(/<div><div>/).slice(1);
  rows.forEach((row) => {
    const [key, ...rest] = row.split('</div><div>');
    const value = rest.join('</div><div>');
    const img = value.match(/<img[^>]+src="([^"]+)"/);
    meta[text(key).toLowerCase()] = img ? img[1] : text(value.replace(/<\/div>\s*<\/div>[\s\S]*$/, ''));
  });
  return meta;
}

const files = walk(NEWS).filter((f) => path.basename(f) !== 'index.plain.html');
const data = files.map((file) => {
  const html = fs.readFileSync(file, 'utf8');
  const meta = readMetadata(html);
  const rel = `/${path.relative(ROOT, file).replace(/\\/g, '/').replace(/\.plain\.html$/, '')}`;
  return {
    path: rel,
    title: meta.title || '',
    subtitle: meta.subtitle || '',
    description: meta.description || '',
    date: meta['publication-date'] || meta['publication date'] || '',
    category: meta.category || '',
    image: meta.image || '',
    lastModified: String(Math.floor(fs.statSync(file).mtimeMs / 1000)),
  };
}).filter((d) => d.title)
  .sort((a, b) => b.date.localeCompare(a.date));

fs.writeFileSync(OUT, `${JSON.stringify({
  total: data.length, offset: 0, limit: data.length, data, columns: Object.keys(data[0] || {}), ':type': 'sheet',
}, null, 2)}\n`);
console.log(`news index: ${data.length} entries -> ${path.relative(process.cwd(), OUT)}`);
