/**
 * Renders /default-meta-image.png – the share image (og:image / twitter:image) EDS uses
 * for pages without their own image: 1200x630, navy, TN mark (2x, the largest it stays
 * sharp) + white TDOT wordmark at its native size.
 *
 * node tools/library/build-default-meta-image.cjs   (needs Playwright)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');

// embedded as data: URIs (file:// images don't load into a blank page)
const dataUri = (file) => `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'images', file)).toString('base64')}`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><html><body style="margin:0">
    <div style="width:1200px;height:630px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:32px;
      background:#1b365d;border-bottom:18px solid #e21a3c">
      <img src="${dataUri('tn-logo.png')}" style="height:130px">
      <img src="${dataUri('tdot-logo-white.png')}" style="height:184px">
    </div></body></html>`);
  // the wordmark PNG carries transparent padding: crop each logo to its visible pixels
  await p.evaluate(async () => {
    const imgs = [...document.images];
    await Promise.all(imgs.map((i) => i.decode()));
    imgs.forEach((img) => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let minX = c.width; let maxX = 0;
      for (let y = 0; y < c.height; y += 1) {
        for (let x = 0; x < c.width; x += 1) {
          if (data[(y * c.width + x) * 4 + 3] > 10) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
        }
      }
      const scale = img.getBoundingClientRect().height / img.naturalHeight;
      const box = document.createElement('div');
      box.style.cssText = `width:${Math.ceil((maxX - minX + 1) * scale)}px;overflow:hidden;flex:none`;
      img.style.marginLeft = `${-minX * scale}px`;
      img.replaceWith(box);
      box.append(img);
    });
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(ROOT, 'default-meta-image.png') });
  await b.close();
  console.log('wrote default-meta-image.png');
})();
