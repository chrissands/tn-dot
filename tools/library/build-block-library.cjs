/**
 * Builds the Document Authoring block library from the migrated pages:
 *   content/library/blocks/<block>.html  – one section per block style: the block div-grid
 *                                          (first real instance on the site, images swapped
 *                                          for library placeholders) + library-metadata
 *   content/library/blocks.json          – blocks sheet (name | path)
 *
 * node tools/library/build-block-library.cjs   (needs Playwright for DOM parsing)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const CONTENT = path.join(ROOT, 'content');
const LIB = path.join(CONTENT, 'library');
const DA = 'https://content.da.live/chrissands/tn-dot';

// Block styles offered to authors (in library order). `classes` = block class list;
// `from` = page to take the sample from (default: first page using those classes);
// `html` = synthesized sample when no page uses the block directly.
const LIBRARY = [
  { block: 'accordion', entries: [
    { classes: 'accordion', name: 'Accordion', description: 'Expandable sections, one row per item: title | content (text, lists, links). Titles become headings one level below the heading before the block. Styles: multiselectable (several open at once), open (first item open).' },
  ] },
  { block: 'alert', entries: [
    { classes: 'alert info slim no-icon', name: 'Alert (info, slim)', description: 'Slim yellow notice bar with bold lead-in text and a link, e.g. a project update under the homepage video.' },
    { classes: 'alert info slim inline', name: 'Alert (info, inline)', description: 'Blue notice within the page width (not edge to edge), e.g. the sample-data notice above the traffic feed. Other types: warning, error, success.' },
  ] },
  { block: 'cards', entries: [
    { classes: 'cards news latest', name: 'Cards (latest news)', description: 'The newest articles from the news index. Settings rows: Source (index), Count, Link Text. No stories to author – new articles appear automatically.' },
    { classes: 'cards people', name: 'Cards (people)', description: 'Portrait cards with name, quote and a story link, plus an image-less call-to-action card (bold link = navy button).' },
    { classes: 'cards tiles', name: 'Cards (tiles)', description: 'Linked image tiles with a caption, e.g. "For All The Ways That Move You".' },
    { classes: 'cards media', name: 'Cards (media)', description: 'Image, heading and text in two columns, e.g. the scenic roadway types.' },
  ] },
  { block: 'collection', entries: [
    { classes: 'collection news', name: 'Collection (news listing)', description: 'Paginated news list from the news index with category filtering (?category=). Settings rows: Source, Page Size, Link Text, Empty Text.' },
  ] },
  { block: 'columns', entries: [
    { classes: 'columns links', name: 'Columns (links)', description: 'Dark band of categorized link lists with :icon: headings (homepage quick links).' },
    { classes: 'columns feature', name: 'Columns (feature)', description: 'Intro cell plus priority cells with orange buttons, on a dark background section.' },
    { classes: 'columns stats', name: 'Columns (stats)', description: 'Large figures with a linked caption, four per row.' },
    { classes: 'columns callout', name: 'Columns (callout)', description: 'Centered headline, text and arrow link per column on a dark background section.' },
    { classes: 'columns media', name: 'Columns (media)', description: 'Wide image beside text, e.g. "For All The Ways That Move You".' },
    { classes: 'columns contact', name: 'Columns (contact)', description: 'Photo with an italic caption beside a white contact card (2/3 + 1/3).' },
    { classes: 'columns link-lists', name: 'Columns (link lists)', description: 'Up to four link lists per row: linked H2 title with a colored rule, links, optional "See More" link.' },
  ] },
  { block: 'form', entries: [
    { classes: 'form', name: 'Form', description: 'Native form. Header row, then one row per field (Type, Name, Label, Options, Required, Show If, Style) and settings rows: action (endpoint URL), captcha (reCAPTCHA site key), success, error.', trimForm: true },
  ] },
  { block: 'fragment', entries: [
    { classes: 'fragment', name: 'Fragment', description: 'Includes a shared document from /fragments/ (e.g. the newsroom category sidebar).', html: '<div class="fragment"><div><div><p><a href="/fragments/news-sidebar">/fragments/news-sidebar</a></p></div></div></div>' },
  ] },
  { block: 'hero', entries: [
    { classes: 'hero video', name: 'Hero (video)', description: 'Full-bleed background video (/media/*.mp4 link) with poster image, logo, H1 and tagline.' },
    { classes: 'hero banner', name: 'Hero (banner)', description: 'Full-bleed photo banner with a heading and tagline over a bottom gradient. Put it in its own section, below the page H1.' },
  ] },
  { block: 'map', entries: [
    { classes: 'map', name: 'Map (ArcGIS)', description: 'Embedded ArcGIS Online map. Row 1: link to an ArcGIS web map (item page or Map Viewer link) or app; the link text is the map name. Row 2 (optional): caption. Loads when scrolled into view; "tall" style = 4:3.' },
  ] },
  { block: 'side-nav', entries: [
    { classes: 'side-nav subnav', name: 'Side Nav (section)', description: 'Section sidebar: heading link, "Section Menu" label for mobile, links with collapsible sub-menus. Put it in its own first section of a left-nav page.' },
    { classes: 'side-nav newsroom', name: 'Side Nav (newsroom)', description: 'Newsroom category sidebar (All News + category filters). Newsroom pages load it automatically from /fragments/news-sidebar.' },
  ] },
  { block: 'summary-box', entries: [
    { classes: 'summary-box panel', name: 'Summary Box (panel)', description: 'White notice panel with a soft shadow. A leading fully-bold paragraph shows as a red warning line; a heading mid-panel is a large call-out (e.g. a hotline number).' },
  ] },
  { block: 'tabs', entries: [
    { classes: 'tabs', name: 'Tabs', description: 'One row per tab: label | content. Accordion on phones. In a tab: image paragraph + YouTube link paragraph = video; H2 + list of links = links panel.', trimTabs: true },
  ] },
  { block: 'traffic-feed', entries: [
    { classes: 'traffic-feed', name: 'Traffic Feed', description: 'Live list of traffic events from a JSON feed with type and region filters. Settings rows: Feed (JSON URL – a sheet, ArcGIS or GeoJSON feed), Refresh (seconds, 0 = off), Link (optional link below the list).' },
  ] },
  { block: 'video', entries: [
    { classes: 'video', name: 'Video', description: 'Poster image with a play label; loads the YouTube, Vimeo or .mp4 video on click.', html: '<div class="video"><div><div><p><picture><img src="./images/placeholder-16x9.png" alt="Video poster"></picture></p><p><a href="https://www.youtube.com/watch?v=DfLGZzxtrrc">Watch video</a></p></div></div></div>' },
  ] },
];

const WIDE = /^(hero|video)$|banner|media|contact/;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  if (d.isDirectory() || (d.isSymbolicLink() && fs.statSync(p).isDirectory())) return d.name === 'library' ? [] : walk(p);
  return p.endsWith('.plain.html') && !p.endsWith('/tdot.plain.html') ? [p] : [];
});

(async () => {
  const pages = walk(CONTENT).map((f) => ({ page: path.relative(CONTENT, f).replace(/\.plain\.html$/, ''), html: fs.readFileSync(f, 'utf8') }))
    // homepage first: it holds the canonical instance of most blocks
    .sort((a, b) => (a.page === 'index' ? -1 : b.page === 'index' ? 1 : a.page.localeCompare(b.page)));
  fs.mkdirSync(path.join(LIB, 'blocks', 'images'), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent('<html><body></body></html>');
  const index = [];
  for (const { block, entries } of LIBRARY) {
    const sections = [];
    for (const entry of entries) {
      const sample = await p.evaluate(({ entry, pages, wide }) => {
        const clean = (el) => {
          el.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
          el.querySelectorAll('picture').forEach((pic) => {
            const img = pic.querySelector('img');
            const alt = img?.getAttribute('alt') || 'Sample image';
            pic.innerHTML = `<img src="./images/${wide ? 'placeholder-16x9' : 'placeholder-4x3'}.png" alt="${alt.replace(/"/g, '&quot;')}">`;
          });
          el.querySelectorAll('img:not(picture img)').forEach((img) => {
            const pic = document.createElement('picture');
            pic.innerHTML = `<img src="./images/placeholder-4x3.png" alt="${(img.getAttribute('alt') || 'Sample image').replace(/"/g, '&quot;')}">`;
            img.replaceWith(pic);
          });
          return el;
        };
        if (entry.html) {
          const t = document.createElement('div');
          t.innerHTML = entry.html;
          return { html: t.firstElementChild.outerHTML, from: null };
        }
        const want = entry.classes.split(' ').sort().join(' ');
        for (const { page, html } of pages) {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const found = [...doc.querySelectorAll('div[class]')].find((d) => d.className.split(' ').sort().join(' ') === want);
          if (!found) continue;
          const el = clean(found.cloneNode(true));
          if (entry.trimForm) {
            const keep = new Set(['emergency', 'call-911', 'name', 'email', 'email-confirm', 'request-type', 'comments', 'follow-up', 'contact-method', 'submit', 'action', 'captcha', 'success', 'error']);
            [...el.children].slice(1).forEach((row) => {
              const name = row.children[1]?.textContent.trim();
              if (!keep.has(name)) row.remove();
              const opts = row.children[3]?.querySelector('ul');
              if (opts && opts.children.length > 4) [...opts.children].slice(4).forEach((li) => li.remove());
            });
          }
          if (entry.trimTabs) {
            [...el.children].forEach((row, i) => {
              const cell = row.children[1];
              if (!cell) return;
              const kids = [...cell.children];
              const keepIdx = new Set();
              kids.forEach((k, j) => { if (j < 3) keepIdx.add(j); });
              if (i === 0) {
                // first tab: keep one image, the video pair and the links panel
                const firstPic = kids.findIndex((k) => k.matches('p') && k.querySelector('picture') && !kids[kids.indexOf(k) + 1]?.querySelector('a[href*="youtube"]'));
                if (firstPic >= 0) keepIdx.add(firstPic);
                kids.forEach((k, j) => {
                  if (k.querySelector('a[href*="youtube"]')) { keepIdx.add(j); keepIdx.add(j - 1); }
                  if (/^H[23]$/.test(k.tagName) && kids[j + 1]?.tagName === 'UL') { keepIdx.add(j); keepIdx.add(j + 1); }
                });
              }
              kids.forEach((k, j) => { if (!keepIdx.has(j)) k.remove(); });
              cell.querySelectorAll('h2 + ul, h3 + ul').forEach((ul) => [...ul.children].slice(4).forEach((li) => li.remove()));
            });
          }
          return { html: el.outerHTML, from: page };
        }
        return null;
      }, { entry, pages, wide: WIDE.test(entry.classes.split(' ').slice(1).join(' ') || block) });
      if (!sample) { console.warn(`⚠️ Skipped ${entry.name}: no instance found`); continue; }
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      sections.push(`<div>\n${sample.html}\n<div class="library-metadata"><div><div>name</div><div>${esc(entry.name)}</div></div><div><div>description</div><div>${esc(entry.description)}</div></div></div>\n</div>`);
      console.log(`  ${entry.name} <- ${sample.from || 'synthesized'}`);
    }
    if (!sections.length) continue;
    fs.writeFileSync(path.join(LIB, 'blocks', `${block}.html`), `${sections.join('\n')}\n`);
    const display = block.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    index.push({ name: display, path: `${DA}/library/blocks/${block}` });
    console.log(`Generated content/library/blocks/${block}.html (${sections.length} styles)`);
  }
  await b.close();
  index.sort((x, y) => x.name.localeCompare(y.name));
  const sheet = { total: index.length, offset: 0, limit: index.length, data: index, ':type': 'sheet' };
  fs.writeFileSync(path.join(LIB, 'blocks.json'), `${JSON.stringify(sheet, null, 2)}\n`);
  console.log(`blocks.json: ${index.length} blocks`);
})();
