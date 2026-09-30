/**
 * form block
 *
 * EDS enhancement: builds a USWDS form (usa-form) from an authored definition table.
 * The first row names the columns; each following row is one field:
 *
 * | Type | Name | Label | Options | Required | Show If | Style |
 *
 * Types
 *   text, email, tel, number, textarea  inputs (Style "tall" = taller textarea)
 *   select                               drop-down; Options = one option per list item
 *   radio, checkbox                      option group; Style "inline" = options side by side
 *   name                                 first/last pair; Options = the two sub-labels
 *   confirm                              must equal another field; Options = that field's Name
 *   heading, note, callout               rich text from the Label cell (callout = large text)
 *   submit                               submit button; Label = button text
 *   action                               where answers are sent (URL in the Label cell);
 *                                        JSON POST of { data: { name: value } }
 *   success, error                       messages shown after sending / when sending fails
 *   captcha                              Google reCAPTCHA v2 Invisible; site key in the Label
 *                                        cell. The token is sent as data["g-recaptcha-response"]
 *                                        (the receiving endpoint verifies it with the secret key).
 *                                        A captcha row without a key blocks sending.
 * Options: "Label = value" stores a value different from the visible label.
 * Show If: "name = value" conditions joined with ";" (all must match; "!=" negates).
 * Style: "half" = half width from 600px ("half-right" = right column).
 * Fields hidden by Show If are disabled, so they are neither validated nor sent.
 */

import { loadScript, toClassName } from '../../scripts/aem.js';

const RECAPTCHA_API = 'https://www.google.com/recaptcha/api.js';
let recaptchaReady;

/** Loads the reCAPTCHA API once per page (explicit rendering). */
function loadRecaptcha() {
  if (!recaptchaReady) {
    recaptchaReady = new Promise((resolve, reject) => {
      const callback = `formRecaptchaLoaded${Math.random().toString(36).slice(2, 8)}`;
      window[callback] = () => {
        delete window[callback];
        resolve(window.grecaptcha);
      };
      loadScript(`${RECAPTCHA_API}?onload=${callback}&render=explicit`).catch((err) => {
        recaptchaReady = null;
        reject(err);
      });
    });
  }
  return recaptchaReady;
}

/**
 * Invisible reCAPTCHA v2 bound to a container: the API loads on first use of the form,
 * execute() resolves with a one-time token (Google shows a challenge only when needed).
 * The badge renders inline in the container (keeps the page corners free).
 */
function createRecaptcha(container, sitekey) {
  let widgetId = null;
  let pending = null;
  // reCAPTCHA can fail before anyone submits (e.g. network or key problems right after
  // rendering); remember it so the next submit reports it instead of waiting forever
  let failure = null;
  const settle = (fn, value) => {
    if (pending) pending[fn](value);
    else if (fn === 'reject') failure = value;
    pending = null;
  };
  const ready = async () => {
    const grecaptcha = await loadRecaptcha();
    if (widgetId === null) {
      widgetId = grecaptcha.render(container, {
        sitekey,
        size: 'invisible',
        badge: 'inline',
        callback: (token) => settle('resolve', token),
        'expired-callback': () => settle('reject', new Error('reCAPTCHA expired')),
        'error-callback': () => settle('reject', new Error('reCAPTCHA error')),
      });
    }
    return grecaptcha;
  };
  return {
    ready,
    async execute() {
      const grecaptcha = await ready();
      if (failure) {
        const err = failure;
        failure = null;
        grecaptcha.reset(widgetId); // next attempt starts fresh
        throw err;
      }
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        grecaptcha.execute(widgetId);
      });
    },
    reset() {
      if (widgetId !== null && window.grecaptcha) window.grecaptcha.reset(widgetId);
    },
  };
}

const text = (cell) => (cell ? cell.textContent.replace(/\s+/g, ' ').trim() : '');

/** Options from a cell: list items, else paragraphs, else comma-separated text. */
function readOptions(cell) {
  if (!cell) return [];
  let items = [...cell.querySelectorAll('li')].map(text);
  if (!items.length) items = [...cell.querySelectorAll('p')].map(text);
  if (!items.length && text(cell)) items = text(cell).split(',').map((s) => s.trim());
  return items.filter(Boolean).map((item) => {
    const i = item.lastIndexOf(' = ');
    return i > 0
      ? { label: item.slice(0, i).trim(), value: item.slice(i + 3).trim() }
      : { label: item, value: item };
  });
}

/** "a = Yes; b != No" -> [{ name: 'a', op: '=', value: 'Yes' }, ...] */
function readConditions(value) {
  return value.split(/\s*;\s*/).filter(Boolean).map((part) => {
    const m = part.match(/^(.+?)\s*(!?=)\s*(.*)$/);
    return m ? { name: toClassName(m[1]), op: m[2], value: m[3].trim() } : null;
  }).filter(Boolean);
}

function readRows(block) {
  const [headerRow, ...rows] = [...block.children];
  const keys = [...headerRow.children].map((c) => toClassName(text(c)));
  return rows.map((row) => {
    const cells = {};
    [...row.children].forEach((cell, i) => { cells[keys[i]] = cell; });
    return {
      type: toClassName(text(cells.type)),
      name: toClassName(text(cells.name)),
      labelCell: cells.label,
      label: text(cells.label),
      optionsCell: cells.options,
      required: /^(true|yes|x)$/i.test(text(cells.required)),
      showIf: readConditions(text(cells['show-if'])),
      style: text(cells.style).toLowerCase().split(/[\s,]+/).filter(Boolean),
    };
  });
}

function requiredMarker() {
  const marker = document.createElement('abbr');
  marker.className = 'usa-hint usa-hint--required';
  marker.title = 'required';
  marker.textContent = '*';
  return marker;
}

function fieldLabel(tag, def, forId) {
  const label = document.createElement(tag);
  label.className = tag === 'legend' ? 'usa-legend' : 'usa-label';
  if (forId) label.htmlFor = forId;
  label.append(def.label);
  if (def.required) label.append(requiredMarker());
  return label;
}

function control(def, tag, id) {
  const el = document.createElement(tag);
  el.id = id;
  el.name = def.name;
  if (def.required) el.required = true;
  return el;
}

function buildInput(def, wrapper) {
  const id = `form-${def.name}`;
  let el;
  if (def.type === 'textarea') {
    el = control(def, 'textarea', id);
    el.className = 'usa-textarea';
  } else if (def.type === 'select') {
    el = control(def, 'select', id);
    el.className = 'usa-select';
    el.add(new Option('', ''));
    readOptions(def.optionsCell).forEach((o) => {
      const option = new Option(o.label, o.value);
      el.add(option);
    });
  } else {
    el = control(def, 'input', id);
    el.className = 'usa-input';
    el.type = def.type === 'confirm' ? 'text' : def.type;
    if (def.type === 'email') el.autocomplete = 'email';
    if (def.type === 'tel') el.autocomplete = 'tel';
    if (def.type === 'number') el.step = 'any';
    if (def.type === 'confirm') {
      el.dataset.confirm = toClassName(text(def.optionsCell));
      el.autocomplete = 'off';
    }
  }
  wrapper.append(fieldLabel('label', def, id), el);
}

function buildName(def, wrapper) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'usa-fieldset form-name';
  fieldset.append(fieldLabel('legend', def));
  const parts = readOptions(def.optionsCell);
  [['first', 'given-name'], ['last', 'family-name']].forEach(([part, autocomplete], i) => {
    const id = `form-${def.name}-${part}`;
    const col = document.createElement('div');
    col.className = 'form-name-part';
    const input = control({ ...def, name: `${def.name}-${part}` }, 'input', id);
    input.className = 'usa-input';
    input.type = 'text';
    input.autocomplete = autocomplete;
    const sub = document.createElement('label');
    sub.className = 'form-sublabel';
    sub.htmlFor = id;
    sub.textContent = parts[i] ? parts[i].label : part;
    col.append(input, sub);
    fieldset.append(col);
  });
  wrapper.append(fieldset);
}

function buildOptions(def, wrapper) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'usa-fieldset form-options';
  fieldset.append(fieldLabel('legend', def));
  const list = document.createElement('div');
  list.className = 'form-option-list';
  readOptions(def.optionsCell).forEach((o, i) => {
    const id = `form-${def.name}-${i + 1}`;
    const option = document.createElement('div');
    option.className = 'form-option';
    const input = control(def, 'input', id);
    input.type = def.type;
    input.value = o.value;
    if (def.type === 'checkbox') input.required = false;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = o.label;
    option.append(input, label);
    list.append(option);
  });
  fieldset.append(list);
  wrapper.append(fieldset);
}

function buildRichText(def, wrapper) {
  wrapper.classList.add(`form-${def.type}`);
  wrapper.append(...def.labelCell.childNodes);
}

/** Current value of a named field as a list (empty when hidden/disabled). */
function valuesOf(form, name) {
  return [...form.querySelectorAll(`[name="${name}"]`)]
    .filter((el) => !el.disabled && (!/^(radio|checkbox)$/.test(el.type) || el.checked))
    .flatMap((el) => {
      if (el.tagName === 'SELECT' && el.selectedIndex > 0) {
        return [el.value, el.options[el.selectedIndex].text];
      }
      return [el.value];
    })
    .filter(Boolean);
}

function updateVisibility(form) {
  // two passes so conditions on conditional fields settle
  [0, 1].forEach(() => {
    form.querySelectorAll('.form-field[data-show-if]').forEach((wrapper) => {
      const conditions = JSON.parse(wrapper.dataset.showIf);
      const show = conditions.every(({ name, op, value }) => {
        const matches = valuesOf(form, name).includes(value);
        return op === '=' ? matches : !matches;
      });
      wrapper.hidden = !show;
      wrapper.querySelectorAll('input, select, textarea').forEach((el) => { el.disabled = !show; });
    });
  });
}

function clearError(wrapper) {
  wrapper.classList.remove('usa-form-group--error');
  wrapper.querySelectorAll('.usa-input--error').forEach((el) => el.classList.remove('usa-input--error'));
  wrapper.querySelectorAll('.usa-error-message').forEach((el) => el.remove());
}

function showError(wrapper, el, message) {
  wrapper.classList.add('usa-form-group--error');
  if (!/^(radio|checkbox)$/.test(el.type)) el.classList.add('usa-input--error');
  if (wrapper.querySelector('.usa-error-message')) return;
  const msg = document.createElement('span');
  msg.className = 'usa-error-message';
  msg.id = `${el.id}-error`;
  msg.textContent = message;
  el.setAttribute('aria-describedby', msg.id);
  const legendOrLabel = wrapper.querySelector('.usa-legend, .usa-label');
  legendOrLabel.after(msg);
}

/** Validates enabled fields; marks errors and returns the first invalid control. */
function validate(form) {
  let first = null;
  form.querySelectorAll('.form-field').forEach((wrapper) => {
    clearError(wrapper);
    if (wrapper.hidden) return;
    wrapper.querySelectorAll('input, select, textarea').forEach((el) => {
      if (el.disabled) return;
      el.setCustomValidity('');
      if (el.dataset.confirm) {
        const target = form.querySelector(`[name="${el.dataset.confirm}"]`);
        if (target && target.value !== el.value) {
          const targetLabel = form.querySelector(`label[for="${target.id}"]`);
          const ownLabel = wrapper.querySelector('.usa-label');
          const clean = (label) => text(label).replace(/\s*\*$/, '');
          el.setCustomValidity(`${clean(ownLabel)} must match ${clean(targetLabel)}.`);
        }
      }
      if (!el.checkValidity()) {
        showError(wrapper, el, el.validationMessage);
        first = first || el;
      }
    });
  });
  return first;
}

function collect(form) {
  const data = {};
  form.querySelectorAll('input, select, textarea').forEach((el) => {
    if (el.disabled || !el.name || el.dataset.confirm) return;
    if (/^(radio|checkbox)$/.test(el.type) && !el.checked) return;
    if (el.type === 'checkbox') {
      data[el.name] = [...(data[el.name] || []), el.value];
      return;
    }
    data[el.name] = el.value;
    if (el.tagName === 'SELECT' && el.selectedIndex > 0) {
      const label = el.options[el.selectedIndex].text;
      if (label !== el.value) data[`${el.name}-label`] = label;
    }
  });
  return data;
}

function showMessage(form, message, type) {
  form.querySelectorAll('.form-message').forEach((el) => el.remove());
  if (!message) return null;
  const box = document.createElement('div');
  box.className = `usa-alert usa-alert--${type} usa-alert--slim form-message`;
  box.setAttribute('role', type === 'error' ? 'alert' : 'status');
  box.tabIndex = -1;
  const body = document.createElement('div');
  body.className = 'usa-alert__body';
  body.append(message.cloneNode(true));
  box.append(body);
  return box;
}

export default function decorate(block) {
  if (block.children.length < 2) return;
  const defs = readRows(block);
  const form = document.createElement('form');
  form.className = 'usa-form form-definition';
  form.noValidate = true;
  const fields = document.createElement('div');
  fields.className = 'form-fields';
  form.append(fields);

  let action = '';
  let captchaKey = null;
  const messages = {};
  defs.forEach((def) => {
    if (def.type === 'action') {
      const link = def.labelCell && def.labelCell.querySelector('a[href]');
      action = link ? link.href : def.label;
      return;
    }
    if (def.type === 'captcha') {
      captchaKey = def.label;
      return;
    }
    if (def.type === 'success' || def.type === 'error') {
      const msg = document.createElement('div');
      msg.className = 'usa-alert__text';
      msg.append(...def.labelCell.childNodes);
      messages[def.type] = msg;
      return;
    }
    const wrapper = document.createElement('div');
    wrapper.className = `form-field usa-form-group form-field-${def.type}`;
    def.style.forEach((s) => wrapper.classList.add(`form-field-${s}`));
    if (def.showIf.length) wrapper.dataset.showIf = JSON.stringify(def.showIf);

    if (def.type === 'submit') {
      const button = document.createElement('button');
      button.type = 'submit';
      button.className = 'usa-button';
      button.textContent = def.label;
      wrapper.append(button);
    } else if (['heading', 'note', 'callout'].includes(def.type)) {
      buildRichText(def, wrapper);
    } else if (def.type === 'name') {
      buildName(def, wrapper);
    } else if (def.type === 'radio' || def.type === 'checkbox') {
      buildOptions(def, wrapper);
    } else {
      buildInput(def, wrapper);
    }
    fields.append(wrapper);
  });

  let recaptcha = null;
  if (captchaKey) {
    const container = document.createElement('div');
    container.className = 'form-captcha';
    form.append(container);
    recaptcha = createRecaptcha(container, captchaKey);
    // load the reCAPTCHA API only once someone starts using the form
    form.addEventListener('focusin', () => recaptcha.ready().catch(() => {}), { once: true });
  }

  form.addEventListener('change', () => updateVisibility(form));
  form.addEventListener('input', (e) => {
    updateVisibility(form);
    const wrapper = e.target.closest('.form-field');
    if (wrapper && wrapper.classList.contains('usa-form-group--error')) clearError(wrapper);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    updateVisibility(form);
    const invalid = validate(form);
    if (invalid) {
      invalid.focus();
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    const submitWrapper = button ? button.closest('.form-field') : fields.lastElementChild;
    try {
      if (!action || !/^https?:|^\//.test(action)) throw new Error('form action not configured');
      if (captchaKey === '') throw new Error('reCAPTCHA site key not configured');
      const data = collect(form);
      // the button stays enabled until a token arrives: closing a challenge must not lock the form
      if (recaptcha) data['g-recaptcha-response'] = await recaptcha.execute();
      if (button) button.disabled = true;
      const resp = await fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (!resp.ok) throw new Error(`form submission failed: ${resp.status}`);
      const done = showMessage(form, messages.success, 'success');
      if (done) {
        form.replaceWith(done);
        done.focus();
      } else {
        form.reset();
        updateVisibility(form);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      const box = showMessage(form, messages.error, 'error');
      if (box) {
        submitWrapper.before(box);
        box.focus();
      }
      if (button) button.disabled = false;
    } finally {
      // tokens are single-use
      if (recaptcha) recaptcha.reset();
    }
  });

  updateVisibility(form);
  block.textContent = '';
  block.append(form);
}
