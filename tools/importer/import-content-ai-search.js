/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the new Content AI Search page (no tn.gov counterpart: the content is
 * authored here; the source page is only needed to run the import).
 * Source: https://www.tn.gov/tdot/driver-how-do-i/find-traveler-information.html
 * Target: /content-ai-search (template: full-width)
 *
 * Output
 *   - H1, intro paragraph
 *   - Content AI Search block with the page's display settings: Mode, Answer, Results.
 *     The connection settings and the API key are in the configuration sheet
 *     /config/content-ai-search (tools/library/create-content-ai-config.mjs); the block
 *     shows a "not set up yet" notice until its content source and key are filled in.
 *   - Metadata: title, description, template
 */
import { el, metadata } from './lib/tn-common.js';

export default {
  transform: ({ document }) => {
    const main = el(document, 'div');
    main.append(
      el(document, 'h1', {}, ['Search TDOT']),
      el(document, 'p', {}, ['Search the Tennessee Department of Transportation website for pages, news and documents.']),
      WebImporter.Blocks.createBlock(document, {
        name: 'Content AI Search',
        cells: [
          ['Mode', 'hybrid'],
          ['Answer', 'on'],
          ['Results', '10'],
        ],
      }),
      el(document, 'hr'),
      metadata(document, {
        title: 'Search | TDOT',
        description: 'Search the Tennessee Department of Transportation website for pages, news and documents.',
        template: 'full-width',
      }),
    );
    return [{ element: main, path: '/content-ai-search', report: { title: 'Search TDOT' } }];
  },
};
