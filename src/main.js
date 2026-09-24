// Entry point: loads the configuration, wires every widget together and keeps
// the Rust side in sync.

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import {
  ANCHOR_IDS, DEFAULT_CONFIG, HOTKEY_ACTIONS, THEMES, normalizeConfig,
  normalizePanelInto, normalizeTimer, normalizeTracker,
} from './js/defaults.js';
import { createCrosshair } from './js/crosshair.js';
import { createScoreboard } from './js/scoreboard.js';
import { createSettings } from './js/settings.js';
import { createStopwatch } from './js/stopwatch.js';
import { createPanelLayer } from './js/panels.js';
import { createStatsEngine } from './js/stats.js';
import { createTimerEngine } from './js/timers.js';
import { makeDraggable, positionWidget } from './js/widgets.js';
import { deepClone, rgba } from './js/utils.js';

const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function call(command, args) {
  if (!inTauri) return null;
  try {
    return await invoke(command, args);
  } catch (error) {
    console.warn(`[overlay] ${command} falló`, error);
    return null;
  }
}

function on(event, handler) {
  if (!inTauri) return;
  listen(event, handler).catch((error) => console.warn(`[overlay] listen ${event}`, error));
}

// --- elements ---------------------------------------------------------------

const root = document.documentElement;
const timerLayer = document.getElementById('timer-layer');
const panelLayer = document.getElementById('panel-layer');
const stopwatchEl = document.getElementById('stopwatch');
const scoreboardEl = document.getElementById('scoreboard');
const crosshairEl = document.getElementById('crosshair');
const toolbarEl = document.getElementById('toolbar');
const panelEl = document.getElementById('settings-panel');
const scrimEl = document.getElementById('settings-scrim');
const toastEl = document.getElementById('toast');
const imageInput = document.getElementById('image-input');
const btnLock = document.getElementById('btn-lock');
const btnPointer = document.getElementById('btn-pointer');
const btnEdit = document.getElementById('btn-edit');
const btnSettings = document.getElementById('btn-settings');

let config = deepClone(DEFAULT_CONFIG);
let locked = false;
let settingsOpen = false;
let editMode = false;
let imageCallback = null;

const visibility = { stopwatch: true, scoreboard: true, countdowns: true, panels: true };

// Last geometry reported by Rust, shown in Ajustes → General so the coverage can
// be checked rather than guessed.
let screenFit = null;

/**
 * Asks the backend to stretch the window over the whole monitor rectangle —
 * taskbar strip included, which Windows would otherwise keep for itself.
 */
async function fitOverlay(mode) {
  const result = await call('fit_overlay', { mode: mode || config.interface.screen_mode });
  if (result) {
    screenFit = result;
    if (settingsOpen) settings.render();
  }
  return result;
}

// --- feedback ---------------------------------------------------------------

let toastTimer = null;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 1800);
}

// --- widgets ----------------------------------------------------------------

const engine = createTimerEngine(timerLayer);

const stats = createStatsEngine({
  onChange: () => {
    panels.refresh();
    scheduleAutosave();
  },
  onRecord: (tracker) => toast(`¡Nuevo récord de ${tracker.label}: ${tracker.record}!`),
});

const panels = createPanelLayer({ layer: panelLayer, stats, anchorIds: ANCHOR_IDS });

// Counter values change outside the settings panel, so they are written back on
// their own — debounced, because a hotkey can fire many times in a row.
let autosaveTimer = null;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    persist().catch((error) => console.warn('[overlay] autoguardado', error));
  }, 1500);
}

const stopwatch = createStopwatch({
  root: stopwatchEl,
  onStatusChange: (state) => call('set_status', { status: state }),
});

const scoreboard = createScoreboard({
  root: scoreboardEl,
  onChange: () => {
    /* values live in config.scoreboard already */
  },
});

const crosshair = createCrosshair(crosshairEl);

stopwatchEl.addEventListener('click', (event) => {
  const button = event.target.closest('.sw-btn');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'start') stopwatch.toggle();
  else if (action === 'pause') stopwatch.pause();
  else if (action === 'lap') stopwatch.lap();
  else if (action === 'reset') stopwatch.reset();
});

makeDraggable(stopwatchEl, {
  getState: () => (settingsOpen || locked ? null : config.stopwatch),
  onMove: ({ offset_x, offset_y }) => {
    config.stopwatch.offset_x = offset_x;
    config.stopwatch.offset_y = offset_y;
    positionWidget(stopwatchEl, config.stopwatch.position, offset_x, offset_y);
  },
  onEnd: () => settings.render(),
});

makeDraggable(scoreboardEl, {
  getState: () => (settingsOpen || locked ? null : config.scoreboard),
  onMove: ({ offset_x, offset_y }) => {
    config.scoreboard.offset_x = offset_x;
    config.scoreboard.offset_y = offset_y;
    positionWidget(scoreboardEl, config.scoreboard.position, offset_x, offset_y);
  },
  onEnd: () => settings.render(),
});

// --- applying configuration -------------------------------------------------

function applyInterface(ui) {
  const theme = THEMES.find((t) => t.id === ui.theme);
  const accent = ui.accent_color;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-soft', rgba(accent, 0.28));
  root.style.setProperty('--accent-faint', rgba(accent, 0.12));
  root.style.setProperty('--surface', theme ? theme.surface : '#0a0c12');
  root.style.setProperty('--ui-scale', String(ui.ui_scale / 100));
  root.style.setProperty('--panel-alpha', String(ui.panel_opacity / 100));
  root.dataset.motion = ui.reduce_motion ? 'reduced' : 'full';
  toolbarEl.dataset.position = ui.toolbar_position;
  toolbarEl.classList.toggle('hidden', !ui.show_toolbar);
}

function applyConfig(next) {
  // `config` is handed to the settings panel as a live draft, so it has to keep
  // its identity: replace the contents instead of the reference.
  if (next !== config) {
    for (const key of Object.keys(config)) delete config[key];
    Object.assign(config, next);
  }
  applyInterface(config.interface);

  stopwatch.applyConfig(config.stopwatch);
  positionWidget(stopwatchEl, config.stopwatch.position, config.stopwatch.offset_x, config.stopwatch.offset_y);
  stopwatchEl.classList.toggle('force-hidden', !visibility.stopwatch);

  scoreboard.applyConfig(config.scoreboard);
  positionWidget(scoreboardEl, config.scoreboard.position, config.scoreboard.offset_x, config.scoreboard.offset_y);
  scoreboardEl.classList.toggle('force-hidden', !visibility.scoreboard);

  crosshair.applyConfig(config.crosshair);

  // Normalize in place so the settings editor keeps editing the same objects.
  for (const cd of config.countdowns) Object.assign(cd, normalizeTimer(cd));
  engine.setConfigs(config.countdowns);
  timerLayer.classList.toggle('force-hidden', !visibility.countdowns);

  if (!config.stats) config.stats = { session_reset_hotkey: '', trackers: [], panels: [], groups: [] };
  const takenKeys = [];
  for (const tracker of config.stats.trackers) {
    Object.assign(tracker, normalizeTracker(tracker, takenKeys));
    takenKeys.push(tracker.key);
  }
  for (const panel of config.stats.panels) normalizePanelInto(panel);
  stats.setTrackers(config.stats.trackers);
  panels.setPanels(config.stats.panels, config.stats.groups);
  panelLayer.classList.toggle('force-hidden', !visibility.panels);

  config.custom_hotkeys = buildCustomHotkeys();
}

/**
 * Counter shortcuts are derived from the trackers rather than edited by hand, so
 * Rust can register them without knowing anything about counters.
 */
function buildCustomHotkeys() {
  const list = [];
  const push = (hotkey, action, id) => {
    if (hotkey && hotkey.trim()) list.push({ hotkey, action, id });
  };
  for (const tracker of config.stats.trackers) {
    push(tracker.hotkey_up, tracker.kind === 'winloss' ? 'win' : 'up', tracker.id);
    push(tracker.hotkey_down, tracker.kind === 'winloss' ? 'loss' : 'down', tracker.id);
    push(tracker.hotkey_draw, 'draw', tracker.id);
    push(tracker.hotkey_undo, 'undo', tracker.id);
    push(tracker.hotkey_reset, 'reset', tracker.id);
  }
  for (const panel of config.stats.panels) {
    for (const control of panel.controls || []) {
      const target = `${panel.id}:${control.id}`;
      push(control.hotkey_up, 'panel_up', target);
      push(control.hotkey_down, 'panel_down', target);
    }
  }
  return list;
}

function panelControlTarget(target) {
  const [panelId, controlId] = String(target || '').split(':');
  const panel = config.stats.panels.find((candidate) => candidate.id === panelId);
  const control = panel && (panel.controls || []).find((candidate) => candidate.id === controlId);
  return control && control.tracker_id ? control : null;
}

async function persist() {
  const payload = deepClone(config);
  const result = await call('save_config', { config: payload });
  if (inTauri && result === null) throw new Error('save_config failed');
}

// --- settings ---------------------------------------------------------------

const settings = createSettings({
  panel: panelEl,
  draft: config,
  onApply: (next) => applyConfig(next),
  onSave: async () => {
    await persist();
  },
  onResetDefaults: () => {
    applyConfig(normalizeConfig(deepClone(DEFAULT_CONFIG)));
    settings.render();
    settings.flash('Valores de fábrica restaurados');
  },
  onTest: (index) => engine.trigger(index),
  stats,
  refreshPanels: () => panels.refresh(),
  getScreenFit: () => screenFit,
  onFitScreen: (mode) => fitOverlay(mode),
  pickImage: (cb) => {
    imageCallback = cb;
    imageInput.click();
  },
  onCloseRequest: () => closeSettings(),
});

async function openSettings() {
  if (settingsOpen) return;
  settingsOpen = true;
  await call('disable_clickthrough');
  if (locked) setLocked(false);
  panelEl.classList.remove('hidden');
  scrimEl.classList.remove('hidden');
  settings.render();
}

function closeSettings() {
  if (!settingsOpen) return;
  settingsOpen = false;
  panelEl.classList.add('hidden');
  scrimEl.classList.add('hidden');
  settings.stopPreview();
}

function toggleSettings() {
  if (settingsOpen) closeSettings();
  else openSettings();
}

scrimEl.addEventListener('click', () => closeSettings());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && settingsOpen && !panelEl.querySelector('.hotkey-picker.capturing')) {
    closeSettings();
  }
});

// --- lock / visibility ------------------------------------------------------

function setLocked(value) {
  locked = value;
  if (locked) setEditMode(false);
  btnLock.classList.toggle('active', locked);
  btnLock.title = locked ? 'Desbloquear (volver a interactuar)' : 'Bloquear clics (modo atravesable)';
  document.body.classList.toggle('locked', locked);
  call(locked ? 'enable_clickthrough' : 'disable_clickthrough');
  if (locked) closeSettings();
}

function setEditMode(value) {
  editMode = Boolean(value) && !locked;
  document.body.classList.toggle('edit-mode', editMode);
  btnEdit.classList.toggle('active', editMode);
  btnEdit.title = editMode ? 'Salir de edición directa' : 'Editar datos sobre el overlay';
  btnEdit.setAttribute('aria-pressed', String(editMode));
}

function toggleLock() {
  setLocked(!locked);
  toast(locked ? 'Clics atravesando el overlay' : 'Overlay interactivo');
}

function applyVisibility() {
  stopwatchEl.classList.toggle('force-hidden', !visibility.stopwatch);
  scoreboardEl.classList.toggle('force-hidden', !visibility.scoreboard);
  timerLayer.classList.toggle('force-hidden', !visibility.countdowns);
  panelLayer.classList.toggle('force-hidden', !visibility.panels);
}

function toggleElement(name) {
  visibility[name] = !visibility[name];
  applyVisibility();
}

function toggleEverything() {
  const showAll = !visibility.stopwatch || !visibility.scoreboard || !visibility.countdowns
    || !visibility.panels || !config.crosshair.enabled;
  visibility.stopwatch = showAll;
  visibility.scoreboard = showAll;
  visibility.countdowns = showAll;
  visibility.panels = showAll;
  crosshair.setEnabled(showAll);
  applyVisibility();
}

btnLock.addEventListener('click', toggleLock);
btnEdit.addEventListener('click', () => setEditMode(!editMode));
btnSettings.addEventListener('click', toggleSettings);
btnPointer.addEventListener('click', () => {
  const next = crosshair.cycle();
  config.crosshair.pointer_type = next;
  toast(`Mira: ${next}`);
});

// --- image picking ----------------------------------------------------------

const MAX_IMAGE = 320;

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Formato de imagen no válido'));
    img.src = src;
  });
}

imageInput.addEventListener('change', async () => {
  const cb = imageCallback;
  imageCallback = null;
  const file = imageInput.files && imageInput.files[0];
  imageInput.value = '';
  if (!file || !cb) return;
  if (!file.type.startsWith('image/')) {
    toast('Ese archivo no es una imagen');
    return;
  }
  try {
    const img = await loadImage(await readFile(file));
    const ratio = Math.min(MAX_IMAGE / img.width, MAX_IMAGE / img.height, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * ratio));
    canvas.height = Math.max(1, Math.round(img.height * ratio));
    // PNG keeps transparency, which matters on a see-through overlay.
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    cb(canvas.toDataURL('image/png'));
  } catch (error) {
    console.error(error);
    toast('No se pudo procesar la imagen');
  }
});

// --- global hotkeys ---------------------------------------------------------

const ACTIONS = {
  start: () => stopwatch.toggle(),
  pause: () => stopwatch.pause(),
  reset: () => stopwatch.reset(),
  lap: () => stopwatch.lap(),
  toggle: () => call('toggle_visibility'),
  settings: () => toggleSettings(),
  lock: () => toggleLock(),
  crosshair: () => {
    config.crosshair.enabled = crosshair.toggle();
  },
  stopwatch: () => toggleElement('stopwatch'),
  scoreboard: () => toggleElement('scoreboard'),
  countdowns: () => toggleElement('countdowns'),
  panels: () => toggleElement('panels'),
  all: () => toggleEverything(),
  next_page: () => panels.nextPageAll(),
  session_reset: () => {
    stats.resetSession();
    toast('Sesión reiniciada');
  },
  clear_timers: () => {
    engine.clearAll();
    toast('Temporizadores cancelados');
  },
  score1_up: () => scoreboard.addPoint(1),
  score2_up: () => scoreboard.addPoint(2),
  score_reset: () => scoreboard.resetScores(),
};

for (const action of HOTKEY_ACTIONS) {
  const handler = ACTIONS[action.id];
  if (handler) on(`hotkey-${action.id}`, () => handler());
}

on('countdown-trigger', (event) => {
  const payload = event.payload;
  const index = typeof payload === 'number' ? payload
    : payload && typeof payload.index === 'number' ? payload.index : -1;
  if (index >= 0) engine.trigger(index);
});

on('custom-hotkey', (event) => {
  const payload = event.payload || {};
  const { action, id } = payload;
  switch (action) {
    case 'up': stats.bump(id, 1); break;
    case 'down': stats.bump(id, -1); break;
    case 'win': stats.registerResult(id, 'win'); break;
    case 'loss': stats.registerResult(id, 'loss'); break;
    case 'draw': stats.registerResult(id, 'draw'); break;
    case 'undo': stats.undo(id); break;
    case 'reset': stats.reset(id); break;
    case 'panel_up': {
      const control = panelControlTarget(id);
      if (control) stats.bump(control.tracker_id, control.step);
      break;
    }
    case 'panel_down': {
      const control = panelControlTarget(id);
      if (control) stats.bump(control.tracker_id, -control.step);
      break;
    }
    default: break;
  }
});

on('tray-show', () => call('show_window'));
on('tray-hide', () => call('hide_window'));

// --- boot -------------------------------------------------------------------

// A resolution change, a monitor being plugged in or Windows restoring the
// window all end up here.
let refitTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(refitTimer);
  refitTimer = setTimeout(() => fitOverlay(), 400);
});

async function boot() {
  const stored = await call('load_config');
  applyConfig(normalizeConfig(stored || deepClone(DEFAULT_CONFIG)));
  await fitOverlay();
  if (config.interface.start_locked) setLocked(true);
  if (!inTauri) {
    // Browser preview: expose a handle so the layout can be inspected.
    window.__overlay = { config, engine, panels, stats, settings, openSettings, closeSettings, applyConfig, fitOverlay };
  }
}

boot();
