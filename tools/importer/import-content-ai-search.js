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
 *   - Content AI Search block settings: Environment (AEM environment), Content Source,
 *     Source Type, API Key, Mode, Answer, Results. Content Source and API Key are left
 *     empty: authors fill them in Document Authoring (the block shows a "not set up yet"
 *     notice until then).
 *   - Metadata: title, description, template
 */
import { el, metadata } from './lib/tn-common.js';

// AEM as a Cloud Service environment ("bucket") that hosts Content AI for this site
const ENVIRONMENT = 'author-p194952-e2065314';

export default {
  transform: ({ document }) => {
    const main = el(document, 'div');
    main.append(
      el(document, 'h1', {}, ['Search TDOT']),
      el(document, 'p', {}, ['Search the Tennessee Department of Transportation website. Results match what you mean, not only the exact words you type, and a short answer summarizes the best matches.']),
      WebImporter.Blocks.createBlock(document, {
        name: 'Content AI Search',
        cells: [
          ['Environment', ENVIRONMENT],
          ['Content Source', ''],
          ['Source Type', 'ACQUISITION'],
          ['API Key', ''],
          ['Mode', 'hybrid'],
          ['Answer', 'on'],
          ['Results', '10'],
        ],
      }),
      el(document, 'hr'),
      metadata(document, {
        title: 'Search | TDOT',
        description: 'Search the TDOT website with AI-powered search: results by meaning and keywords, with a short generated answer.',
        template: 'full-width',
      }),
    );
    return [{ element: main, path: '/content-ai-search', report: { title: 'Search TDOT' } }];
  },
};
