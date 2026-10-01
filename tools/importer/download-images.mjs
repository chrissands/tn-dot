/* eslint-disable no-restricted-syntax, no-continue, no-await-in-loop, no-console */
/**
 * Downloads the source images of imported pages into content/images/, so that pages are
 * hosted from local copies (uploaded to Document Authoring), never linked to the source site.
 *
 * Import scripts link each image to its Document Authoring media folder (localizeImages in
 * lib/tn-common.js) and list [source URL, DA path] pairs as "media" in the import report;
 * this reads tools/importer/reports/**\/*.report.json and saves each source image as
 * content/images/<DA file name>. Existing files are kept.
 *
 * Run after the bulk import:  node tools/importer/download-images.mjs [--force]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const REPORTS = path.join(ROOT, 'tools/importer/reports');
const IMAGES = path.join(ROOT, 'content/images');
const FORCE = process.argv.includes('--force');

const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
};

const media = new Map();
for (const file of walk(REPORTS).filter((f) => f.endsWith('.report.json'))) {
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (report.status !== 'success' || !report.media) continue;
  JSON.parse(report.media).forEach(([source, daPath]) => media.set(path.basename(daPath), source));
}

fs.mkdirSync(IMAGES, { recursive: true });
const result = { downloaded: [], kept: 0, failed: [] };
for (const [name, source] of media) {
  const dest = path.join(IMAGES, name);
  if (!FORCE && fs.existsSync(dest)) { result.kept += 1; continue; }
  try {
    const resp = await fetch(source, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const type = resp.headers.get('content-type') || '';
    if (!resp.ok || !/^image\//.test(type)) throw new Error(`${resp.status} ${type}`);
    fs.writeFileSync(dest, Buffer.from(await resp.arrayBuffer()));
    result.downloaded.push(name);
  } catch (e) {
    result.failed.push(`${name} <- ${source}: ${e.message}`);
  }
}
console.log(`${media.size} images: ${result.downloaded.length} downloaded, ${result.kept} already local, ${result.failed.length} failed`);
if (result.failed.length) {
  console.log(result.failed.join('\n'));
  process.exitCode = 1;
}
