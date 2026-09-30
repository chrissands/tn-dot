/**
 * Builds the rest of the Document Authoring library (see also build-block-library.cjs):
 *   content/library/templates/<template>.html  – page templates (sections, blocks,
 *                                                 section metadata, metadata)
 *   content/library/templates.json             – templates sheet (key | value)
 *   content/library/icons.json                 – icons sheet (key | value | icon)
 *   content/placeholders.json                  – placeholders sheet (key | text), site root
 *   content/metadata.json                      – bulk metadata sheet (URL | template | robots)
 *   content/library/da-library-config.json     – "library" tab rows for the project config
 *
 * node tools/library/build-library-sheets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const CONTENT = path.join(ROOT, 'content');
const LIB = path.join(CONTENT, 'library');
const DA = 'https://content.da.live/chrissands/tn-dot';
const SITE = 'https://main--tn-dot--chrissands.aem.live';

const sheet = (data) => ({ total: data.length, offset: 0, limit: data.length, data, ':type': 'sheet' });
const metadata = (rows) => `<div class="metadata">${Object.entries(rows).map(([k, v]) => `<div><div>${k}</div><div>${v}</div></div>`).join('')}</div>`;
const img = (file, alt) => `<picture><img src="./images/${file}" alt="${alt}"></picture>`;

// ---------- templates ----------
const TEMPLATES = {
  'news-article': {
    key: 'News article',
    html: [
      `<div>
<h1>Article headline</h1>
<h2>Optional subtitle – delete if not needed</h2>
<p><strong>NASHVILLE, Tenn.</strong> – Lead paragraph: who, what, where and when. The first paragraph over 40 characters becomes the article summary on the homepage and in the newsroom.</p>
<p>${img('placeholder-4x3.png', 'Describe the image')}</p>
<p>Body paragraph. Link to related information where helpful, e.g. <a href="https://smartway.tn.gov/">SmartWay</a>.</p>
<p>For more information, contact the TDOT Region office.</p>
</div>`,
      `<div>
${metadata({
    title: 'Article headline',
    description: 'One-sentence summary shown in search results and social previews.',
    'publication-date': '2026-01-15T09:00:00',
    category: 'TDOT, Region 3 Nashville Middle TN',
    template: 'news-article',
  })}
</div>`,
    ],
  },
  'page-sidebar': {
    key: 'Page with sidebar',
    html: [
      `<div>
<div class="side-nav subnav"><div><div>
<p><a href="https://www.tn.gov/tdot/traffic-operations-division.html">Section name</a></p>
<p>Section Menu</p>
<ul>
<li><a href="https://www.tn.gov/tdot/traffic-operations-division/motorist-information.html">Page in this section</a>
<ul><li><a href="https://www.tn.gov/tdot/traffic-operations-division/freeway-operations.html">Sub-page</a></li></ul>
</li>
<li><a href="/traffic-operations-division/yellow-dot-program">Another page in this section</a></li>
</ul>
</div></div></div>
</div>`,
      `<div>
<h1>Page title</h1>
<p>Introduction to the page. Keep it to a short paragraph or two.</p>
<h2>Section heading</h2>
<p>Body text. Add blocks from the library (e.g. Summary Box (panel), Columns (contact), Cards (media), Tabs, Form) where needed.</p>
<ul>
<li><a href="https://www.tn.gov/tdot.html">Related resource</a></li>
<li><a href="https://www.tn.gov/tdot.html">Another resource</a></li>
</ul>
</div>`,
      `<div>
${metadata({
    title: 'Page title',
    description: 'One-sentence summary shown in search results and social previews.',
    template: 'left-nav',
  })}
</div>`,
    ],
  },
  'page-full-width': {
    key: 'Full-width page',
    html: [
      `<div>
<h1>Page title</h1>
</div>`,
      `<div>
<div class="hero banner"><div><div>
<p>${img('placeholder-16x9.png', 'Describe the banner image')}</p>
<h2>Banner heading</h2>
<p>Short banner tagline. Delete this section if the page has no banner.</p>
</div></div></div>
</div>`,
      `<div>
<p><strong>Introduction to the page.</strong></p>
<div class="summary-box panel"><div><div>
<p>Optional notice or key information in a white panel.</p>
</div></div></div>
</div>`,
      `<div>
<div class="section-metadata"><div><div>style</div><div>rule</div></div></div>
<div class="columns link-lists">
<div>
<div><h2><a href="https://www.tn.gov/tdot.html">Link list title</a></h2><ul><li><a href="https://www.tn.gov/tdot.html">First link</a></li><li><a href="https://www.tn.gov/tdot.html">Second link</a></li></ul><p><a href="https://www.tn.gov/tdot.html">See More</a></p></div>
<div><h2><a href="https://www.tn.gov/tdot.html">Second list</a></h2><ul><li><a href="https://www.tn.gov/tdot.html">First link</a></li><li><a href="https://www.tn.gov/tdot.html">Second link</a></li></ul></div>
<div><h2><a href="https://www.tn.gov/tdot.html">Third list</a></h2><ul><li><a href="https://www.tn.gov/tdot.html">First link</a></li></ul></div>
<div><h2><a href="https://www.tn.gov/tdot.html">Fourth list</a></h2><ul><li><a href="https://www.tn.gov/tdot.html">First link</a></li></ul></div>
</div>
</div>
</div>`,
      `<div>
${metadata({
    title: 'Page title',
    description: 'One-sentence summary shown in search results and social previews.',
    template: 'full-width',
  })}
</div>`,
    ],
  },
};

fs.mkdirSync(path.join(LIB, 'templates', 'images'), { recursive: true });
['placeholder-4x3.png', 'placeholder-16x9.png'].forEach((f) => {
  fs.copyFileSync(path.join(LIB, 'blocks', 'images', f), path.join(LIB, 'templates', 'images', f));
});
const templates = Object.entries(TEMPLATES).map(([file, t]) => {
  fs.writeFileSync(path.join(LIB, 'templates', `${file}.html`), `${t.html.join('\n')}\n`);
  return { key: t.key, value: `${DA}/library/templates/${file}` };
});
fs.writeFileSync(path.join(LIB, 'templates.json'), `${JSON.stringify(sheet(templates), null, 2)}\n`);

// ---------- icons (code-hosted /icons/<name>.svg, inserted as :name:) ----------
const ICONS = [
  ['briefcase', 'Briefcase (business)'],
  ['cab', 'Car (driving)'],
  ['newspaper', 'Newspaper (news)'],
  ['search', 'Search'],
  ['users', 'People (careers)'],
];
const icons = ICONS.filter(([key]) => fs.existsSync(path.join(ROOT, 'icons', `${key}.svg`)))
  .map(([key, value]) => ({ key, value, icon: `${SITE}/icons/${key}.svg` }));
fs.writeFileSync(path.join(LIB, 'icons.json'), `${JSON.stringify(sheet(icons), null, 2)}\n`);

// ---------- placeholders (read by scripts/placeholders.js; {name} = filled in by the code) ----------
const PLACEHOLDERS = [
  ['pagination', 'Pagination', 'Pager: label of the page navigation'],
  ['first-page', 'First page', 'Pager: first-page arrow'],
  ['previous-page', 'Previous page', 'Pager: previous-page arrow'],
  ['next-page', 'Next page', 'Pager: next-page arrow'],
  ['page-number', 'Page {page}', 'Pager: page link'],
  ['last-page-number', 'Last page, page {page}', 'Pager: last page link'],
  ['published', 'Published', 'News list: label of the date line'],
  ['primary-navigation', 'Primary navigation', 'Header: main menu label'],
  ['secondary-navigation', 'Secondary navigation', 'Sidebar: default label'],
  ['submenu', '{label} submenu', 'Header / sidebar: sub-menu toggle'],
  ['search', 'Search', 'Header: search button'],
  ['footer-links', '{label} links', 'Footer: link column toggle (mobile)'],
  ['required', 'required', 'Form: required-field marker'],
  ['field-must-match', '{field} must match {other}.', 'Form: confirmation field error'],
  ['play-video', 'Play', 'Video: play button'],
];
const placeholders = PLACEHOLDERS.map(([key, text, usage]) => ({ key, text, usage }));
fs.writeFileSync(path.join(CONTENT, 'placeholders.json'), `${JSON.stringify(sheet(placeholders), null, 2)}\n`);

// ---------- bulk metadata (site root /metadata): folder-level defaults ----------
// Page metadata wins over these rows, so /news (template: newsroom) keeps its own template.
const BULK = [
  { URL: '/news/**', template: 'news-article', robots: '' },
  { URL: '/nav', template: '', robots: 'noindex' },
  { URL: '/footer', template: '', robots: 'noindex' },
  { URL: '/fragments/**', template: '', robots: 'noindex' },
  { URL: '/library/**', template: '', robots: 'noindex' },
];
fs.writeFileSync(path.join(CONTENT, 'metadata.json'), `${JSON.stringify(sheet(BULK), null, 2)}\n`);

// ---------- project config: library tab ----------
const library = [
  { title: 'Blocks', path: `${DA}/library/blocks.json` },
  { title: 'Templates', path: `${DA}/library/templates.json` },
  { title: 'Icons', path: `${DA}/library/icons.json`, format: ':<content>:' },
  { title: 'Placeholders', path: `${DA}/placeholders.json`, format: '{{<content>}}' },
];
fs.writeFileSync(path.join(LIB, 'da-library-config.json'), `${JSON.stringify({ library: sheet(library) }, null, 2)}\n`);

console.log(`templates: ${templates.map((t) => t.key).join(', ')}`);
console.log(`icons: ${icons.map((i) => i.key).join(', ')}`);
console.log(`placeholders: ${placeholders.length}`);
