/**
 * table block
 * Based on USWDS usa-table component
 *
 * Authoring: one row per table row; the first row holds the column headings.
 * Variants: "no-header" (first row is data), "striped", "borderless", "compact",
 * "scrollable" (scrolls sideways instead of stacking on small screens).
 * By default rows stack on small screens, each cell labeled with its column heading.
 *
 * @see https://designsystem.digital.gov/components/table/
 */

const VARIANTS = ['striped', 'borderless', 'compact'];

export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;
  const hasHeader = !block.classList.contains('no-header');
  const scrollable = block.classList.contains('scrollable');

  const table = document.createElement('table');
  table.className = 'usa-table';
  VARIANTS.forEach((v) => { if (block.classList.contains(v)) table.classList.add(`usa-table--${v}`); });
  if (!scrollable) table.classList.add('usa-table--stacked');

  const labels = [];
  if (hasHeader) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    [...rows.shift().children].forEach((cell) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.append(...cell.childNodes);
      labels.push(th.textContent.trim());
      tr.append(th);
    });
    thead.append(tr);
    table.append(thead);
  }

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    [...row.children].forEach((cell, i) => {
      const td = document.createElement('td');
      if (labels[i]) td.dataset.label = labels[i];
      td.append(...cell.childNodes);
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);

  // a link alone in a cell is decorated as a button (decorateButtons); in a table it is a link
  table.querySelectorAll('a.usa-button').forEach((a) => a.removeAttribute('class'));
  table.querySelectorAll('.button-container').forEach((c) => c.classList.remove('button-container'));

  if (scrollable) {
    const container = document.createElement('div');
    container.className = 'usa-table-container--scrollable';
    container.tabIndex = 0;
    container.append(table);
    block.replaceChildren(container);
  } else {
    block.replaceChildren(table);
  }
}
