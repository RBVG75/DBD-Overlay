// Entry point: loads the configuration, wires every widget together and keeps
// the Rust side in sync.

import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';

import {
  ANCHOR_IDS, DEFAULT_CONFIG, HOTKEY_ACTIONS, THEMES, normalizeConfig,
  normalizePanelInto, normalizeTimer, normalizeTracker,
} from './js/defaults.js';
import { createCrosshair } from './js/crosshair.js';
import { createScoreboard } from './js/scoreboard.js';
import { createSettings } from './js/settings.js';
import { createMatchTimers } from './js/match-timers.js';
import { createPanelLayer } from './js/panels.js';
import { createStatsEngine } from './js/stats.js';
import { createTimerEngine } from './js/timers.js';
import { createGameTools } from './js/game-tools.js';
import { loadStreamTheme } from './js/theme-loader.js';
import { makeDraggable, makeOverlayResizable, positionWidget } from './js/widgets.js';
import { deepClone, rgba } from './js/utils.js';

const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const settingsWindow = new URLSearchParams(window.location.search).get('window') === 'settings';
document.body.classList.toggle('settings-window', settingsWindow);

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
  if (!inTauri || settingsWindow) return;
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
const btnGameTools = document.getElementById('btn-game-tools');
const btnSettings = document.getElementById('btn-settings');
const gameToolsEl = document.getElementById('game-tools');
const gameToolsScrim = document.getElementById('game-tools-scrim');
const gameToolsConfigEl = document.getElementById('game-tools-config');
const gameToolsConfigScrim = document.getElementById('game-config-scrim');
const btnDrawConfig = document.getElementById('btn-draw-config');
const btnDrawConfigClose = document.getElementById('btn-draw-config-close');
const btnTutorial = document.getElementById('btn-tutorial');
const tutorialDialog = document.getElementById('tutorial-dialog');
const tutorialKicker = document.getElementById('tutorial-kicker');
const tutorialStep = document.getElementById('tutorial-step');
const tutorialTitle = document.getElementById('tutorial-title');
const tutorialIntro = document.getElementById('tutorial-intro');
const tutorialBody = document.getElementById('tutorial-body');
const tutorialProgress = document.getElementById('tutorial-progress-bar');
const tutorialPrev = document.getElementById('tutorial-prev');
const tutorialNext = document.getElementById('tutorial-next');

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

function broadcastRuntimeState() {
  if (!inTauri || settingsWindow) return;
  emit('runtime-live-update', { config: deepClone(config) })
    .catch((error) => console.warn('[overlay] sincronización del estado', error));
}

const scoreboard = createScoreboard({
  root: scoreboardEl,
  onChange: () => {
    if (matchTimers) matchTimers.render();
    scheduleAutosave();
    broadcastRuntimeState();
  },
});

const matchTimers = createMatchTimers({
  root: stopwatchEl,
  getScoreboard: () => config.scoreboard,
  getSettings: () => config.match_timers,
  onScore: (player) => scoreboard.addPoint(player),
  onChange: () => {
    scheduleAutosave();
    broadcastRuntimeState();
  },
});

const crosshair = createCrosshair(crosshairEl);
const gameTools = createGameTools({
  root: gameToolsEl,
  scrim: gameToolsScrim,
  configRoot: gameToolsConfigEl,
  configScrim: gameToolsConfigScrim,
  configTrigger: btnDrawConfig,
  configCloseButton: btnDrawConfigClose,
  trigger: btnGameTools,
  reduceMotion: () => config.interface.reduce_motion || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  getConfig: () => config.game_tools,
  onConfigChange: (next) => {
    config.game_tools = next;
    scheduleAutosave();
  },
});

btnGameTools.addEventListener('game-tools-open-request', async () => {
  await call('disable_clickthrough');
  if (locked) setLocked(false);
  if (settingsOpen) closeSettings();
  gameTools.open();
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

makeOverlayResizable(document.body, {
  getScale: (element) => {
    if (element === stopwatchEl) return config.stopwatch.scale;
    if (element === scoreboardEl) return config.scoreboard.scale;
    if (element.matches('.timer')) {
      const timer = config.countdowns[Number(element.dataset.countdownIndex)];
      return timer ? timer.scale : 100;
    }
    const panel = config.stats.panels.find((item) => item.id === element.dataset.panelId);
    return panel ? panel.scale : 100;
  },
  onResize: (element, scale) => {
    if (element === stopwatchEl) {
      config.stopwatch.scale = scale;
      element.style.scale = String(scale / 100);
    } else if (element === scoreboardEl) {
      config.scoreboard.scale = scale;
      element.style.scale = String(scale / 100);
    } else if (element.matches('.timer')) {
      const timer = config.countdowns[Number(element.dataset.countdownIndex)];
      if (!timer) return;
      timer.scale = scale;
      element.style.scale = String(scale / 100);
    } else {
      const panel = config.stats.panels.find((item) => item.id === element.dataset.panelId);
      if (!panel) return;
      panel.scale = scale;
      element.style.setProperty('--ip-scale', String(scale / 100));
    }
    scheduleAutosave();
  },
  onEnd: () => {
    scheduleAutosave();
    broadcastRuntimeState();
  },
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
  root.dataset.theme = ui.theme;
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
  gameTools.setConfig(config.game_tools);

  matchTimers.applyConfig(config.match_timers);
  stopwatchEl.classList.toggle('hidden', !config.stopwatch.visible);
  stopwatchEl.dataset.skin = config.stopwatch.style;
  stopwatchEl.style.setProperty('--sw-size', `${Math.min(config.stopwatch.font_size, 64)}px`);
  stopwatchEl.style.setProperty('--sw-color', config.stopwatch.color);
  stopwatchEl.style.setProperty('--sw-surface', rgba('#080a10', config.stopwatch.backdrop_opacity / 100));
  stopwatchEl.style.opacity = String(config.stopwatch.opacity / 100);
  stopwatchEl.style.scale = String(config.stopwatch.scale / 100);
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
  onApply: (next) => {
    applyConfig(next);
    if (inTauri && settingsWindow) {
      emit('config-live-update', { config: deepClone(next) })
        .catch((error) => console.warn('[overlay] sincronización de ajustes', error));
    }
    scheduleAutosave();
  },
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
  onStreamThemeChange: (id) => loadStreamTheme(id, { useUrl: false }),
  onExitApp: () => inTauri ? invoke('exit_app') : undefined,
  onToggleOverlayEdit: () => inTauri ? invoke('request_overlay_edit') : setEditMode(!editMode),
  pickImage: (cb) => {
    imageCallback = cb;
    imageInput.click();
  },
  onCloseRequest: () => closeSettings(),
  onKillerStreakCreated: () => {
    if (localStorage.getItem('killer-streak-tutorial-seen') === '1') return;
    localStorage.setItem('killer-streak-tutorial-seen', '1');
    showTutorial('streak');
  },
});

if (inTauri && settingsWindow) {
  listen('runtime-live-update', (event) => {
    const updated = event.payload && event.payload.config;
    if (updated && typeof updated === 'object') settings.syncRuntimeState(updated);
  }).catch((error) => console.warn('[overlay] escucha de estado en vivo', error));
}

async function openSettings() {
  if (inTauri && !settingsWindow) {
    await call('open_settings_window');
    return;
  }
  if (settingsOpen) return;
  settingsOpen = true;
  if (!settingsWindow) await call('disable_clickthrough');
  if (locked) setLocked(false);
  panelEl.classList.remove('hidden');
  scrimEl.classList.remove('hidden');
  settings.render();
}

function closeSettings() {
  if (!settingsOpen) return;
  if (settingsWindow) {
    persist().catch((error) => console.warn('[overlay] guardado al cerrar ajustes', error));
    call('hide_settings_window');
    settings.stopPreview();
    settingsOpen = false;
    return;
  }
  settingsOpen = false;
  panelEl.classList.add('hidden');
  scrimEl.classList.add('hidden');
  settings.stopPreview();
}

function toggleSettings() {
  if (settingsOpen) closeSettings();
  else openSettings();
}

let tutorialMode = 'tour';
let tutorialIndex = 0;

const tutorialTours = {
  tour: [
    {
      kicker: 'SOBREVIVE A LA NIEBLA', title: 'Tu overlay está listo',
      intro: 'El overlay cubre la pantalla completa, pero puedes ocultarlo o dejar pasar los clics cuando quieras.',
      body: () => `<div class="tutorial-grid"><article class="tutorial-card"><span class="tutorial-card-icon">◉</span><div><strong>Control rápido</strong><p><kbd>${config.hotkeys.start || 'Sin asignar'}</kbd> inicia o pausa el cronómetro.</p></div></article><article class="tutorial-card"><span class="tutorial-card-icon">◌</span><div><strong>Mostrar / ocultar</strong><p><kbd>${config.hotkeys.toggle || 'Sin asignar'}</kbd> aparta el overlay sin cerrarlo.</p></div></article><article class="tutorial-card"><span class="tutorial-card-icon">⌁</span><div><strong>Modo atravesable</strong><p><kbd>${config.hotkeys.lock || 'Sin asignar'}</kbd> deja pasar los clics hacia el juego.</p></div></article><article class="tutorial-card"><span class="tutorial-card-icon">✣</span><div><strong>Ajustes</strong><p><kbd>${config.hotkeys.settings || 'Sin asignar'}</kbd> vuelve a abrir este panel.</p></div></article></div>`,
    },
    {
      kicker: '01 // GENERAL', title: 'Tu punto de partida',
      intro: 'En General eliges la apariencia y el comportamiento global del overlay.',
      body: () => '<div class="tour-list"><p><b>Apariencia:</b> cambia el tema, el color rojo DBD, la escala y la opacidad.</p><p><b>Comportamiento:</b> decide si se ve la barra, dónde aparece y si arranca bloqueado.</p><p><b>Pantalla:</b> elige el monitor actual o todas las pantallas y reajusta la cobertura.</p></div>',
    },
    {
      kicker: '02 // DATOS', title: 'Crea tu primera configuración',
      intro: 'Datos es el centro de trackers y plantillas. Aquí puedes empezar sin crear cada contador manualmente.',
      body: () => '<div class="tour-list"><p>Usa <b>Plantillas automáticas</b> para crear paneles completos.</p><p>Empieza con <b>Killer + racha</b> para tener personaje, racha, récord personal y récord mundial.</p><p>Los datos se actualizan desde la página <b>Control</b> o desde los atajos que asignes.</p></div>',
    },
    {
      kicker: '03 // CONTROL', title: 'Actualiza tus datos durante la partida',
      intro: 'Control muestra los botones y valores que necesitas para jugar sin entrar a editar cada panel.',
      body: () => '<div class="tour-list"><p>En cada fila puedes sumar, restar, registrar victoria/derrota, deshacer o reiniciar.</p><p>Los controles respetan el tracker conectado y sus reglas de racha.</p><p>También puedes asignar un atajo directamente desde la configuración del tracker.</p></div>',
    },
    {
      kicker: '04 // WIDGETS', title: 'Coloca la información donde quieras',
      intro: 'Temporizadores, Cronómetro, Mira y Marcador tienen una sección propia para personalizar su aspecto.',
      body: () => '<div class="tutorial-grid"><article class="tutorial-card"><span class="tutorial-card-icon">◍</span><div><strong>Temporizadores</strong><p>Duración, estilo, alertas, sonidos, imágenes y atajo individual.</p></div></article><article class="tutorial-card"><span class="tutorial-card-icon">▣</span><div><strong>Cronómetro</strong><p>Precisión, controles, vueltas, anillo, fuente y posición.</p></div></article><article class="tutorial-card"><span class="tutorial-card-icon">✛</span><div><strong>Mira</strong><p>Forma, color, tamaño, separación y opacidad.</p></div></article><article class="tutorial-card"><span class="tutorial-card-icon">⊞</span><div><strong>Marcador</strong><p>Jugadores, puntos, título, estilo y teclas de puntuación.</p></div></article></div>',
    },
    {
      kicker: '05 // ATAJOS', title: 'Hazlo todo sin salir del juego',
      intro: 'En Atajos puedes cambiar cualquier combinación. Haz clic en un campo y pulsa las teclas que quieras usar.',
      body: () => `<div class="shortcut-board"><p><kbd>${config.hotkeys.start || 'Sin asignar'}</kbd> Iniciar / pausar</p><p><kbd>${config.hotkeys.reset || 'Sin asignar'}</kbd> Reiniciar</p><p><kbd>${config.hotkeys.all || 'Sin asignar'}</kbd> Mostrar u ocultar todo</p><p><kbd>${config.hotkeys.clear_timers || 'Sin asignar'}</kbd> Limpiar temporizadores</p></div><div class="tutorial-note"><strong>Importante:</strong> guarda los cambios para registrar las teclas globales en Windows.</div>`,
    },
    {
      kicker: '06 // LISTO', title: 'Entra en la niebla',
      intro: 'Cierra Ajustes para volver al juego. Si el overlay captura tus clics, usa el atajo de bloqueo o el botón del candado.',
      body: () => `<div class="tour-finish"><span class="tour-finish-mark">✦</span><strong>Tu primer paso recomendado</strong><p>Ve a <b>Datos → Killer + racha</b>, créalo y después abre <b>Control</b> para probar una victoria.</p><p>Cuando estés listo, pulsa <kbd>${config.hotkeys.settings || 'Sin asignar'}</kbd> para volver aquí.</p></div>`,
    },
  ],
  streak: [
    {
      kicker: 'KILLER + RACHA', title: 'Tu panel acaba de nacer',
      intro: 'Esta plantilla creó los contadores y el panel. Ahora te mostramos cómo personalizarlo.',
      body: () => '<div class="tour-list"><p><b>Killer:</b> cambia el personaje desde el selector de tracker o usa sus controles para recorrer el catálogo.</p><p><b>Racha:</b> aumenta cuando registras una victoria y vuelve a cero al registrar una derrota.</p><p><b>Récord personal:</b> sigue automáticamente el máximo alcanzado.</p></div>',
    },
    {
      kicker: 'ASIGNAR TECLAS', title: 'Controla la racha desde el juego',
      intro: 'Para asignar teclas, abre la sección Control o Contadores avanzados y pulsa el campo de atajo correspondiente.',
      body: () => '<div class="tour-list"><p>En <b>Control</b>, busca la fila de Partidas y asigna teclas para <b>Victoria</b>, <b>Derrota</b> y <b>Deshacer</b>.</p><p>Haz clic en el campo, pulsa la combinación y suéltala para confirmarla.</p><p>Termina pulsando <b>Guardar</b>. Desde ese momento las teclas funcionarán aunque estés jugando.</p></div>',
    },
    {
      kicker: 'MODIFICAR', title: 'Hazlo tuyo',
      intro: 'Puedes volver a Datos para añadir otra plantilla o ir a Paneles para cambiar el diseño visual.',
      body: () => '<div class="tour-grid"><article class="tutorial-card"><span class="tutorial-card-icon">◆</span><div><strong>Datos</strong><p>Cambia nombre, personaje y valores.</p></div></article><article class="tutorial-card"><span class="tutorial-card-icon">▤</span><div><strong>Paneles</strong><p>Posición, tamaño, páginas, colores y rotación.</p></div></article></div><div class="tutorial-note"><strong>Consejo:</strong> si algo sale mal, puedes eliminar el panel y volver a crear la plantilla sin afectar el resto del overlay.</div>',
    },
  ],
};

function renderTutorialStep() {
  const steps = tutorialTours[tutorialMode];
  const current = steps[tutorialIndex];
  tutorialKicker.textContent = current.kicker;
  tutorialStep.textContent = `RECORRIDO ${tutorialIndex + 1} / ${steps.length}`;
  tutorialTitle.textContent = current.title;
  tutorialIntro.textContent = current.intro;
  tutorialBody.innerHTML = current.body();
  tutorialProgress.style.width = `${((tutorialIndex + 1) / steps.length) * 100}%`;
  tutorialPrev.disabled = tutorialIndex === 0;
  tutorialNext.textContent = tutorialIndex === steps.length - 1 ? 'Terminar' : 'Siguiente';
}

function showTutorial(mode = 'tour') {
  tutorialMode = mode;
  tutorialIndex = 0;
  renderTutorialStep();
  tutorialDialog.classList.add('visible');
  try {
    // Keep the native dialog open when the help button is pressed repeatedly.
    // Some embedded WebViews reject close() followed by showModal() in one turn.
    if (typeof tutorialDialog.showModal === 'function' && !tutorialDialog.open) tutorialDialog.showModal();
    else tutorialDialog.setAttribute('open', '');
  } catch (error) {
    // Some embedded WebViews expose <dialog> but reject showModal(). The CSS
    // fallback keeps the help usable instead of failing silently.
    console.warn('[overlay] no se pudo abrir el diálogo nativo', error);
    tutorialDialog.setAttribute('open', '');
  }
}

function closeTutorial() {
  try {
    if (tutorialDialog.open) tutorialDialog.close();
  } catch (_) {
    // The fallback below is enough when the native dialog API is unavailable.
  }
  tutorialDialog.removeAttribute('open');
  tutorialDialog.classList.remove('visible');
  if (tutorialMode === 'tour') localStorage.setItem('overlay-tutorial-seen', '1');
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
  btnEdit.title = editMode ? 'Terminar edición del overlay' : 'Editar datos sobre el overlay';
  btnEdit.setAttribute('aria-label', btnEdit.title);
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
btnTutorial.addEventListener('click', (event) => {
  event.preventDefault();
  showTutorial('tour');
});
tutorialPrev.addEventListener('click', () => {
  tutorialIndex = Math.max(0, tutorialIndex - 1);
  renderTutorialStep();
});
tutorialNext.addEventListener('click', () => {
  if (tutorialIndex >= tutorialTours[tutorialMode].length - 1) closeTutorial();
  else {
    tutorialIndex += 1;
    renderTutorialStep();
  }
});
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
  start: () => matchTimers.toggle(),
  pause: () => matchTimers.pause(),
  reset: () => matchTimers.reset(),
  lap: () => {},
  swap_player: () => matchTimers.swap(),
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
on('overlay-edit-request', () => {
  if (editMode) setEditMode(false);
  else {
    if (locked) setLocked(false);
    setEditMode(true);
  }
});
on('config-updated', async () => {
  const stored = await call('load_config');
  if (stored) applyConfig(normalizeConfig(stored));
});
on('config-live-update', (event) => {
  const updated = event.payload && event.payload.config;
  if (updated && typeof updated === 'object') applyConfig(normalizeConfig(updated));
});

// --- boot -------------------------------------------------------------------

// A resolution change, a monitor being plugged in or Windows restoring the
// window all end up here.
let refitTimer = null;
window.addEventListener('resize', () => {
  if (settingsWindow) return;
  clearTimeout(refitTimer);
  refitTimer = setTimeout(() => fitOverlay(), 400);
});

async function boot() {
  const stored = await call('load_config');
  applyConfig(normalizeConfig(stored || deepClone(DEFAULT_CONFIG)));
  await loadStreamTheme(config.interface.stream_theme);
  if (settingsWindow) {
    await openSettings();
    return;
  }
  await fitOverlay();
  if (config.interface.start_locked) setLocked(true);
  await call('open_settings_window');
  if (!inTauri) {
    // Browser preview: expose a handle so the layout can be inspected.
    window.__overlay = { config, engine, panels, stats, settings, openSettings, closeSettings, applyConfig, fitOverlay };
  }
}

boot();
