#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Builds the sample traffic feed sheet (content/data/traffic-feed-sample.json, published as
 * /data/traffic-feed-sample.json) used by the Traffic Feed block on /live-traffic until the
 * live SmartWay feed is connected. Times are relative to the build time, so the sample looks
 * current after each rebuild; it is SAMPLE data, not real traffic.
 *
 *   node tools/importer/build-traffic-sample.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const OUT = path.join(ROOT, 'content/data/traffic-feed-sample.json');
const now = Date.now();
const at = (minutes) => (minutes === null ? '' : new Date(now + minutes * 60000).toISOString().replace(/\.\d+Z$/, 'Z'));

// [type, route, direction, county, region, location, description, lanes,
//  start, end, updated]
// (start / end / updated in minutes from now)
const EVENTS = [
  ['Incident', 'I-40', 'Westbound', 'Davidson', 'Region 3 – Nashville', 'Near MM 210 (I-24 split)', 'Vehicle crash. Expect delays and use caution.', 'Right lane blocked', -35, 60, -5],
  ['Construction', 'I-24', 'Eastbound', 'Rutherford', 'Region 3 – Nashville', 'MM 74 to MM 78', 'Ramp repairs. Nightly lane closures 8 p.m. to 5 a.m.', 'One lane open', -1440 * 6, 1440 * 9, -120],
  ['Closure', 'SR-52', 'Both directions', 'Sumner', 'Region 3 – Nashville', 'At Drakes Creek bridge', 'Bridge replacement. Follow posted detour.', 'All lanes closed', -1440 * 20, 1440 * 40, -300],
  ['Incident', 'I-75', 'Northbound', 'Knox', 'Region 1 – Knoxville', 'Near MM 108 (Merchant Dr)', 'Disabled tractor-trailer on the shoulder.', 'Shoulder blocked', -20, 45, -8],
  ['Construction', 'I-40', 'Eastbound', 'Knox', 'Region 1 – Knoxville', 'MM 383 to MM 386', 'Resurfacing. Daytime lane closures 9 a.m. to 3 p.m.', 'Left lane closed', -1440 * 3, 1440 * 12, -90],
  ['Weather', 'US-441', 'Both directions', 'Sevier', 'Region 1 – Knoxville', 'Newfound Gap Rd', 'Dense fog. Reduce speed and use low beams.', '', -60, 120, -15],
  ['Incident', 'I-24', 'Westbound', 'Hamilton', 'Region 2 – Chattanooga', 'Near MM 180 (US-27)', 'Multi-vehicle crash. Emergency crews on scene.', 'Two lanes blocked', -50, 90, -3],
  ['Construction', 'US-127', 'Northbound', 'Fentress', 'Region 2 – Chattanooga', 'Clarkrange', 'Widening project. Flaggers directing traffic.', 'Alternating one-lane traffic', -1440 * 30, 1440 * 60, -600],
  ['Construction', 'I-40', 'Westbound', 'Madison', 'Region 4 – Jackson', 'MM 80 to MM 83', 'Bridge deck repairs.', 'Right lane closed', -1440 * 2, 1440 * 5, -240],
  ['Closure', 'SR-22', 'Southbound', 'Shelby', 'Region 4 – Jackson', 'At Wolf River', 'Emergency culvert repair. Detour via SR-57.', 'All southbound lanes closed', -180, 600, -45],
];

const data = EVENTS.map(([
  type, route, direction, county, region, location, description, lanes, start, end, updated,
], i) => ({
  id: `sample-${i + 1}`,
  type,
  route,
  direction,
  county,
  region,
  location,
  description,
  lanes,
  start: at(start),
  end: at(end),
  updated: at(updated),
}));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify({
  total: data.length, offset: 0, limit: data.length, data, ':type': 'sheet',
}, null, 2)}\n`);
console.log(`traffic feed sample: ${data.length} events -> ${path.relative(process.cwd(), OUT)}`);
