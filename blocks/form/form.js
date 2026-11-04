/*
 * form: a form authored as rows.
 * Columns: Type | Name | Label | Required | Options | Placeholder | Layout
 * Optional key/value rows: Submit URL | <url>, Success message | <text>, Error message | <text>
 * No reCAPTCHA is wired yet: the submit target must add its own spam protection.
 */

const FIELD_TYPES = ['text', 'email', 'tel', 'url', 'number', 'date', 'textarea', 'select',
  'checkbox-group', 'radio-group', 'checkbox', 'hidden', 'submit', 'reset'];
const TEXT_TYPES = ['text', 'email', 'tel', 'url', 'number', 'date', 'textarea', 'select'];
const SETTINGS = {
  'submit url': 'submitUrl',
  'success message': 'successMessage',
  'error message': 'errorMessage',
};
const MESSAGES = {
  required: 'This is a required field.',
  email: 'Please enter a valid email address (Ex: johndoe@domain.com).',
  number: 'Please enter a valid number in this field.',
  success: 'Thank you for your message. We will get back to you as soon as possible.',
  error: 'Sorry, your message could not be sent. Please try again later.',
  notConfigured: 'This form is not connected to a submission service yet, so your message has not been sent. Please contact us by e-mail or phone instead.',
};

// like the source's validate-email: the domain needs a dot
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let uid = 0;

function toId(name) {
  uid += 1;
  return `form-${String(name || 'field').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${uid}`;
}

function normaliseType(text) {
  const t = (text || '').trim().toLowerCase();
  if (!t) return '';
  // "text (tel)" -> tel, "checkbox group" -> checkbox-group, "consent" -> checkbox
  const inner = t.match(/\(([a-z-]+)\)/);
  if (inner && FIELD_TYPES.includes(inner[1])) return inner[1];
  const dashed = t.replace(/\s+/g, '-');
  if (FIELD_TYPES.includes(dashed)) return dashed;
  const first = t.split(/[\s(]/)[0];
  if (first === 'consent') return 'checkbox';
  if (first === 'phone') return 'tel';
  if (first === 'message' || first === 'multiline') return 'textarea';
  return FIELD_TYPES.includes(first) ? first : '';
}

function isYes(cell) {
  return /^(yes|y|true|x|required|1)$/i.test((cell && cell.textContent.trim()) || '');
}

// one option per paragraph, list item or line break; "CODE | Label" splits value and label
function readOptions(cell) {
  if (!cell) return [];
  let lines;
  const blocks = cell.querySelectorAll('p, li');
  if (blocks.length) lines = [...blocks].map((el) => el.textContent);
  else lines = cell.innerHTML.split(/<br\s*\/?>/i).map((html) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent;
  });
  return lines.map((line) => line.trim()).filter(Boolean).map((line) => {
    const [value, label] = line.split('|').map((s) => s.trim());
    return label === undefined ? { value, label: value } : { value, label: label || value };
  });
}

// label HTML keeps inline links (e.g. Privacy Policy)
function labelHtml(cell) {
  if (!cell) return '';
  const p = cell.querySelector('p');
  return (p && cell.children.length === 1 ? p : cell).innerHTML.trim();
}

function setError(field, message) {
  const error = field.querySelector('.form-error');
  const controls = field.querySelectorAll('input, select, textarea');
  if (message) {
    error.textContent = message;
    error.hidden = false;
    field.classList.add('is-invalid');
    controls.forEach((c) => c.setAttribute('aria-invalid', 'true'));
  } else {
    error.textContent = '';
    error.hidden = true;
    field.classList.remove('is-invalid');
    controls.forEach((c) => c.removeAttribute('aria-invalid'));
  }
}

function validateField(field) {
  const controls = [...field.querySelectorAll('input, select, textarea')];
  if (!controls.length) return true;
  let message = '';
  if (field.dataset.type === 'checkbox-group' || field.dataset.type === 'radio-group') {
    if (field.dataset.required === 'true' && !controls.some((c) => c.checked)) message = MESSAGES.required;
  } else {
    const [c] = controls;
    if (c.validity.valueMissing) message = MESSAGES.required;
    else if (c.type === 'email' && c.value && (c.validity.typeMismatch || !EMAIL.test(c.value))) {
      message = MESSAGES.email;
    }
    else if (c.validity.patternMismatch || c.validity.badInput) message = MESSAGES.number;
  }
  setError(field, message);
  return !message;
}

function buildControl(def) {
  const {
    type, name, id, required, options, placeholder,
  } = def;
  if (type === 'textarea') {
    const ta = document.createElement('textarea');
    ta.rows = 1;
    return ta;
  }
  if (type === 'select') {
    const select = document.createElement('select');
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = placeholder || '--Please Select--';
    select.append(empty);
    options.forEach(({ value, label }) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      select.append(opt);
    });
    return select;
  }
  if (type === 'checkbox-group' || type === 'radio-group') {
    const list = document.createElement('div');
    list.className = 'form-options';
    options.forEach(({ value, label }, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'form-option';
      const input = document.createElement('input');
      input.type = type === 'radio-group' ? 'radio' : 'checkbox';
      input.name = name;
      input.value = value;
      input.id = `${id}-${i}`;
      const lab = document.createElement('label');
      lab.htmlFor = input.id;
      lab.textContent = label;
      wrap.append(input, lab);
      list.append(wrap);
    });
    return list;
  }
  const input = document.createElement('input');
  input.type = type === 'url' ? 'text' : type;
  if (type === 'url') input.inputMode = 'url';
  if (type === 'tel') input.pattern = '[0-9+()\\s./-]*';
  if (type === 'email') input.autocomplete = 'email';
  if (required) input.required = true;
  return input;
}

function buildField(def) {
  const field = document.createElement('div');
  field.className = `form-field form-field-${def.type}`;
  field.dataset.type = def.type;
  if (def.half) field.classList.add('form-field-half');
  if (def.required) {
    field.classList.add('is-required');
    field.dataset.required = 'true';
  }

  const error = document.createElement('div');
  error.className = 'form-error';
  error.id = `${def.id}-error`;
  error.hidden = true;
  error.setAttribute('aria-live', 'polite');

  if (def.type === 'hidden') {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = def.name;
    input.value = def.placeholder || def.label || '';
    return input;
  }

  if (def.type === 'checkbox-group' || def.type === 'radio-group') {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.className = 'form-label';
    legend.innerHTML = def.label;
    fieldset.append(legend, buildControl(def));
    if (def.required) fieldset.setAttribute('aria-required', 'true');
    fieldset.setAttribute('aria-describedby', error.id);
    field.append(fieldset, error);
    return field;
  }

  if (def.type === 'checkbox') {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = def.name;
    input.id = def.id;
    input.value = (def.options[0] && def.options[0].value) || 'yes';
    input.required = def.required;
    input.setAttribute('aria-describedby', error.id);
    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = def.id;
    label.innerHTML = def.label;
    const row = document.createElement('div');
    row.className = 'form-option';
    row.append(input, label);
    field.append(row, error);
    return field;
  }

  const control = buildControl(def);
  control.name = def.name;
  control.id = def.id;
  if (def.required) control.required = true;
  control.setAttribute('aria-describedby', error.id);
  // floating label: a blank placeholder lets CSS tell an empty field from a filled one
  if (control.tagName !== 'SELECT') control.placeholder = def.placeholder || ' ';
  if (def.placeholder || control.tagName === 'SELECT') field.classList.add('has-floated-label');
  const label = document.createElement('label');
  label.className = 'form-label';
  label.htmlFor = def.id;
  label.innerHTML = def.label;
  const wrap = document.createElement('div');
  wrap.className = 'form-control';
  wrap.append(control, label);
  field.append(wrap, error);
  return field;
}

function parseBlock(block) {
  const defs = [];
  const settings = {};
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const first = cells[0] ? cells[0].textContent.trim() : '';
    if (!first) return;
    const settingKey = SETTINGS[first.toLowerCase()];
    if (settingKey) {
      const cell = cells[1];
      const link = cell && cell.querySelector('a[href]');
      settings[settingKey] = link && settingKey === 'submitUrl' ? link.href : (cell && cell.textContent.trim()) || '';
      return;
    }
    const type = normaliseType(first);
    // header row ("Type | Name | Label ...") and unknown types are skipped
    if (!type) return;
    const [, nameCell, labelCell, reqCell, optCell, phCell, layoutCell] = cells;
    const label = labelHtml(labelCell);
    const name = (nameCell && nameCell.textContent.trim())
      || (labelCell && labelCell.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'))
      || type;
    defs.push({
      type,
      name,
      id: toId(name),
      label: label || (labelCell ? labelCell.textContent.trim() : '') || name,
      required: isYes(reqCell),
      options: readOptions(optCell),
      placeholder: phCell ? phCell.textContent.trim() : '',
      half: /half|50|left|right/i.test(layoutCell ? layoutCell.textContent : ''),
    });
  });
  return { defs, settings };
}

function showStatus(form, message, kind) {
  let status = form.querySelector('.form-status');
  if (!status) {
    status = document.createElement('div');
    status.className = 'form-status';
    status.setAttribute('role', 'status');
    status.tabIndex = -1;
    form.append(status);
  }
  status.className = `form-status form-status-${kind}`;
  status.textContent = message;
  status.focus();
}

async function submit(form, settings) {
  const fields = [...form.querySelectorAll('.form-field')];
  const valid = fields.map(validateField).every(Boolean);
  if (!valid) {
    const firstInvalid = form.querySelector('.form-field.is-invalid input, .form-field.is-invalid select, .form-field.is-invalid textarea');
    if (firstInvalid) firstInvalid.focus();
    return;
  }
  if (!settings.submitUrl) {
    showStatus(form, MESSAGES.notConfigured, 'info');
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  form.setAttribute('aria-busy', 'true');
  try {
    // multipart, keeping the source field names (field[197], option[209][] ...) for the relay
    const resp = await fetch(settings.submitUrl, { method: 'POST', body: new FormData(form) });
    if (!resp.ok) throw new Error(`${resp.status}`);
    form.reset();
    showStatus(form, settings.successMessage || MESSAGES.success, 'success');
  } catch (e) {
    showStatus(form, settings.errorMessage || MESSAGES.error, 'error');
  } finally {
    if (button) button.disabled = false;
    form.removeAttribute('aria-busy');
  }
}

export default function decorate(block) {
  const { defs, settings } = parseBlock(block);
  const form = document.createElement('form');
  form.noValidate = true;
  form.className = 'form-form';
  const fields = document.createElement('div');
  fields.className = 'form-fields';
  const actions = document.createElement('div');
  actions.className = 'form-actions';

  defs.forEach((def) => {
    if (def.type === 'submit' || def.type === 'reset') {
      const button = document.createElement('button');
      button.type = def.type;
      button.className = `button ${def.type === 'submit' ? 'primary' : 'secondary'}`;
      button.innerHTML = def.label;
      if (def.name && def.name !== def.type) button.name = def.name;
      actions.append(button);
      return;
    }
    const field = buildField(def);
    if (field.tagName === 'INPUT') form.append(field);
    else fields.append(field);
  });

  if (!actions.querySelector('[type="submit"]')) {
    const button = document.createElement('button');
    button.type = 'submit';
    button.className = 'button primary';
    button.textContent = 'Send';
    actions.prepend(button);
  }

  form.append(fields, actions);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(form, settings);
  });
  form.addEventListener('reset', () => {
    form.querySelectorAll('.form-field').forEach((field) => setError(field, ''));
    const status = form.querySelector('.form-status');
    if (status) status.remove();
  });
  // clear an error as soon as the visitor fixes the field (while typing, not on blur,
  // so the layout does not shift under a click on the next field)
  const recheck = (e) => {
    const field = e.target.closest('.form-field');
    if (field && field.classList.contains('is-invalid')) validateField(field);
  };
  form.addEventListener('input', recheck);
  form.addEventListener('change', recheck);

  block.replaceChildren(form);
}
