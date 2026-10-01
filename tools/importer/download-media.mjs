/* eslint-disable no-restricted-syntax, no-continue, no-await-in-loop, no-console */
/**
 * Downloads the source images and PDFs of imported pages into content/, so that pages are
 * hosted from local copies (uploaded to Document Authoring), never linked to the source site.
 *
 * Import scripts list what to download in the import report
 * (tools/importer/reports/**\/*.report.json):
 *   media     – [source URL, DA path] per image (localizeImages in lib/tn-common.js)
 *               -> content/images/<DA file name>
 *   documents – [source URL, site path] per PDF (localizeDocuments)
 *               -> content/<site path>, e.g. content/civil-rights/<page>/<file>.pdf
 * Existing files are kept.
 *
 * Run after the bulk import:  node tools/importer/download-media.mjs [--force]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const REPORTS = path.join(ROOT, 'tools/importer/reports');
const CONTENT = path.join(ROOT, 'content');
const FORCE = process.argv.includes('--force');

const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
};

// local file -> [source URL, expected content type]
const downloads = new Map();
for (const file of walk(REPORTS).filter((f) => f.endsWith('.report.json'))) {
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (report.status !== 'success') continue;
  if (report.media) {
    JSON.parse(report.media).forEach(([source, daPath]) => {
      downloads.set(path.join(CONTENT, 'images', path.basename(daPath)), [source, /^image\//]);
    });
  }
  if (report.documents) {
    JSON.parse(report.documents).forEach(([source, sitePath]) => {
      downloads.set(path.join(CONTENT, sitePath), [source, /^application\/(pdf|octet-stream)/]);
    });
  }
}

const result = { downloaded: [], kept: 0, failed: [] };
for (const [dest, [source, type]] of downloads) {
  if (!FORCE && fs.existsSync(dest)) { result.kept += 1; continue; }
  try {
    const resp = await fetch(source, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const contentType = resp.headers.get('content-type') || '';
    if (!resp.ok || !type.test(contentType)) throw new Error(`${resp.status} ${contentType}`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(await resp.arrayBuffer()));
    result.downloaded.push(path.relative(CONTENT, dest));
  } catch (e) {
    result.failed.push(`${path.relative(CONTENT, dest)} <- ${source}: ${e.message}`);
  }
}
console.log(`${downloads.size} files: ${result.downloaded.length} downloaded, ${result.kept} already local, ${result.failed.length} failed`);
if (result.failed.length) {
  console.log(result.failed.join('\n'));
  process.exitCode = 1;
}
