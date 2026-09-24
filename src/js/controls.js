// Small form-control factory used to build the settings panel.

import { formatHotkey } from './hotkeys.js';

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function wrap(labelText, control, hint) {
  const field = el('div', 'field');
  if (labelText) {
    const label = el('label', 'field-label', labelText);
    const id = `control-${Math.random().toString(36).slice(2, 10)}`;
    label.htmlFor = id;
    control.id = id;
    control.setAttribute('aria-label', labelText);
    field.appendChild(label);
  }
  field.appendChild(control);
  if (hint) field.appendChild(el('span', 'field-hint', hint));
  return field;
}

export function group(title, fields, options = {}) {
  const box = el('section', 'field-group');
  if (title) box.appendChild(el('h4', 'field-group-title', title));
  if (options.note) box.appendChild(el('p', 'field-group-note', options.note));
  const grid = el('div', `field-grid${options.columns ? ` cols-${options.columns}` : ''}`);
  for (const f of fields) if (f) grid.appendChild(f);
  box.appendChild(grid);
  return box;
}

export function selectField(labelText, value, options, onChange, hint) {
  const select = el('select', 'input input-select');
  const groups = new Map();
  for (const opt of options) {
    const target = opt.group ? (groups.get(opt.group) || (() => {
      const g = document.createElement('optgroup');
      g.label = opt.group;
      groups.set(opt.group, g);
      select.appendChild(g);
      return g;
    })()) : select;
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.label;
    target.appendChild(o);
  }
  select.value = value;
  select.addEventListener('change', () => onChange(select.value));
  return wrap(labelText, select, hint);
}

export function numberField(labelText, value, { min, max, step = 1, suffix } = {}, onChange, hint) {
  const shell = el('div', 'input-shell');
  const input = el('input', 'input input-number');
  input.type = 'number';
  if (min != null) input.min = String(min);
  if (max != null) input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener('change', () => {
    let v = Number.parseFloat(input.value);
    if (!Number.isFinite(v)) v = value;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    input.value = String(v);
    onChange(v);
  });
  shell.appendChild(input);
  if (suffix) shell.appendChild(el('span', 'input-suffix', suffix));
  return wrap(labelText, shell, hint);
}

export function rangeField(labelText, value, { min = 0, max = 100, step = 1, suffix = '' } = {}, onChange, hint) {
  const shell = el('div', 'input-range');
  const input = el('input', 'input-slider');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  const out = el('span', 'range-value', `${value}${suffix}`);
  input.addEventListener('input', () => {
    out.textContent = `${input.value}${suffix}`;
    onChange(Number.parseFloat(input.value));
  });
  shell.append(input, out);
  return wrap(labelText, shell, hint);
}

export function colorField(labelText, value, onChange, hint) {
  const shell = el('div', 'input-color');
  const input = el('input', 'color-swatch');
  input.type = 'color';
  input.value = value;
  const code = el('span', 'color-code', value.toUpperCase());
  input.addEventListener('input', () => {
    code.textContent = input.value.toUpperCase();
    onChange(input.value);
  });
  shell.append(input, code);
  return wrap(labelText, shell, hint);
}

export function toggleField(labelText, value, onChange, hint) {
  const button = el('button', 'switch');
  button.type = 'button';
  button.setAttribute('role', 'switch');
  const knob = el('span', 'switch-knob');
  const text = el('span', 'switch-text');
  button.append(knob, text);
  const paint = (v) => {
    button.setAttribute('aria-checked', String(v));
    button.dataset.on = v ? 'true' : 'false';
    text.textContent = v ? 'Activado' : 'Desactivado';
  };
  paint(value);
  let current = value;
  button.addEventListener('click', () => {
    current = !current;
    paint(current);
    onChange(current);
  });
  return wrap(labelText, button, hint);
}

export function textField(labelText, value, { maxlength, placeholder } = {}, onChange, hint) {
  const input = el('input', 'input input-text');
  input.type = 'text';
  input.value = value ?? '';
  if (maxlength) input.maxLength = maxlength;
  if (placeholder) input.placeholder = placeholder;
  input.addEventListener('input', () => onChange(input.value));
  return wrap(labelText, input, hint);
}

export function hotkeyField(labelText, target, value, hint) {
  const picker = el('button', 'hotkey-picker');
  picker.type = 'button';
  picker.dataset.target = target;
  picker.dataset.current = value || '';
  picker.appendChild(el('span', 'hotkey-value', formatHotkey(value) || 'Sin asignar'));
  return wrap(labelText, picker, hint);
}

export function buttonRow(buttons) {
  const row = el('div', 'button-row');
  for (const b of buttons) {
    const button = el('button', `chip-button${b.variant ? ` ${b.variant}` : ''}`, b.label);
    button.type = 'button';
    if (b.title) button.title = b.title;
    button.addEventListener('click', b.onClick);
    row.appendChild(button);
  }
  return row;
}
