/* eslint-disable */
/* global WebImporter */
/**
 * Parser for columns-links. Base: columns (existing block, variant class "links").
 * Source: https://www.tn.gov/tdot.html  Generated: 2026-09-29
 *
 * Emits DA table "Columns (links)": ONE row x N cells (4 on source). Each cell:
 *   <p><strong>:icon: Category label</strong></p> + <ul> of links
 *
 * Selectors validated against migration-work/block-context/columns-links/source.html:
 *   .row.parsys_column > .parsys_column (column-1..4) - iteration unit (block-level divs, no anchors)
 *   first .tn-rte per column = label (<strong> with <span class="icon-*"> font icon)
 *   subsequent .tn-rte p > a = links
 *   .bgimg > img = decorative navy background -> EXCLUDED (section style "dark" covers it)
 * Font icons (span.icon-cab etc.) are carried over as EDS icon notation (:cab:).
 */
export default function parse(element, { document }) {
  // Column containers (direct children of the column row)
  let columns = [...element.querySelectorAll('.row.parsys_column > .parsys_column')];
  if (!columns.length) columns = [...element.querySelectorAll('[class*="column-"]')];

  const cells = [];
  columns.forEach((col) => {
    const cell = [];
    const rtes = [...col.querySelectorAll('.tn-rte')];

    // Category label: first strong text (not inside a link)
    const labelSrc = [...col.querySelectorAll('strong')].find((s) => !s.closest('a') && s.textContent.replace(/ /g, ' ').trim());
    const iconSpan = col.querySelector('span[class*="icon-"]');
    if (labelSrc) {
      // Outermost strong holding the label
      let outer = labelSrc;
      while (outer.parentElement && outer.parentElement.tagName === 'STRONG') outer = outer.parentElement;
      const labelText = outer.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      const iconClass = iconSpan && [...iconSpan.classList].find((c) => c.startsWith('icon-'));
      const iconName = iconClass ? iconClass.replace(/^icon-/, '').replace(/-+$/, '') : '';
      strong.textContent = labelText;
      // EDS icon notation (:name:), rendered as an icon by the EDS pipeline
      if (iconName) p.append(`:${iconName}: `);
      p.append(strong);
      cell.push(p);
    }

    // Link list
    const links = [...col.querySelectorAll('a[href]')]
      .filter((a) => a.textContent.replace(/ /g, ' ').trim());
    if (links.length) {
      const ul = document.createElement('ul');
      links.forEach((a) => {
        const li = document.createElement('li');
        a.removeAttribute('title');
        li.append(a);
        ul.append(li);
      });
      cell.push(ul);
    }

    if (cell.length || rtes.length) cells.push(cell);
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, {
    name: 'Columns',
    variants: ['links'],
    cells: [cells],
  });
  element.replaceWith(block);
}
