/* eslint-disable */
/* global WebImporter */
/**
 * Parser for alert-slim. Base: alert (existing USWDS block, classes info/slim/no-icon).
 * Source: https://www.tn.gov/tdot.html  Generated: 2026-09-29
 *
 * Emits DA table "Alert (info, slim, no-icon)" with ONE row / ONE cell holding the
 * announcement paragraph(s). blocks/alert/alert.js reads `:scope > div > div` children
 * (p/ul/ol become usa-alert__text); slim has no heading.
 *
 * Selectors validated against migration-work/block-context/alert-slim/source.html:
 *   .tn-rte p (announcement), .bgimg > img (decorative lime background - excluded),
 *   trailing empty <a title="more"> (duplicate, empty - removed)
 */
export default function parse(element, { document }) {
  const rte = element.querySelector('.tn-rte') || element;

  // Content nodes: paragraphs / lists inside the rich-text container
  let nodes = [...rte.querySelectorAll(':scope > p, :scope > ul, :scope > ol')];
  if (!nodes.length) nodes = [...element.querySelectorAll('p')];

  nodes = nodes.filter((n) => n.textContent.replace(/ /g, ' ').trim());

  // Remove empty/duplicate anchors (source has an empty trailing <a> after "Learn more.")
  nodes.forEach((n) => {
    n.querySelectorAll('a').forEach((a) => {
      if (!a.textContent.trim() && !a.querySelector('img')) a.remove();
    });
  });

  if (!nodes.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, {
    // name + variants => header exactly "Alert (info, slim, no-icon)"
    // (computeBlockName would title-case variants passed inside `name`)
    name: 'Alert',
    variants: ['info', 'slim', 'no-icon'],
    cells: [[nodes]],
  });
  element.replaceWith(block);
}
