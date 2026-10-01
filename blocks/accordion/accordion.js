/**
 * accordion block
 * Based on USWDS usa-accordion component
 *
 * Authoring: one row per item – title | content (any default content).
 * Variants: "multiselectable" (several items open at once), "open" (first item open).
 * Item titles are headings one level below the heading before the block (h2 by default).
 *
 * @see https://designsystem.digital.gov/components/accordion/
 */

let idCounter = 0;

/** Heading level for the item titles: one below the last heading before the block. */
function titleLevel(block) {
  const headings = [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5')];
  // headings in document order: the last one that precedes the block
  const range = document.createRange();
  range.selectNode(block);
  const before = headings.filter((h) => range.comparePoint(h, 0) < 0);
  const last = before[before.length - 1];
  return last ? Math.min(Number(last.tagName[1]) + 1, 6) : 2;
}

export default function decorate(block) {
  const multi = block.classList.contains('multiselectable');
  const level = titleLevel(block);
  const accordion = document.createElement('div');
  accordion.className = 'usa-accordion';
  if (multi) accordion.dataset.allowMultiple = '';

  const buttons = [];
  [...block.children].forEach((row) => {
    const [titleCell, contentCell] = row.children;
    if (!titleCell || !titleCell.textContent.trim()) return;
    idCounter += 1;
    const id = `accordion-${idCounter}`;

    const heading = document.createElement(`h${level}`);
    heading.className = 'usa-accordion__heading';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'usa-accordion__button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', id);
    button.textContent = titleCell.textContent.trim();
    heading.append(button);

    const content = document.createElement('div');
    content.id = id;
    content.className = 'usa-accordion__content usa-prose';
    content.hidden = true;
    if (contentCell) content.append(...contentCell.childNodes);

    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      if (open && !multi) {
        buttons.filter((b) => b !== button).forEach((b) => {
          b.setAttribute('aria-expanded', 'false');
          document.getElementById(b.getAttribute('aria-controls')).hidden = true;
        });
      }
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      content.hidden = !open;
    });
    buttons.push(button);
    accordion.append(heading, content);
  });

  if (block.classList.contains('open') && buttons[0]) buttons[0].click();
  block.replaceChildren(accordion);
}
