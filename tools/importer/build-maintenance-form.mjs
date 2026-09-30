/**
 * Converts the TDOT Maintenance Request Formstack definition (form 3533382, captured
 * from https://stateoftennessee.formstack.com/forms/js.php/maintenance into
 * migration-work/maintenance-request/fs-form.json) into the Form block rows used by
 * import-maintenance-request.js: tools/importer/maintenance-request-form.json.
 *
 * Run: node tools/importer/build-maintenance-form.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SRC = path.join(ROOT, 'migration-work/maintenance-request/fs-form.json');
const OUT = path.join(ROOT, 'tools/importer/maintenance-request-form.json');

// Formstack field id -> Form block field name (Show If conditions use these names)
const NAMES = {
  151097429: 'emergency',
  151097435: 'call-911',
  151097439: 'hazard',
  151097443: 'call-847',
  151097423: 'notice',
  80539720: 'contact-heading',
  80540615: 'name',
  80540717: 'phone',
  80540814: 'email',
  82528207: 'requestor-type',
  81170798: 'request-type',
  81174809: 'request-other',
  80541544: 'location-heading',
  80606798: 'county',
  80541630: 'route-type',
  80547519: 'route-name',
  80541794: 'mile-marker',
  80541935: 'log-mile',
  80547280: 'location-description',
  80542130: 'direction',
  80543947: 'multi-lane',
  80544013: 'lane',
  80544141: 'comments',
  88063483: 'claim-note',
  82475527: 'follow-up',
  82475686: 'contact-method',
};

const TYPES = {
  radio: 'radio',
  checkbox: 'checkbox',
  select: 'select',
  textarea: 'textarea',
  text: 'text',
  number: 'number',
  phone: 'tel',
  email: 'email',
  name: 'name',
};

/** Formstack rich text -> plain semantic HTML (strong, em, links; no inline styles). */
function cleanRichText(html) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(span|div|u)[^>]*>/gi, '')
    .replace(/<p[^>]*>/gi, '<p>')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>/gi, '<a href="$1">')
    .replace(/\s+/g, ' ')
    .replace(/<p>\s+/g, '<p>')
    .replace(/\s+<\/p>/g, '</p>')
    .trim();
}

function richType(html) {
  if (/font-size:\s*18px/.test(html)) return 'callout';
  if (/<strong>/.test(html) && !/<a /.test(html) && html.replace(/<[^>]+>/g, '').trim().length < 40) return 'heading';
  return 'note';
}

const form = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const rows = [];
form.sections[0].fields.forEach((field) => {
  const g = field.general;
  const a = field.fieldTypeAttributes || {};
  const name = NAMES[g.id];
  if (!name) throw new Error(`No name mapped for Formstack field ${g.id} (${g.label})`);
  const showIf = (field.logic && field.logic.action === 'Show' ? field.logic.fields : [])
    .map((c) => `${NAMES[c.fieldId]} ${c.comparisonOperator === '!=' ? '!=' : '='} ${c.value}`)
    .join('; ');
  const style = [];
  if (String(g.columnSpan) === '1') style.push('half');
  if (a.optionLayout === 'horizontal') style.push('inline');
  if (g.type === 'textarea' && a.rowCount > 5) style.push('tall');

  if (g.type === 'richtext') {
    let html = cleanRichText(a.content);
    const type = richType(a.content);
    if (type === 'heading') html = html.replace(/<\/?strong>/g, '');
    rows.push({ type, name, label: html, showIf });
    return;
  }
  const type = TYPES[g.type];
  if (!type) throw new Error(`Unsupported Formstack type ${g.type} (${g.label})`);
  let options = (g.options || []).filter((o) => o.label !== '' || o.value !== '');
  if (type === 'name') {
    options = [{ label: 'First Name' }, { label: 'Last Name' }];
  }
  rows.push({
    type,
    name,
    label: g.label,
    options: options.map((o) => (o.value !== undefined && o.value !== o.label && a.useLabelsAndValues
      ? `${o.label} = ${String(o.value).trim()}` : o.label)),
    required: !!g.required,
    showIf,
    style: style.join(' '),
  });
  if (type === 'email' && a.useConfirmation) {
    rows.push({
      type: 'confirm',
      name: `${name}-confirm`,
      label: `Confirm ${g.label}`,
      options: [name],
      required: false,
      showIf,
      style: style.length ? 'half-right' : '',
    });
  }
});
rows.push({ type: 'submit', name: 'submit', label: form.meta?.submitButtonTitle || 'Submit Form' });

fs.writeFileSync(OUT, `${JSON.stringify({ source: `Formstack form ${form.id}`, rows }, null, 2)}\n`);
console.log(`Wrote ${rows.length} rows to ${path.relative(ROOT, OUT)}`);
