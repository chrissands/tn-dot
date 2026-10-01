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
 * Existing files are kept. PDFs over 20 MB (the Edge Delivery Services limit) are not used:
 * they are added to tools/importer/large-documents.json, which the importers read to keep
 * those links on tn.gov – re-import the pages listed in the output.
 *
 * Run after the bulk import:  node tools/importer/download-media.mjs [--force]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const REPORTS = path.join(ROOT, 'tools/importer/reports');
const CONTENT = path.join(ROOT, 'content');
const FORCE = process.argv.includes('--force');
const LARGE_FILE = path.join(ROOT, 'tools/importer/large-documents.json');
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const large = new Set(JSON.parse(fs.readFileSync(LARGE_FILE, 'utf8')).documents);
const reimport = new Set();

const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
};

// local file -> [source URL, expected content type, page path]
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
      downloads.set(path.join(CONTENT, sitePath), [source, /^application\/(pdf|octet-stream)/, report.path]);
    });
  }
}

const result = { downloaded: [], kept: 0, failed: [] };
for (const [dest, [source, type, page]] of downloads) {
  if (large.has(source)) continue;
  if (!FORCE && fs.existsSync(dest)) {
    if (dest.endsWith('.pdf') && fs.statSync(dest).size > MAX_PDF_BYTES) {
      // not uploaded: the re-imported page no longer links it
      large.add(source);
      reimport.add(page);
      continue;
    }
    result.kept += 1;
    continue;
  }
  try {
    const resp = await fetch(source, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const contentType = resp.headers.get('content-type') || '';
    if (!resp.ok || !type.test(contentType)) throw new Error(`${resp.status} ${contentType}`);
    const body = Buffer.from(await resp.arrayBuffer());
    if (dest.endsWith('.pdf') && body.length > MAX_PDF_BYTES) {
      large.add(source);
      reimport.add(page);
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, body);
    result.downloaded.push(path.relative(CONTENT, dest));
  } catch (e) {
    result.failed.push(`${path.relative(CONTENT, dest)} <- ${source}: ${e.message}`);
  }
}
console.log(`${downloads.size} files: ${result.downloaded.length} downloaded, ${result.kept} already local, ${result.failed.length} failed`);
fs.writeFileSync(LARGE_FILE, `${JSON.stringify({ documents: [...large].sort() }, null, 2)}\n`);
if (reimport.size) {
  console.log(`PDFs over 20 MB stay on tn.gov (large-documents.json) – re-import: ${[...reimport].join(', ')}`);
}
if (result.failed.length) {
  console.log(result.failed.join('\n'));
  process.exitCode = 1;
}
