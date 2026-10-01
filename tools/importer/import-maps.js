/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the TDOT Maps page.
 * Source: https://www.tn.gov/tdot/driver-how-do-i/look-at-or-order-state-maps.html
 * Target: /maps (template: full-width)
 *
 * Output
 *   - H1 (source page title), intro paragraph
 *   - H2 + Map block: TDOT SmartWay Projects Map (ArcGIS web map item link | caption)
 *   - Section 2 (style "rule"): H2 "More maps" + list of the source's map content tiles,
 *     followed by the source's notice text
 *   - Metadata: title, description, template
 */
import {
  clean, el, href, cleanRte, mapSitePath, metadata, localizeImages,
} from './lib/tn-common.js';

// TDOT_GIS "TDOT SmartWay Projects Map v1" (public ArcGIS Online web map)
const PROJECTS_MAP = 'https://tdot.maps.arcgis.com/home/item.html?id=51a44c693265484b9eed5c689583edaa';

export default {
  transform: ({ document, params }) => {
    const root = document.querySelector('#main') || document.body;
    const main = el(document, 'div');

    const title = clean((root.querySelector('.tn-pagetitle h1') || document.querySelector('h1') || {}).textContent) || 'Maps';
    main.append(
      el(document, 'h1', {}, [title]),
      el(document, 'p', {}, ['Explore TDOT projects across Tennessee on the interactive map, or find state, county, city and traffic maps below.']),
      el(document, 'h2', {}, ['TDOT Projects Map']),
      WebImporter.Blocks.createBlock(document, {
        name: 'Map',
        cells: [
          [el(document, 'a', { href: PROJECTS_MAP }, ['TDOT SmartWay Projects Map'])],
          ['TDOT projects under construction and in preconstruction, with region and county boundaries. Select a project on the map for details.'],
        ],
      }),
    );

    // content tiles -> list of links
    const tiles = [...root.querySelectorAll('.tn-contenttile a[href]')];
    if (tiles.length) {
      main.append(
        el(document, 'hr'),
        el(document, 'h2', {}, ['More maps']),
        el(document, 'ul', {}, tiles.map((a) => el(document, 'li', {}, [
          el(document, 'a', { href: href(a.getAttribute('href')) }, [clean(a.getAttribute('title') || a.textContent)]),
        ]))),
      );
      root.querySelectorAll('.tn-rte').forEach((rte) => main.append(...cleanRte(document, rte)));
      main.append(WebImporter.Blocks.createBlock(document, { name: 'Section Metadata', cells: [['style', 'rule']] }));
    }

    const description = 'Interactive map of TDOT projects, plus state, county, city, functional classification and traffic maps.';
    main.append(el(document, 'hr'), metadata(document, { title: `${title} | TDOT`, description, template: 'full-width' }));

    const path = mapSitePath(new URL(params.originalURL).pathname);
    const media = localizeImages(main, path);
    return [{ element: main, path, report: { title, tiles: tiles.length, media } }];
  },
};
