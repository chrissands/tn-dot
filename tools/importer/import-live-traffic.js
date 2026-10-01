/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the new Live Traffic page (no tn.gov counterpart: the content is
 * authored here; the source page only provides the related traveler-information links).
 * Source: https://www.tn.gov/tdot/driver-how-do-i/find-traveler-information.html
 * Target: /live-traffic (template: full-width)
 *
 * Output
 *   - H1, intro paragraph, Alert (info, slim, inline): sample-data notice (delete once the live
 *     SmartWay feed is connected)
 *   - H2 + Traffic Feed block: Feed | /data/traffic-feed-sample.json, Refresh | 60,
 *     Link | SmartWay traffic map
 *   - Section 2 (style "rule"): H2 "More traveler information" + list of links
 *   - Metadata: title, description, template
 */
import { el, href, metadata } from './lib/tn-common.js';

const FEED = '/data/traffic-feed-sample.json';
const SMARTWAY = 'https://smartway.tn.gov/traffic';

export default {
  transform: ({ document }) => {
    const main = el(document, 'div');
    const title = 'Live Traffic';

    main.append(
      el(document, 'h1', {}, [title]),
      el(document, 'p', {}, ['Current incidents, construction and closures on Tennessee highways. The list updates automatically every minute; filter it by event type or TDOT region.']),
      WebImporter.Blocks.createBlock(document, {
        name: 'Alert',
        variants: ['info', 'slim', 'inline'],
        cells: [[el(document, 'div', {}, [
          el(document, 'strong', {}, ['Sample data:']),
          ' this page shows sample traffic events until the live SmartWay feed is connected. For current conditions, visit ',
          el(document, 'a', { href: SMARTWAY }, ['SmartWay']),
          ' or call 511.',
        ])]],
      }),
      el(document, 'h2', {}, ['Current traffic events']),
      WebImporter.Blocks.createBlock(document, {
        name: 'Traffic Feed',
        cells: [
          ['Feed', el(document, 'a', { href: FEED }, [FEED])],
          ['Refresh', '60'],
          ['Link', el(document, 'a', { href: SMARTWAY }, ['See the full traffic map on SmartWay'])],
        ],
      }),
      el(document, 'hr'),
      el(document, 'h2', {}, ['More traveler information']),
      el(document, 'ul', {}, [
        [SMARTWAY, 'SmartWay traffic map and cameras'],
        [href('/tdot/driver-how-do-i/find-traveler-information.html'), 'Traveling in Tennessee'],
        [href('/tdot/driver-how-do-i/look-at-or-order-state-maps.html'), 'Maps'],
      ].map(([url, text]) => el(document, 'li', {}, [el(document, 'a', { href: url }, [text])]))),
      WebImporter.Blocks.createBlock(document, { name: 'Section Metadata', cells: [['style', 'rule']] }),
      el(document, 'hr'),
      metadata(document, {
        title: `${title} | TDOT`,
        description: 'Live list of traffic incidents, construction and closures on Tennessee highways, by event type and TDOT region.',
        template: 'full-width',
      }),
    );

    return [{ element: main, path: '/live-traffic', report: { title } }];
  },
};
