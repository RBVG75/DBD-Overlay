// Stream info panels: cards made of tracker-backed rows, with optional pages
// that take turns every few seconds.

import { findCharacter, portraitUrl } from './catalog.js';
import { FONT_MAP } from './defaults.js';
import { evaluateFormula, formatDuration, formatNumber } from './stats.js';
import { rgba } from './utils.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function clockText() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** Builds one row and returns its refresh closure. */
function buildItem(item, panel, stats) {
  const row = el('div', 'ip-item');
  row.dataset.emphasis = item.emphasis;
  row.dataset.source = item.source;
  if (item.color) row.style.setProperty('--item-color', item.color);

  const labelText = item.label || defaultLabel(item, stats);
  let labelEl = null;
  if (item.show_label && labelText) {
    labelEl = el('span', 'ip-label', labelText);
    row.appendChild(labelEl);
  }

  const valueEl = el('span', 'ip-value');
  let portraitEl = null;

  if (item.source === 'portrait') {
    portraitEl = document.createElement('img');
    portraitEl.className = 'ip-portrait';
    portraitEl.alt = '';
    portraitEl.style.width = `${item.image_size}px`;
    portraitEl.style.height = `${item.image_size}px`;
    portraitEl.style.borderRadius = `${item.image_radius}px`;
    row.appendChild(portraitEl);
  } else {
    row.appendChild(valueEl);
  }

  let barFill = null;
  let pipsEl = null;

  if (item.source === 'goal') {
    const bar = el('div', 'ip-bar');
    barFill = el('div', 'ip-bar-fill');
    bar.appendChild(barFill);
    row.appendChild(bar);
  }
  if (item.source === 'history') {
    pipsEl = el('div', 'ip-pips');
    row.appendChild(pipsEl);
    valueEl.classList.add('hidden');
  }

  const trackerForControls = item.tracker_id ? stats.get(item.tracker_id) : null;
  if (trackerForControls && ['tracker', 'record', 'record_pair', 'winrate', 'goal', 'history', 'portrait'].includes(item.source)) {
    const inlineControls = el('div', 'ip-inline-controls');
    const addControl = (label, title, handler, variant = '') => {
      const button = el('button', `ip-inline-btn ${variant}`, label);
      button.type = 'button';
      button.title = title;
      button.setAttribute('aria-label', title);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        handler();
      });
      inlineControls.appendChild(button);
    };
    if (trackerForControls.kind === 'winloss') {
      addControl('+V', 'Registrar victoria', () => stats.registerResult(trackerForControls.id, 'win'));
      addControl('+D', 'Registrar derrota', () => stats.registerResult(trackerForControls.id, 'loss'));
      addControl('↶', 'Anular último resultado', () => stats.undo(trackerForControls.id));
    } else if (trackerForControls.kind === 'choice') {
      addControl('<', 'Personaje anterior', () => stats.bump(trackerForControls.id, -1));
      addControl('>', 'Personaje siguiente', () => stats.bump(trackerForControls.id, 1));
    } else if (trackerForControls.kind === 'number') {
      addControl('+', 'Aumentar contador', () => stats.bump(trackerForControls.id, trackerForControls.step));
      addControl('−', 'Disminuir contador', () => stats.bump(trackerForControls.id, -trackerForControls.step));
      addControl('0', 'Reiniciar contador', () => stats.reset(trackerForControls.id), 'reset');
    }
    if (inlineControls.childElementCount) row.appendChild(inlineControls);
  }

  let lastValue = null;
  let lastPips = '';

  function refresh() {
    const tracker = item.tracker_id ? stats.get(item.tracker_id) : null;
    let text = '';

    switch (item.source) {
      case 'tracker':
        if (!tracker) text = '—';
        else if (tracker.kind === 'text') text = tracker.text || '—';
        else if (tracker.kind === 'choice') {
          const entry = findCharacter(tracker.catalog, tracker.choice_id);
          text = entry ? entry.name : '—';
        } else if (tracker.kind === 'winloss') text = `${tracker.wins}-${tracker.losses}`;
        else text = formatNumber(tracker.value, item.decimals);
        break;
      case 'record':
        text = tracker ? formatNumber(tracker.record, item.decimals) : '—';
        break;
      case 'record_pair': {
        if (!tracker) { text = '—'; break; }
        const current = tracker.kind === 'winloss' ? tracker.wins : tracker.value;
        text = `${formatNumber(current, item.decimals)}`;
        break;
      }
      case 'winrate': {
        if (!tracker || tracker.kind !== 'winloss') { text = '—'; break; }
        const played = tracker.wins + tracker.losses + tracker.draws;
        text = played ? formatNumber((tracker.wins / played) * 100, item.decimals) : formatNumber(0, item.decimals);
        break;
      }
      case 'formula': {
        const result = evaluateFormula(item.formula, stats.values());
        text = result === null ? '—' : formatNumber(result, item.decimals);
        break;
      }
      case 'goal': {
        const current = tracker ? (tracker.kind === 'winloss' ? tracker.wins : tracker.value) : 0;
        text = `${formatNumber(current, 0)} / ${item.goal}`;
        if (barFill) barFill.style.width = `${Math.min(100, (current / item.goal) * 100).toFixed(1)}%`;
        break;
      }
      case 'history':
        break;
      case 'session_time':
        text = formatDuration(stats.sessionSeconds);
        break;
      case 'clock':
        text = clockText();
        break;
      case 'text':
        text = item.text || '';
        break;
      default:
        text = '—';
    }

    if (item.source === 'portrait') {
      const url = tracker && tracker.kind === 'choice'
        ? portraitUrl(tracker.catalog, tracker.choice_id)
        : '';
      if (url !== lastValue) {
        lastValue = url;
        portraitEl.src = url;
        portraitEl.classList.toggle('empty', !url);
      }
      return;
    }

    if (item.source === 'history') {
      const history = (tracker && tracker.history ? tracker.history : []).slice(0, item.history_count);
      const key = history.join('');
      if (key !== lastPips) {
        lastPips = key;
        pipsEl.innerHTML = '';
        if (!history.length) pipsEl.appendChild(el('span', 'ip-pip empty'));
        // Newest first in the data, oldest first on screen.
        for (const result of [...history].reverse()) {
          pipsEl.appendChild(el('span', `ip-pip ${result === 'W' ? 'win' : result === 'L' ? 'loss' : 'draw'}`, result));
        }
      }
      return;
    }

    if (item.source === 'record_pair' && tracker) {
      const suffix = ` · récord ${formatNumber(tracker.record, item.decimals)}`;
      const full = `${item.prefix}${text}${item.suffix}${suffix}`;
      if (full !== lastValue) {
        lastValue = full;
        valueEl.innerHTML = '';
        valueEl.append(
          el('span', 'ip-main', `${item.prefix}${text}${item.suffix}`),
          el('span', 'ip-aside', suffix),
        );
      }
      return;
    }

    const full = `${item.prefix}${text}${item.suffix}`;
    if (full !== lastValue) {
      lastValue = full;
      valueEl.textContent = full;
    }
  }

  refresh();
  return { el: row, refresh };
}

function buildControl(control, stats) {
  const tracker = control.tracker_id ? stats.get(control.tracker_id) : null;
  const row = el('div', 'ip-control');
  const label = control.label || (tracker ? tracker.label : 'Contador');
  const title = el('span', 'ip-control-label', label);
  const buttons = el('div', 'ip-control-buttons');
  const down = el('button', 'ip-control-btn down', '-');
  const up = el('button', 'ip-control-btn up', '+');

  down.type = 'button';
  up.type = 'button';
  down.title = `Restar ${control.step}`;
  up.title = `Sumar ${control.step}`;
  down.disabled = !tracker;
  up.disabled = !tracker;
  down.addEventListener('click', (event) => {
    event.stopPropagation();
    if (tracker) stats.bump(control.tracker_id, -control.step);
  });
  up.addEventListener('click', (event) => {
    event.stopPropagation();
    if (tracker) stats.bump(control.tracker_id, control.step);
  });

  buttons.append(down, up);
  row.append(title, buttons);
  return row;
}

function defaultLabel(item, stats) {
  const tracker = item.tracker_id ? stats.get(item.tracker_id) : null;
  switch (item.source) {
    case 'record': return tracker ? `Récord ${tracker.label.toLowerCase()}` : 'Récord';
    case 'winrate': return 'Winrate';
    case 'session_time': return 'En directo';
    case 'clock': return 'Hora';
    case 'history': return 'Últimas';
    case 'goal': return tracker ? tracker.label : 'Objetivo';
    case 'portrait': return '';
    default: return tracker ? tracker.label : '';
  }
}

function buildPanel(panel, stats) {
  const root = el('div', 'info-panel');
  root.dataset.style = panel.style;
  root.dataset.layout = panel.layout;
  root.dataset.transition = panel.transition;
  if (!panel.border) root.dataset.border = 'off';

  root.style.setProperty('--ip-color', panel.color);
  root.style.setProperty('--ip-text', panel.text_color);
  root.style.setProperty('--ip-label', panel.label_color);
  root.style.setProperty('--ip-surface', rgba(panel.backdrop_color, panel.backdrop_opacity / 100));
  root.style.setProperty('--ip-radius', `${panel.corner_radius}px`);
  root.style.setProperty('--ip-glow', `${(panel.glow / 100) * 26}px`);
  root.style.setProperty('--ip-font', FONT_MAP[panel.font_family] || FONT_MAP.sans);
  root.style.setProperty('--ip-title-size', `${panel.title_size}px`);
  root.style.setProperty('--ip-label-size', `${panel.label_size}px`);
  root.style.setProperty('--ip-value-size', `${panel.value_size}px`);
  root.style.setProperty('--ip-case', panel.uppercase_labels ? 'uppercase' : 'none');
  root.style.opacity = String(panel.opacity / 100);
  if (panel.width) root.style.setProperty('--ip-width', `${panel.width}px`);
  if (panel.scale !== 100) root.style.setProperty('--ip-scale', String(panel.scale / 100));

  const stage = el('div', 'ip-stage');
  const refreshers = [];
  const pageEls = [];

  panel.pages.forEach((page, index) => {
    const pageEl = el('div', 'ip-page');
    if (index === 0) pageEl.classList.add('is-active');
    if (panel.show_title && page.title) pageEl.appendChild(el('div', 'ip-title', page.title));
    const items = el('div', 'ip-items');
    // The "media" layout puts portraits in their own column and stacks
    // everything else beside them.
    const media = panel.layout === 'media' ? el('div', 'ip-media') : null;
    for (const item of page.items) {
      const built = buildItem(item, panel, stats);
      (media && item.source === 'portrait' ? media : items).appendChild(built.el);
      refreshers.push(built.refresh);
    }
    if (!page.items.length) items.appendChild(el('div', 'ip-empty', 'Sin datos'));

    if (media && media.childElementCount) {
      const split = el('div', 'ip-split');
      split.dataset.side = panel.media_position;
      split.append(media, items);
      pageEl.appendChild(split);
    } else {
      pageEl.appendChild(items);
    }
    stage.appendChild(pageEl);
    pageEls.push(pageEl);
  });

  root.appendChild(stage);

  if (panel.controls && panel.controls.length) {
    const controls = el('div', 'ip-controls');
    for (const control of panel.controls) controls.appendChild(buildControl(control, stats));
    stage.appendChild(controls);
  }

  let dots = null;
  if (panel.pages.length > 1 && panel.show_page_dots) {
    dots = el('div', 'ip-dots');
    panel.pages.forEach((_, i) => {
      const dot = el('span', 'ip-dot');
      if (i === 0) dot.classList.add('on');
      dots.appendChild(dot);
    });
    root.appendChild(dots);
  }

  return { root, refreshers, pageEls, dots };
}

/** Swaps the visible page of a mounted panel, running the transition classes. */
function activate(inst, index) {
  if (index === inst.page || !inst.pageEls[index]) return;
  const previous = inst.pageEls[inst.page];
  previous.classList.remove('is-active');
  previous.classList.add('is-leaving');
  setTimeout(() => previous.classList.remove('is-leaving'), 420);
  inst.pageEls[index].classList.add('is-active');
  inst.page = index;
  if (inst.dots) {
    [...inst.dots.children].forEach((dot, i) => dot.classList.toggle('on', i === index));
  }
}

/** Mounts a single panel into any container — used by the settings preview. */
export function mountPanel(container, panel, stats, { rotate = true } = {}) {
  container.innerHTML = '';
  const built = buildPanel(panel, stats);
  container.appendChild(built.root);
  const inst = { panel, ...built, page: 0 };

  const ticker = setInterval(() => inst.refreshers.forEach((fn) => fn()), 500);
  let rotation = null;
  if (rotate && panel.pages.length > 1) {
    const every = (panel.rotate_seconds || 4) * 1000;
    rotation = setInterval(() => activate(inst, (inst.page + 1) % panel.pages.length), every);
  }

  return {
    destroy() {
      clearInterval(ticker);
      if (rotation) clearInterval(rotation);
      container.innerHTML = '';
    },
  };
}

export function createPanelLayer({ layer, stats, anchorIds }) {
  const anchors = new Map();
  for (const id of anchorIds) {
    const node = el('div', 'panel-anchor');
    node.dataset.anchor = id;
    layer.appendChild(node);
    anchors.set(id, node);
  }

  let instances = [];
  let ticker = null;

  function clear() {
    for (const inst of instances) {
      if (inst.timer) clearInterval(inst.timer);
      inst.slot.remove();
    }
    instances = [];
    for (const anchor of anchors.values()) anchor.innerHTML = '';
  }

  function setPanels(panels, groups = []) {
    clear();
    const hiddenByGroup = new Set(
      groups.filter((group) => group.visible === false)
        .flatMap((group) => group.panel_ids || []),
    );
    for (const panel of panels) {
      if (!panel.visible || hiddenByGroup.has(panel.id)) continue;
      const anchor = anchors.get(panel.position) || anchors.get('top-left');
      const built = buildPanel(panel, stats);

      const slot = el('div', 'panel-slot');
      const [vertical, horizontal] = panel.position.split('-');
      const dx = horizontal === 'right' ? -panel.offset_x : panel.offset_x;
      const dy = vertical === 'bottom' ? -panel.offset_y : panel.offset_y;
      slot.style.transform = `translate(${dx}px, ${dy}px)`;
      slot.appendChild(built.root);
      anchor.appendChild(slot);

      const inst = { panel, slot, ...built, page: 0, timer: null };

      if (panel.pages.length > 1 && panel.rotate_seconds > 0) {
        inst.timer = setInterval(() => activate(inst, (inst.page + 1) % panel.pages.length), panel.rotate_seconds * 1000);
      }
      instances.push(inst);
    }
    startTicker();
  }

  function nextPageAll() {
    for (const inst of instances) {
      if (inst.panel.pages.length > 1) activate(inst, (inst.page + 1) % inst.panel.pages.length);
    }
  }

  function refresh() {
    for (const inst of instances) for (const fn of inst.refreshers) fn();
  }

  function startTicker() {
    if (ticker) clearInterval(ticker);
    // Half a second keeps the clock and the session time honest without cost.
    ticker = setInterval(refresh, 500);
  }

  return {
    setPanels,
    refresh,
    nextPageAll,
    destroy() {
      clear();
      if (ticker) clearInterval(ticker);
      ticker = null;
    },
    get count() {
      return instances.length;
    },
  };
}
