// Builds and wires the settings panel.

import {
  ANCHORS, BACKDROPS, DEFAULT_PANEL_ITEM, EMPHASIS, END_ACTIONS, FONT_FAMILIES,
  HOTKEY_ACTIONS, ITEM_SOURCES, PANEL_LAYOUTS, PANEL_STYLES, PANEL_TRANSITIONS,
  POINTER_TYPES, SCREEN_MODES, SOUNDS, STATS_TEMPLATES, STOPWATCH_STYLES, TEXT_FORMATS, THEMES,
  TIMER_PRESETS, TIMER_STYLES, TRACKER_KINDS,
  buildTemplate, normalizePanel, normalizePanelControl, normalizePanelGroup, normalizeTimer, normalizeTracker,
} from './defaults.js';
import {
  buttonRow, colorField, el, group, hotkeyField, numberField, rangeField,
  selectField, textField, toggleField,
} from './controls.js';
import { CATALOGS, catalogEntries, findCharacter, portraitUrl } from './catalog.js';
import { createHotkeyCapture, formatHotkey } from './hotkeys.js';
import { mountPanel } from './panels.js';
import { formulaIsValid } from './stats.js';
import { createTimerView } from './timer-render.js';
import { deepClone as deepCopy, formatClock } from './utils.js';

const PAGES = [
  { id: 'home', label: 'Inicio', icon: '⌂' },
  { id: 'data', label: 'Datos', icon: '✦' },
  { id: 'control', label: 'Control', icon: '☷' },
  { id: 'design', label: 'Diseño del overlay', icon: '▤' },
  { id: 'advanced', label: 'Avanzado', icon: '⚙' },
  { id: 'help', label: 'Ayuda', icon: '?' },
];

const STREAM_THEMES = [
  { id: 'gojo', label: 'Gojo Satoru' },
  { id: 'sukuna', label: 'Sukuna' },
  { id: 'choso', label: 'Choso' },
  { id: 'geto', label: 'Geto Suguru' },
  { id: 'naoya', label: 'Naoya Zenin' },
  { id: 'akaza', label: 'Akaza' },
  { id: 'kokushibo', label: 'Kokushibo' },
  { id: 'naruto', label: 'Naruto' },
];

function createPreview(container) {
  let view = null;
  let raf = null;
  let cfg = null;
  let t0 = 0;

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (view) view.destroy();
    view = null;
  }

  function loop() {
    const step = () => {
      const now = performance.now();
      // Compress the cycle so any duration animates in roughly eight seconds.
      const speed = Math.max(1, cfg.seconds / 8);
      const elapsedRaw = ((now - t0) / 1000) * speed;
      const cycle = elapsedRaw % (cfg.seconds * 1.12);
      const elapsed = Math.min(cfg.seconds, cycle);
      const remaining = Math.max(0, cfg.seconds - cycle);
      const p = cfg.direction === 'fill' ? elapsed / cfg.seconds : remaining / cfg.seconds;
      const phase = remaining <= cfg.danger_at ? 'danger' : remaining <= cfg.warn_at ? 'warning' : 'normal';
      const color = phase === 'danger' ? cfg.danger_color : phase === 'warning' ? cfg.warn_color : cfg.color;
      let text = '';
      if (cfg.text_format === 'percent') text = `${Math.round(p * 100)}%`;
      else if (cfg.text_format !== 'none') {
        text = formatClock(cfg.count_up ? elapsed : remaining, cfg.text_format, cfg.decimals);
      }
      view.update({ total: cfg.seconds, remaining, elapsed, p, phase, color, text, now });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  return {
    set(next) {
      stop();
      cfg = next;
      container.innerHTML = '';
      view = createTimerView(cfg);
      container.appendChild(view.el);
      const scale = Math.min(1, 168 / Math.max(view.el.offsetWidth || cfg.size, cfg.size));
      container.style.setProperty('--preview-scale', scale.toFixed(3));
      t0 = performance.now();
      loop();
    },
    stop,
  };
}

export function createSettings(options) {
  const { panel, draft, onApply, onSave, onResetDefaults, pickImage, onCloseRequest } = options;

  const tabsEl = panel.querySelector('.settings-tabs');
  const pagesEl = panel.querySelector('.settings-pages');
  const statusEl = panel.querySelector('.settings-status');

  let currentPage = 'home';
  let selectedTimer = 0;
  let selectedTracker = 0;
  let trackerSearch = '';
  let selectedPanel = 0;
  let selectedPage = 0;
  let panelAdvanced = false;
  let renderedPage = currentPage;
  let preview = null;
  let panelPreview = null;
  let panelPreviewTimer = null;
  let templatePreviews = [];
  let groupUndo = null;

  const refreshPanels = () => {
    if (options.refreshPanels) options.refreshPanels();
  };

  function mountPreview(container, panel) {
    if (panelPreview) panelPreview.destroy();
    panelPreview = mountPanel(container, normalizePanel({ ...deepCopy(panel), opacity: 100, scale: 100 }),
      options.stats, { rotate: true });
  }

  // Rebuilding the preview on every slider step would thrash the DOM.
  function schedulePanelPreview(panel) {
    clearTimeout(panelPreviewTimer);
    panelPreviewTimer = setTimeout(() => {
      const box = pagesEl.querySelector('.panel-preview');
      if (box) mountPreview(box, panel);
    }, 160);
  }

  const capture = createHotkeyCapture({
    container: panel,
    onCommit: (target, value) => {
      if (target.startsWith('stat:')) {
        const [, id, field] = target.split(':');
        const tracker = draft.stats.trackers.find((t) => t.id === id);
        if (tracker) tracker[`hotkey_${field}`] = value;
      } else if (target.startsWith('timer:')) {
        const index = Number.parseInt(target.slice(6), 10);
        if (draft.countdowns[index]) draft.countdowns[index].hotkey = value;
      } else if (target.startsWith('panel:')) {
        const [, panelId, controlId, direction] = target.split(':');
        const panelConfig = draft.stats.panels.find((candidate) => candidate.id === panelId);
        const control = panelConfig && (panelConfig.controls || [])
          .find((candidate) => candidate.id === controlId);
        if (control) control[`hotkey_${direction}`] = value;
      } else {
        draft.hotkeys[target] = value;
      }
      apply();
      flash(value ? `Atajo asignado: ${formatHotkey(value)}` : 'Atajo borrado');
    },
  });

  function flash(message) {
    statusEl.textContent = message;
    statusEl.classList.add('visible');
    clearTimeout(flash._t);
    flash._t = setTimeout(() => statusEl.classList.remove('visible'), 2200);
  }

  function apply() {
    onApply(draft);
  }

  function goTo(page) {
    currentPage = page;
    render();
  }

  function navButton(label, hint, page, icon) {
    const button = el('button', 'stream-nav-card');
    button.type = 'button';
    button.append(
      el('span', 'stream-nav-icon', icon),
      el('strong', null, label),
      el('span', null, hint),
      el('b', null, 'Abrir →'),
    );
    button.addEventListener('click', () => goTo(page));
    return button;
  }

  function backToDesign() {
    const button = el('button', 'stream-back', '← Volver a Diseño del overlay');
    button.type = 'button';
    button.addEventListener('click', () => goTo('design'));
    return button;
  }

  function pageHome() {
    const page = el('div', 'settings-page home-page');
    const score = draft.scoreboard;
    const match = draft.match_timers;
    const ui = draft.interface;
    const hero = el('section', 'stream-hero');
    hero.append(
      el('div', 'data-kicker', 'OVERLAY 1V1 · CONTROL RÁPIDO'),
      el('h2', 'data-title', 'Ajustes de partida'),
      el('p', 'data-copy', 'Configura el marcador, los cronómetros y el aspecto del overlay desde esta ventana. OBS solo necesita capturar la ventana Overlay.'),
    );
    page.appendChild(hero);

    function playerScoreRow(player) {
      const row = el('div', 'settings-player-score-row');
      const scoreKey = `player${player}_score`;
      const scoreControls = el('div', 'settings-score-controls');
      scoreControls.setAttribute('aria-label', `Puntuación del jugador ${player}`);
      const output = el('output', 'settings-score-value', String(score[scoreKey]));
      output.dataset.scorePlayer = String(player);
      const changeScore = (kind) => {
        score[scoreKey] = kind === 'reset' ? 0 : Math.max(0, Math.min(9999, score[scoreKey] + (kind === 'up' ? 1 : -1)));
        output.value = String(score[scoreKey]);
        output.textContent = String(score[scoreKey]);
        apply();
      };
      for (const [kind, glyph, label] of [
        ['up', '+', `Sumar un punto al jugador ${player}`],
        ['reset', '↶', `Reiniciar puntos del jugador ${player}`],
        ['down', '−', `Restar un punto al jugador ${player}`],
      ]) {
        const button = el('button', 'settings-score-button', glyph);
        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.title = label;
        button.addEventListener('click', () => changeScore(kind));
        scoreControls.appendChild(button);
      }
      scoreControls.appendChild(output);
      row.append(
        textField(`Jugador ${player}`, score[`player${player}_name`], { maxlength: 32 }, (value) => {
          score[`player${player}_name`] = value;
          apply();
        }),
        scoreControls,
      );
      return row;
    }

    page.appendChild(group('Jugadores y marcador', [
      playerScoreRow(1),
      playerScoreRow(2),
      selectField('Cronómetro activo', match.active_player, [
        { id: 1, label: score.player1_name || 'Jugador 1' },
        { id: 2, label: score.player2_name || 'Jugador 2' },
      ], (value) => { match.active_player = Number(value); apply(); }),
      toggleField('Auto-puntuar al pausar ambos', match.auto_score, (value) => { match.auto_score = value; apply(); }, 'El punto va al jugador con el tiempo mayor.'),
      numberField('Umbral de auto-puntuación', match.auto_score_threshold_seconds, { min: 0, max: 3600, suffix: 's' }, (value) => { match.auto_score_threshold_seconds = value; apply(); }),
    ], { columns: 2 }));

    page.appendChild(group('Acciones para la emisión', [
      buttonRow([
        { label: 'Editar datos sobre el overlay', onClick: () => options.onToggleOverlayEdit?.() },
        { label: 'Reiniciar marcador', variant: 'danger', onClick: () => {
          score.player1_score = 0;
          score.player2_score = 0;
          apply();
          flash('Marcador a cero');
        } },
      ]),
      rangeField('Escala del overlay', ui.ui_scale, { min: 60, max: 200, suffix: '%' }, (value) => { ui.ui_scale = value; apply(); }),
      toggleField('Iniciar overlay bloqueado', ui.start_locked, (value) => { ui.start_locked = value; apply(); }, 'Bloquea los clics para que lleguen al juego.'),
    ], { columns: 1 }));

    page.appendChild(group('Atajos de partida', [
      hotkeyField('Iniciar / pausar cronómetro activo', 'start', draft.hotkeys.start, 'F1 por defecto'),
      hotkeyField('Cambiar jugador activo', 'swap_player', draft.hotkeys.swap_player, 'F2 por defecto'),
      hotkeyField('Bloquear / desbloquear clics', 'lock', draft.hotkeys.lock, 'Activa el modo atravesable'),
    ], { columns: 2, note: 'Los atajos se aplican al pulsar Guardar o automáticamente al terminar de editar.' }));
    return page;
  }

  function pageDesign() {
    const page = el('div', 'settings-page design-page');
    const back = el('button', 'stream-back', '← Volver a opciones generales');
    back.type = 'button';
    back.addEventListener('click', () => goTo('home'));
    page.appendChild(back);
    const hero = el('section', 'data-hero');
    hero.append(
      el('div', 'data-kicker', 'DISEÑO DEL OVERLAY'),
      el('h2', 'data-title', 'Decide qué ve tu audiencia'),
      el('p', 'data-copy', 'Configura primero el bloque que quieres mostrar. Los detalles visuales quedan dentro de cada editor.'),
    );
    page.appendChild(hero);
    const grid = el('div', 'stream-nav-grid stream-design-grid');
    grid.append(
      navButton('Paneles de información', 'Estadísticas, rachas, nombres y páginas', 'panels', '▤'),
      navButton('Temporizadores', 'Cuenta atrás, alertas e imágenes', 'timers', '◍'),
      navButton('Marcador', 'Jugadores, puntos y título de partida', 'scoreboard', '⊞'),
      navButton('Cronómetro', 'Tiempo de partida y vueltas', 'stopwatch', '▣'),
    );
    page.appendChild(grid);
    return page;
  }

  function pageAdvanced() {
    const page = el('div', 'settings-page advanced-page');
    const ui = draft.interface;
    const hero = el('section', 'data-hero');
    hero.append(
      el('div', 'data-kicker', 'CONFIGURACIÓN AVANZADA'),
      el('h2', 'data-title', 'Ajustes secundarios'),
      el('p', 'data-copy', 'Estas opciones se mantienen disponibles, pero no necesitas tocarlas para empezar a emitir.'),
    );
    page.appendChild(hero);
    page.appendChild(group('Tema del stream', [
      selectField('Estética activa', ui.stream_theme, STREAM_THEMES, async (value) => {
        ui.stream_theme = value;
        apply();
        if (options.onStreamThemeChange) await options.onStreamThemeChange(value);
        flash(`Tema aplicado: ${(STREAM_THEMES.find((theme) => theme.id === value) || {}).label || value}`);
      }, 'Se aplica al overlay sin cambiar la estética de los ajustes.'),
    ], { columns: 1 }));
    const grid = el('div', 'stream-nav-grid stream-design-grid');
    grid.append(
      navButton('Apariencia y pantalla', 'Tema, escala, monitor y comportamiento', 'general', '◆'),
      navButton('Mira', 'Forma, color y visibilidad del puntero', 'crosshair', '✛'),
      navButton('Atajos', 'Control global desde teclado', 'hotkeys', '⌘'),
      navButton('Contadores avanzados', 'Fórmulas, récords y conexiones', 'trackers', '⧉'),
    );
    page.appendChild(grid);
    return page;
  }

  // --- tabs -----------------------------------------------------------------

  function renderTabs() {
    tabsEl.innerHTML = '';
    for (const page of PAGES) {
      const button = el('button', 'settings-tab');
      button.type = 'button';
      button.dataset.page = page.id;
      button.append(el('span', 'tab-icon', page.icon), el('span', 'tab-label', page.label));
      button.setAttribute('aria-selected', String(page.id === currentPage));
      button.addEventListener('click', () => {
        currentPage = page.id;
        render();
      });
      tabsEl.appendChild(button);
    }
  }

  // --- pages ----------------------------------------------------------------

  function pageGeneral() {
    const ui = draft.interface;
    const page = el('div', 'settings-page');
    page.appendChild(group('Apariencia', [
      selectField('Tema', ui.theme, THEMES.concat([{ id: 'custom', label: 'Personalizado' }]), (v) => {
        ui.theme = v;
        const theme = THEMES.find((t) => t.id === v);
        if (theme) ui.accent_color = theme.accent;
        apply();
        render();
      }),
      colorField('Color de acento', ui.accent_color, (v) => {
        ui.accent_color = v;
        ui.theme = 'custom';
        apply();
      }),
      rangeField('Escala de la interfaz', ui.ui_scale, { min: 60, max: 200, suffix: '%' }, (v) => {
        ui.ui_scale = v;
        apply();
      }),
      rangeField('Opacidad de los paneles', ui.panel_opacity, { min: 50, max: 100, suffix: '%' }, (v) => {
        ui.panel_opacity = v;
        apply();
      }),
    ], { columns: 2 }));

    page.appendChild(group('Comportamiento', [
      toggleField('Barra de herramientas', ui.show_toolbar, (v) => {
        ui.show_toolbar = v;
        apply();
      }, 'Botones flotantes de bloqueo y ajustes'),
      selectField('Posición de la barra', ui.toolbar_position, [
        { id: 'bottom-right', label: 'Abajo derecha' },
        { id: 'bottom-left', label: 'Abajo izquierda' },
        { id: 'top-right', label: 'Arriba derecha' },
        { id: 'top-left', label: 'Arriba izquierda' },
      ], (v) => {
        ui.toolbar_position = v;
        apply();
      }),
      toggleField('Reducir animaciones', ui.reduce_motion, (v) => {
        ui.reduce_motion = v;
        apply();
      }, 'Menos movimiento y menos carga de GPU'),
      toggleField('Iniciar bloqueado', ui.start_locked, (v) => {
        ui.start_locked = v;
      }, 'Arranca en modo atravesable'),
    ], { columns: 2 }));

    const fit = options.getScreenFit ? options.getScreenFit() : null;
    const fitLine = el('div', 'field');
    fitLine.appendChild(el('label', 'field-label', 'Zona que cubre ahora mismo'));
    fitLine.appendChild(el('span', 'screen-readout', fit
      ? `${fit.width} × ${fit.height} px desde (${fit.x}, ${fit.y})`
      : 'Sin datos todavía'));
    fitLine.appendChild(el('span', 'field-hint', fit
      ? `${fit.monitors} ${fit.monitors === 1 ? 'pantalla detectada' : 'pantallas detectadas'} · escala ${Math.round(fit.scale * 100)}%`
      : 'Abre la app desde Windows para verlo'));

    page.appendChild(group('Pantalla', [
      selectField('Qué debe cubrir', ui.screen_mode, SCREEN_MODES, (v) => {
        ui.screen_mode = v;
        apply();
        if (options.onFitScreen) options.onFitScreen(v);
      }, (SCREEN_MODES.find((m) => m.id === ui.screen_mode) || {}).hint),
      fitLine,
      buttonRow([
        { label: 'Reajustar ahora', onClick: async () => {
          if (!options.onFitScreen) return;
          const result = await options.onFitScreen(ui.screen_mode);
          flash(result ? `Ajustado a ${result.width} × ${result.height}` : 'No se pudo reajustar');
          render();
        } },
      ]),
    ], {
      columns: 2,
      note: 'El overlay se estira sobre el rectángulo completo del monitor, incluida la franja de la barra de tareas. Si cambias de resolución se reajusta solo.',
    }));

    page.appendChild(group('Restablecer', [
      buttonRow([
        { label: 'Valores de fábrica', variant: 'danger', onClick: () => onResetDefaults() },
      ]),
    ]));
    page.appendChild(group('Aplicación', [
      buttonRow([
        {
          label: 'Cerrar la aplicación',
          variant: 'danger',
          onClick: async () => {
            try {
              await options.onExitApp?.();
            } catch (error) {
              flash('No se pudo cerrar la aplicación');
              console.error(error);
            }
          },
        },
      ]),
    ], { note: 'Cierra el overlay y finaliza la aplicación, también en la bandeja del sistema.' }));
    return page;
  }

  function pageStopwatch() {
    const sw = draft.stopwatch;
    const page = el('div', 'settings-page');
    page.appendChild(backToDesign());
    const set = (key) => (v) => {
      sw[key] = v;
      apply();
    };

    page.appendChild(group('Visualización', [
      toggleField('Mostrar cronómetro', sw.visible, set('visible')),
      selectField('Estilo', sw.style, STOPWATCH_STYLES, (v) => {
        sw.style = v;
        apply();
      }),
      selectField('Tipografía', sw.font_family, FONT_FAMILIES, set('font_family')),
      numberField('Tamaño', sw.font_size, { min: 16, max: 160, suffix: 'px' }, set('font_size')),
      rangeField('Grosor de la fuente', sw.font_weight, { min: 100, max: 900, step: 100 }, set('font_weight')),
      numberField('Espaciado', sw.letter_spacing, { min: -2, max: 16, suffix: 'px' }, set('letter_spacing')),
    ], { columns: 2 }));

    page.appendChild(group('Colores y fondo', [
      colorField('Color de los dígitos', sw.color, set('color')),
      colorField('Color de los separadores', sw.separator_color, set('separator_color')),
      rangeField('Brillo', sw.glow, { min: 0, max: 100, suffix: '%' }, set('glow')),
      rangeField('Opacidad del fondo', sw.backdrop_opacity, { min: 0, max: 100, suffix: '%' }, set('backdrop_opacity')),
      numberField('Radio de esquinas', sw.corner_radius, { min: 0, max: 40, suffix: 'px' }, set('corner_radius')),
      rangeField('Opacidad general', sw.opacity, { min: 10, max: 100, suffix: '%' }, set('opacity')),
    ], { columns: 2 }));

    page.appendChild(group('Formato', [
      toggleField('Mostrar horas', sw.show_hours, set('show_hours')),
      toggleField('Mostrar centésimas', sw.show_centiseconds, (v) => {
        sw.show_centiseconds = v;
        if (v) sw.show_milliseconds = false;
        apply();
        render();
      }),
      toggleField('Mostrar milésimas', sw.show_milliseconds, (v) => {
        sw.show_milliseconds = v;
        if (v) sw.show_centiseconds = false;
        apply();
        render();
      }),
      toggleField('Parpadeo de separadores', sw.blink_separator, set('blink_separator')),
    ], { columns: 2 }));

    page.appendChild(group('Extras', [
      toggleField('Botones visibles', sw.show_controls, set('show_controls')),
      toggleField('Texto de estado', sw.show_status, set('show_status')),
      toggleField('Lista de vueltas', sw.show_laps, set('show_laps')),
      numberField('Vueltas visibles', sw.lap_count, { min: 1, max: 10 }, set('lap_count')),
      toggleField('Anillo de progreso', sw.progress_ring, set('progress_ring')),
      numberField('Ciclo del anillo', sw.progress_minutes, { min: 1, max: 120, suffix: 'min' }, set('progress_minutes')),
    ], { columns: 2 }));

    page.appendChild(group('Posición', [
      selectField('Anclaje', sw.position, ANCHORS, set('position')),
      numberField('Desplazamiento X', sw.offset_x, { min: -4000, max: 4000, suffix: 'px' }, set('offset_x')),
      numberField('Desplazamiento Y', sw.offset_y, { min: -4000, max: 4000, suffix: 'px' }, set('offset_y')),
    ], { columns: 3 }));
    return page;
  }

  function pageCrosshair() {
    const ch = draft.crosshair;
    const page = el('div', 'settings-page');
    const set = (key) => (v) => {
      ch[key] = v;
      apply();
    };
    page.appendChild(group('Mira', [
      toggleField('Mostrar mira', ch.enabled, set('enabled')),
      selectField('Forma', ch.pointer_type, POINTER_TYPES, set('pointer_type')),
      colorField('Color', ch.color, set('color')),
      numberField('Longitud', ch.size, { min: 2, max: 120, suffix: 'px' }, set('size')),
      numberField('Grosor', ch.thickness, { min: 1, max: 16, suffix: 'px' }, set('thickness')),
      numberField('Separación central', ch.gap, { min: 0, max: 60, suffix: 'px' }, set('gap')),
      rangeField('Opacidad', ch.opacity, { min: 10, max: 100, suffix: '%' }, set('opacity')),
      numberField('Ajuste vertical', ch.offset_y, { min: -400, max: 400, suffix: 'px' }, set('offset_y')),
      toggleField('Contorno oscuro', ch.outline, set('outline')),
      toggleField('Punto central', ch.dot, set('dot')),
    ], { columns: 2 }));
    return page;
  }

  function pageScoreboard() {
    const sb = draft.scoreboard;
    const match = draft.match_timers;
    const page = el('div', 'settings-page');
    page.appendChild(backToDesign());
    const set = (key) => (v) => {
      sb[key] = v;
      apply();
    };
    page.appendChild(group('Marcador', [
      toggleField('Mostrar marcador', sb.visible, set('visible')),
      selectField('Estilo', sb.style, [
        { id: 'glass', label: 'Cristal' },
        { id: 'minimal', label: 'Mínimo' },
        { id: 'bars', label: 'Barras' },
        { id: 'cards', label: 'Tarjetas' },
      ], set('style')),
      textField('Jugador 1', sb.player1_name, { maxlength: 32 }, set('player1_name')),
      textField('Jugador 2', sb.player2_name, { maxlength: 32 }, set('player2_name')),
      colorField('Color jugador 1', sb.accent1, set('accent1')),
      colorField('Color jugador 2', sb.accent2, set('accent2')),
      numberField('Tamaño de los números', sb.font_size, { min: 14, max: 96, suffix: 'px' }, set('font_size')),
      toggleField('Mostrar título', sb.show_title, set('show_title')),
      rangeField('Opacidad', sb.opacity, { min: 10, max: 100, suffix: '%' }, set('opacity')),
    ], { columns: 2 }));

    page.appendChild(group('Posición', [
      selectField('Anclaje', sb.position, ANCHORS, set('position')),
      numberField('Desplazamiento X', sb.offset_x, { min: -4000, max: 4000, suffix: 'px' }, set('offset_x')),
      numberField('Desplazamiento Y', sb.offset_y, { min: -4000, max: 4000, suffix: 'px' }, set('offset_y')),
    ], { columns: 3 }));

    page.appendChild(group('Puntuación', [
      toggleField('Puntuar automáticamente al pausar ambos cronómetros', match.auto_score, (value) => {
        match.auto_score = value;
        apply();
      }, 'El punto se asigna al jugador con el tiempo mayor.'),
      numberField('Umbral para auto-puntuación', match.auto_score_threshold_seconds, { min: 0, max: 3600, suffix: 's' }, (value) => {
        match.auto_score_threshold_seconds = value;
        apply();
      }),
      buttonRow([
        { label: 'Reiniciar marcador', variant: 'danger', onClick: () => {
          sb.player1_score = 0;
          sb.player2_score = 0;
          apply();
          flash('Marcador a cero');
        } },
      ]),
    ]));
    return page;
  }

  function pageHotkeys() {
    const page = el('div', 'settings-page');
    page.appendChild(group('Acciones globales', HOTKEY_ACTIONS.map((action) =>
      hotkeyField(action.label, action.id, draft.hotkeys[action.id], action.hint),
    ), { columns: 2, note: 'Haz clic en un atajo y pulsa la combinación. Supr o Retroceso lo borra, Esc cancela.' }));

    page.appendChild(group('Temporizadores', draft.countdowns.map((cd, i) =>
      hotkeyField(cd.label || `Temporizador ${i + 1}`, `timer:${i}`, cd.hotkey, `${cd.seconds}s · ${
        (TIMER_STYLES.find((s) => s.id === cd.style) || {}).label || cd.style}`),
    ), { columns: 2 }));
    return page;
  }

  function pageTimers() {
    const page = el('div', 'settings-page timers-page');
    page.appendChild(backToDesign());
    const list = draft.countdowns;
    if (selectedTimer >= list.length) selectedTimer = Math.max(0, list.length - 1);

    const chips = el('div', 'timer-chips');
    list.forEach((cd, i) => {
      const chip = el('button', 'timer-chip');
      chip.type = 'button';
      chip.dataset.active = String(i === selectedTimer);
      chip.style.setProperty('--chip-color', cd.color);
      chip.append(
        el('span', 'chip-dot'),
        el('span', 'chip-name', cd.label || `Temporizador ${i + 1}`),
        el('span', 'chip-meta', `${cd.seconds}s`),
      );
      chip.addEventListener('click', () => {
        selectedTimer = i;
        render();
      });
      chips.appendChild(chip);
    });
    const add = el('button', 'timer-chip add');
    add.type = 'button';
    add.textContent = '+ Añadir';
    add.addEventListener('click', () => {
      if (list.length >= 24) return flash('Máximo de 24 temporizadores');
      list.push(normalizeTimer({ label: `Temporizador ${list.length + 1}`, seconds: 30 }));
      selectedTimer = list.length - 1;
      apply();
      render();
    });
    chips.appendChild(add);
    page.appendChild(chips);

    if (!list.length) {
      page.appendChild(el('p', 'empty-note', 'Añade un temporizador para empezar.'));
      return page;
    }

    const cd = list[selectedTimer];
    const set = (key) => (v) => {
      cd[key] = v;
      apply();
      if (preview) preview.set({ ...cd });
    };
    const setAndRebuild = (key) => (v) => {
      cd[key] = v;
      apply();
      render();
    };

    // Preview + presets header
    const head = el('div', 'timer-editor-head');
    const previewBox = el('div', 'timer-preview');
    const previewStage = el('div', 'timer-preview-stage');
    previewBox.append(el('span', 'timer-preview-label', 'Vista previa'), previewStage);
    head.appendChild(previewBox);

    const presets = el('div', 'timer-presets');
    presets.appendChild(el('span', 'field-label', 'Ajustes rápidos'));
    const presetRow = el('div', 'preset-row');
    for (const p of TIMER_PRESETS) {
      const b = el('button', 'chip-button', p.label);
      b.type = 'button';
      b.addEventListener('click', () => {
        Object.assign(cd, normalizeTimer({ ...cd, ...p.patch }));
        apply();
        render();
      });
      presetRow.appendChild(b);
    }
    presets.appendChild(presetRow);
    presets.appendChild(el('span', 'field-label', 'Acciones'));
    presets.appendChild(buttonRow([
      { label: 'Probar', onClick: () => options.onTest(selectedTimer) },
      { label: 'Duplicar', onClick: () => {
        if (list.length >= 24) return flash('Máximo de 24 temporizadores');
        list.splice(selectedTimer + 1, 0, normalizeTimer({ ...cd, hotkey: '', label: `${cd.label} copia` }));
        selectedTimer += 1;
        apply();
        render();
      } },
      { label: 'Eliminar', variant: 'danger', onClick: () => {
        list.splice(selectedTimer, 1);
        selectedTimer = Math.max(0, selectedTimer - 1);
        apply();
        render();
      } },
    ]));
    head.appendChild(presets);
    page.appendChild(head);

    page.appendChild(group('Identidad', [
      textField('Nombre', cd.label, { maxlength: 24 }, (v) => {
        cd.label = v;
        apply();
      }, 'Se muestra en la lista y, si quieres, bajo el temporizador'),
      hotkeyField('Atajo', `timer:${selectedTimer}`, cd.hotkey),
      numberField('Duración', cd.seconds, { min: 1, max: 86400, suffix: 's' }, setAndRebuild('seconds')),
      toggleField('Permitir varios a la vez', cd.allow_multiple, set('allow_multiple')),
    ], { columns: 2 }));

    page.appendChild(group('Estilo visual', [
      selectField('Diseño', cd.style, TIMER_STYLES.map((s) => ({ id: s.id, label: s.label, group: s.group })),
        setAndRebuild('style'), (TIMER_STYLES.find((s) => s.id === cd.style) || {}).hint),
      numberField('Tamaño', cd.size, { min: 48, max: 640, suffix: 'px' }, set('size')),
      numberField('Grosor de línea', cd.thickness, { min: 1, max: 40, step: 0.5, suffix: 'px' }, set('thickness')),
      numberField('Segmentos / marcas', cd.segments, { min: 2, max: 120 }, setAndRebuild('segments')),
      selectField('Sentido', cd.direction, [
        { id: 'drain', label: 'Se vacía' },
        { id: 'fill', label: 'Se llena' },
      ], setAndRebuild('direction')),
      selectField('Giro', cd.spin, [
        { id: 'cw', label: 'Horario' },
        { id: 'ccw', label: 'Antihorario' },
      ], setAndRebuild('spin')),
      numberField('Ángulo de inicio', cd.start_angle, { min: -360, max: 360, suffix: '°' }, setAndRebuild('start_angle')),
      rangeField('Opacidad', cd.opacity, { min: 10, max: 100, suffix: '%' }, set('opacity')),
    ], { columns: 2 }));

    page.appendChild(group('Colores', [
      colorField('Color principal', cd.color, set('color')),
      colorField('Color secundario', cd.color2, setAndRebuild('color2')),
      colorField('Color de la pista', cd.track_color, set('track_color')),
      rangeField('Opacidad de la pista', cd.track_opacity, { min: 0, max: 100, suffix: '%' }, set('track_opacity')),
      rangeField('Brillo', cd.glow, { min: 0, max: 100, suffix: '%' }, set('glow')),
    ], { columns: 2 }));

    page.appendChild(group('Texto', [
      selectField('Formato', cd.text_format, TEXT_FORMATS, setAndRebuild('text_format')),
      toggleField('Décimas de segundo', cd.decimals, set('decimals')),
      selectField('Tipografía', cd.font_family, FONT_FAMILIES, set('font_family')),
      rangeField('Tamaño del texto', cd.font_size, { min: 6, max: 60, suffix: '%' }, set('font_size')),
      rangeField('Grosor del texto', cd.font_weight, { min: 200, max: 900, step: 100 }, set('font_weight')),
      colorField('Color del texto', cd.text_color, set('text_color')),
      toggleField('Cuenta hacia arriba', cd.count_up, set('count_up')),
      toggleField('Mostrar nombre', cd.show_label, setAndRebuild('show_label')),
      selectField('Posición del nombre', cd.label_position, [
        { id: 'bottom', label: 'Debajo' },
        { id: 'top', label: 'Encima' },
      ], setAndRebuild('label_position')),
    ], { columns: 2 }));

    page.appendChild(group('Alertas', [
      numberField('Aviso a los', cd.warn_at, { min: 0, max: 3600, suffix: 's' }, set('warn_at')),
      numberField('Peligro a los', cd.danger_at, { min: 0, max: 3600, suffix: 's' }, set('danger_at')),
      colorField('Color de aviso', cd.warn_color, set('warn_color')),
      colorField('Color de peligro', cd.danger_color, set('danger_color')),
      toggleField('Latido al final', cd.pulse_on_danger, setAndRebuild('pulse_on_danger')),
      toggleField('Vibración al final', cd.shake_on_danger, setAndRebuild('shake_on_danger')),
      selectField('Sonido final', cd.sound, SOUNDS, set('sound')),
      rangeField('Volumen', cd.volume, { min: 0, max: 100, suffix: '%' }, set('volume')),
      toggleField('Tic en los últimos 3 s', cd.tick_sound, set('tick_sound')),
      selectField('Al terminar', cd.on_end, END_ACTIONS, set('on_end')),
    ], { columns: 2 }));

    const imageButtons = buttonRow([
      { label: cd.image ? 'Cambiar imagen' : 'Elegir imagen', onClick: () => {
        pickImage((dataUrl) => {
          cd.image = dataUrl;
          apply();
          render();
        });
      } },
      cd.image ? { label: 'Quitar', variant: 'danger', onClick: () => {
        cd.image = '';
        apply();
        render();
      } } : null,
    ].filter(Boolean));

    page.appendChild(group('Fondo e imagen', [
      selectField('Fondo', cd.backdrop, BACKDROPS, setAndRebuild('backdrop')),
      colorField('Color del fondo', cd.backdrop_color, set('backdrop_color')),
      rangeField('Opacidad del fondo', cd.backdrop_opacity, { min: 0, max: 100, suffix: '%' }, set('backdrop_opacity')),
      numberField('Radio de esquinas', cd.corner_radius, { min: 0, max: 80, suffix: 'px' }, set('corner_radius')),
      imageButtons,
      rangeField('Opacidad de la imagen', cd.image_opacity, { min: 0, max: 100, suffix: '%' }, set('image_opacity')),
      rangeField('Desenfoque de la imagen', cd.image_blur, { min: 0, max: 20, suffix: 'px' }, set('image_blur')),
    ], { columns: 2 }));

    page.appendChild(group('Posición', [
      selectField('Anclaje', cd.position, ANCHORS, setAndRebuild('position')),
      numberField('Desplazamiento X', cd.offset_x, { min: -2000, max: 2000, suffix: 'px' }, setAndRebuild('offset_x')),
      numberField('Desplazamiento Y', cd.offset_y, { min: -2000, max: 2000, suffix: 'px' }, setAndRebuild('offset_y')),
      selectField('Apilado', cd.stack, [
        { id: 'column', label: 'En columna' },
        { id: 'row', label: 'En fila' },
      ], setAndRebuild('stack')),
    ], { columns: 2 }));

    queueMicrotask(() => {
      if (preview) preview.stop();
      preview = createPreview(previewStage);
      preview.set({ ...cd });
    });

    return page;
  }

  // --- trackers -------------------------------------------------------------

  function trackerOptions(kind) {
    return draft.stats.trackers
      .filter((t) => !kind || t.kind === kind)
      .map((t) => ({ id: t.id, label: t.label }));
  }

  function buildSavedTemplate(template) {
    const taken = draft.stats.trackers.map((tracker) => tracker.key);
    const idMap = new Map();
    const created = (template.trackers || []).map((raw) => {
      const tracker = normalizeTracker({ ...deepCopy(raw), id: '', key: '' }, taken);
      taken.push(tracker.key);
      idMap.set(raw.id, tracker.id);
      return tracker;
    });
    for (const tracker of created) {
      tracker.bump_with = idMap.get(tracker.bump_with) || '';
      tracker.reset_with = idMap.get(tracker.reset_with) || '';
    }
    const panel = deepCopy(template.panel);
    panel.id = '';
    panel.pages = (panel.pages || []).map((panelPage) => ({
      ...panelPage,
      items: (panelPage.items || []).map((item) => ({
        ...item,
        tracker_id: idMap.get(item.tracker_id) || '',
      })),
    }));
    panel.controls = (panel.controls || []).map((control) => ({
      ...control,
      id: '',
      tracker_id: idMap.get(control.tracker_id) || '',
    }));
    return { trackers: created, panels: [normalizePanel(panel)] };
  }

  function buildAnyTemplate(template) {
    return template.saved ? buildSavedTemplate(template) : buildTemplate(template, draft.stats.trackers);
  }

  function previewStats(built) {
    const localTrackers = new Map(built.trackers.map((tracker) => [tracker.id, tracker]));
    return {
      get(id) {
        return localTrackers.get(id) || options.stats.get(id);
      },
      get sessionSeconds() {
        return options.stats.sessionSeconds;
      },
      values() {
        return options.stats.values();
      },
    };
  }

  function allTemplates() {
    return [...STATS_TEMPLATES, ...draft.stats.saved_templates.map((template) => ({ ...template, saved: true }))];
  }

  function applyTemplate(template) {
    const built = buildAnyTemplate(template);
    if (draft.stats.trackers.length + built.trackers.length > 32) {
      return flash('Demasiados contadores');
    }
    draft.stats.trackers.push(...built.trackers);
    draft.stats.panels.push(...built.panels);
    selectedTracker = draft.stats.trackers.length - 1;
    selectedPanel = draft.stats.panels.length - 1;
    apply();
    render();
    flash(`Plantilla «${template.label}» añadida`);
    if (template.id === 'killer-streak' && options.onKillerStreakCreated) options.onKillerStreakCreated();
  }

  function appendTemplatePage(template, panelIndex = selectedPanel) {
    const target = draft.stats.panels[panelIndex];
    if (!target) return flash('Crea un panel antes de añadir una página');
    if (target.pages.length >= 12) return flash('Máximo de 12 páginas por panel');
    const built = buildAnyTemplate(template);
    if (draft.stats.trackers.length + built.trackers.length > 32) return flash('Demasiados contadores');
    const pages = built.panels.flatMap((panelConfig) => panelConfig.pages || []);
    if (target.pages.length + pages.length > 12) return flash('La plantilla supera el máximo de páginas');
    draft.stats.trackers.push(...built.trackers);
    target.pages.push(...deepCopy(pages));
    if (target.pages.length > 1 && !target.rotate_seconds) target.rotate_seconds = 8;
    selectedPanel = panelIndex;
    selectedPage = target.pages.length - pages.length;
    apply();
    render();
    flash(`Página «${template.label}» añadida a «${target.label}»`);
  }

  function saveCurrentAsTemplate() {
    const panel = draft.stats.panels[selectedPanel];
    if (!panel) return flash('Crea un panel antes de guardarlo como plantilla');
    if (draft.stats.saved_templates.length >= 12) return flash('Máximo de 12 plantillas guardadas');
    const trackerIds = new Set();
    for (const panelPage of panel.pages || []) {
      for (const item of panelPage.items || []) if (item.tracker_id) trackerIds.add(item.tracker_id);
    }
    for (const control of panel.controls || []) if (control.tracker_id) trackerIds.add(control.tracker_id);
    draft.stats.saved_templates.push({
      id: `saved-${Date.now().toString(36)}`,
      label: `${panel.label} guardado`,
      hint: 'Plantilla personalizada creada desde tu panel',
      saved: true,
      trackers: deepCopy(draft.stats.trackers.filter((tracker) => trackerIds.has(tracker.id))),
      panel: deepCopy(panel),
    });
    apply();
    render();
    flash('Plantilla personalizada guardada');
  }

  function createQuickPanel(kind) {
    const trackers = draft.stats.trackers;
    const panels = draft.stats.panels;
    if (trackers.length >= 32 || panels.length >= 16) return flash('Has alcanzado el límite de datos o paneles');

    const labels = { number: 'Contador', winloss: 'Partidas', text: 'Texto' };
    const tracker = normalizeTracker({
      label: labels[kind],
      kind,
      text: kind === 'text' ? 'Escribe aquí' : '',
    }, trackers.map((item) => item.key));
    trackers.push(tracker);
    panels.push(normalizePanel({
      label: tracker.label,
      pages: [{ title: '', items: [{ source: 'tracker', tracker_id: tracker.id, emphasis: 'big' }] }],
    }));
    selectedTracker = trackers.length - 1;
    selectedPanel = panels.length - 1;
    apply();
    render();
    flash(`${tracker.label} creado`);
  }

  function groupPanels(sourceIndex, targetIndex) {
    const panels = draft.stats.panels;
    if (sourceIndex === targetIndex || !panels[sourceIndex] || !panels[targetIndex]) return;
    const source = panels[sourceIndex];
    const target = panels[targetIndex];
    const groups = draft.stats.groups || (draft.stats.groups = []);
    const before = deepCopy(groups);
    const sourceGroup = groups.find((group) => group.panel_ids.includes(source.id));
    const targetGroup = groups.find((group) => group.panel_ids.includes(target.id));
    const sourceIds = sourceGroup ? sourceGroup.panel_ids : [source.id];

    if (sourceGroup && targetGroup && sourceGroup.id === targetGroup.id) return;
    groupUndo = before;

    if (targetGroup) {
      targetGroup.panel_ids = [...new Set([...targetGroup.panel_ids, ...sourceIds])];
      if (sourceGroup && sourceGroup !== targetGroup) {
        const sourceIndexInGroups = groups.indexOf(sourceGroup);
        groups.splice(sourceIndexInGroups, 1);
      }
    } else {
      groups.push(normalizePanelGroup({
        label: `${target.label} y ${source.label}`,
        panel_ids: [target.id, ...sourceIds],
      }));
      if (sourceGroup) groups.splice(groups.indexOf(sourceGroup), 1);
    }

    apply();
    render();
    flash(`«${source.label}» agrupado con «${target.label}»`);
  }

  function undoGroup() {
    if (!groupUndo) return;
    draft.stats.groups = groupUndo;
    groupUndo = null;
    apply();
    render();
    flash('Agrupación deshecha');
  }

  function pageData() {
    const page = el('div', 'settings-page data-page');
    const panels = draft.stats.panels;
    const trackers = draft.stats.trackers;
    const panelGroups = draft.stats.groups || (draft.stats.groups = []);

    const intro = el('section', 'data-hero');
    intro.append(
      el('div', 'data-kicker', 'CENTRO DE DATOS'),
      el('h2', 'data-title', 'Crea y organiza tus paneles en pocos pasos'),
      el('p', 'data-copy', 'Empieza con una plantilla o crea un dato individual. Para agrupar paneles, arrastra una tarjeta sobre otra o usa el botón de grupo.'),
    );
    page.appendChild(intro);

    const quick = el('section', 'data-section');
    quick.append(el('h3', 'data-section-title', 'Crear rápidamente'), el('p', 'data-section-note', 'Estas opciones crean el dato y su panel ya conectados.'));
    const quickGrid = el('div', 'quick-grid');
    [
      ['number', 'Contador', 'Un número que puedes sumar y restar'],
      ['winloss', 'Victorias y derrotas', 'Marcador con porcentaje e historial'],
      ['text', 'Texto libre', 'Nombre, récord o cualquier nota'],
    ].forEach(([kind, label, hint]) => {
      const button = el('button', 'quick-card');
      button.type = 'button';
      button.append(el('strong', null, label), el('span', null, hint), el('b', null, '+ Crear'));
      button.addEventListener('click', () => createQuickPanel(kind));
      quickGrid.appendChild(button);
    });
    quick.appendChild(quickGrid);
    page.appendChild(quick);

    const templates = el('section', 'data-section');
    templates.append(el('h3', 'data-section-title', 'Plantillas automáticas'), el('p', 'data-section-note', 'Crea un panel completo o añade la plantilla como una página más a un panel existente.'));
    if (panels.length) {
      templates.appendChild(selectField('Añadir páginas al panel', String(selectedPanel),
        panels.map((panelConfig, index) => ({ id: String(index), label: panelConfig.label })),
        (value) => { selectedPanel = Number.parseInt(value, 10); },
        'Elige aquí el panel que recibirá la nueva página'));
    }
    const saveTemplate = el('button', 'chip-button', 'Guardar panel actual como plantilla');
    saveTemplate.type = 'button';
    saveTemplate.addEventListener('click', saveCurrentAsTemplate);
    templates.appendChild(saveTemplate);
    const templateGrid = el('div', 'quick-grid template-grid');
    const availableTemplates = allTemplates();
    availableTemplates.forEach((template) => {
      const card = el('article', 'quick-card template-card');
      const mini = el('div', 'template-mini');
      card.appendChild(mini);
      card.append(el('strong', null, template.label), el('span', null, template.hint));
      const actions = el('div', 'template-actions');
      const create = el('button', 'chip-button', 'Crear panel');
      create.type = 'button';
      create.addEventListener('click', () => applyTemplate(template));
      actions.appendChild(create);
      if (panels.length) {
        const addPage = el('button', 'chip-button', 'Añadir página');
        addPage.type = 'button';
        addPage.addEventListener('click', () => appendTemplatePage(template, selectedPanel));
        actions.appendChild(addPage);
      }
      card.appendChild(actions);
      templateGrid.appendChild(card);
      queueMicrotask(() => {
        if (!mini.isConnected) return;
        const built = buildAnyTemplate(template);
        if (built.panels[0]) templatePreviews.push(mountPanel(mini, built.panels[0], previewStats(built), { rotate: false }));
      });
    });
    templates.appendChild(templateGrid);
    page.appendChild(templates);

    const board = el('section', 'data-section');
    board.append(el('h3', 'data-section-title', 'Organizar paneles'), el('p', 'data-section-note', 'Arrastra una tarjeta sobre otra para crear un grupo. El grupo es reversible y no mezcla ni elimina tus paneles.'));

    if (panelGroups.length) {
      const groupsBox = el('div', 'panel-groups');
      groupsBox.appendChild(el('h4', 'panel-groups-title', 'Grupos creados'));
      panelGroups.forEach((panelGroup, groupIndex) => {
        const groupRow = el('div', 'panel-group-row');
        const members = panelGroup.panel_ids
          .map((id) => panels.find((candidate) => candidate.id === id))
          .filter(Boolean);
        groupRow.append(
          textField('Nombre del grupo', panelGroup.label, { maxlength: 28 }, (value) => {
            panelGroup.label = value;
            apply();
          }),
          toggleField('Grupo visible', panelGroup.visible, (value) => {
            panelGroup.visible = value;
            apply();
          }),
        );
        groupRow.appendChild(el('span', 'panel-group-members', members.map((member) => member.label).join(' · ')));
        const remove = el('button', 'chip-button danger', 'Desagrupar');
        remove.type = 'button';
        remove.addEventListener('click', () => {
          panelGroups.splice(groupIndex, 1);
          apply();
          render();
          flash('Grupo eliminado; los paneles siguen intactos');
        });
        groupRow.appendChild(remove);
        groupsBox.appendChild(groupRow);
      });
      board.appendChild(groupsBox);
    }

    if (groupUndo) {
      const undo = el('button', 'chip-button', 'Deshacer última agrupación');
      undo.type = 'button';
      undo.addEventListener('click', undoGroup);
      board.appendChild(undo);
    }

    const boardGrid = el('div', 'panel-board');
    panels.forEach((panelConfig, index) => {
      const card = el('article', 'panel-board-card');
      card.draggable = true;
      card.tabIndex = 0;
      const currentGroup = panelGroups.find((panelGroup) => panelGroup.panel_ids.includes(panelConfig.id));
      card.setAttribute('aria-label', `${panelConfig.label}${currentGroup ? `, grupo ${currentGroup.label}` : ''}. Arrastra para agrupar`);
      card.append(
        el('span', 'panel-board-mark', String(index + 1).padStart(2, '0')),
        el('strong', 'panel-board-name', panelConfig.label),
        el('span', 'panel-board-meta', `${panelConfig.pages.length} ${panelConfig.pages.length === 1 ? 'página' : 'páginas'} · ${panelConfig.pages.reduce((n, item) => n + item.items.length, 0)} datos${currentGroup ? ` · ${currentGroup.label}` : ''}`),
      );
      const actions = el('div', 'panel-board-actions');
      const edit = el('button', 'chip-button', 'Editar');
      edit.type = 'button';
      edit.addEventListener('click', () => { selectedPanel = index; selectedPage = 0; currentPage = 'panels'; render(); });
      actions.appendChild(edit);
      panels.forEach((other, otherIndex) => {
        if (otherIndex === index) return;
        if (currentGroup && currentGroup.panel_ids.includes(other.id)) return;
        const merge = el('button', 'chip-button panel-group-button', `+ ${other.label}`);
        merge.type = 'button';
        merge.title = `Añadir ${other.label} a ${panelConfig.label}`;
        merge.addEventListener('click', () => groupPanels(otherIndex, index));
        actions.appendChild(merge);
      });
      card.appendChild(actions);
      card.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/panel-index', String(index));
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
      card.addEventListener('dragover', (event) => {
        event.preventDefault();
        card.classList.add('is-drop-target');
      });
      card.addEventListener('dragleave', () => card.classList.remove('is-drop-target'));
      card.addEventListener('drop', (event) => {
        event.preventDefault();
        card.classList.remove('is-drop-target');
        groupPanels(Number(event.dataTransfer.getData('text/panel-index')), index);
      });
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        const firstGroupAction = card.querySelector('.panel-group-button');
        if (firstGroupAction) firstGroupAction.focus();
      });
      boardGrid.appendChild(card);
    });
    if (!panels.length) boardGrid.appendChild(el('p', 'empty-note', 'Todavía no hay paneles. Crea uno arriba para verlo aquí.'));
    board.appendChild(boardGrid);
    page.appendChild(board);

    const manage = el('div', 'data-links');
    const trackersButton = el('button', 'chip-button', `Editar datos avanzados (${trackers.length})`);
    trackersButton.type = 'button';
    trackersButton.addEventListener('click', () => { currentPage = 'trackers'; render(); });
    const panelsButton = el('button', 'chip-button', `Editar apariencia (${panels.length})`);
    panelsButton.type = 'button';
    panelsButton.addEventListener('click', () => { currentPage = 'panels'; render(); });
    manage.append(trackersButton, panelsButton);
    page.appendChild(manage);
    return page;
  }

  function pageHelp() {
    const page = el('div', 'settings-page help-page');
    const intro = el('section', 'data-hero');
    intro.append(
      el('div', 'data-kicker', 'CENTRO DE AYUDA'),
      el('h2', 'data-title', 'Preguntas frecuentes'),
      el('p', 'data-copy', 'Respuestas rápidas para los problemas más habituales al configurar y usar el overlay.'),
    );
    page.appendChild(intro);

    const questions = [
      ['¿Por qué se abre Ajustes al iniciar?', 'Es intencional: el overlay cubre toda la pantalla y la primera vez necesitas saber cómo usarlo. Puedes cerrar Ajustes cuando termines; se abrirá de nuevo automáticamente en cada inicio para que nunca parezca que la aplicación bloqueó Windows.'],
      ['¿Cómo oculto el overlay sin cerrarlo?', `Usa el atajo «${draft.hotkeys.toggle || 'Sin asignar'}» o pulsa el botón de mostrar/ocultar de la barra. El proceso sigue activo y puedes recuperarlo con la misma tecla.`],
      ['¿Cómo dejo pasar los clics al juego?', `Activa el modo atravesable con «${draft.hotkeys.lock || 'Sin asignar'}» o con el botón del candado. Para volver a editar, usa la misma tecla otra vez.`],
      ['¿Cómo creo un Killer y una racha?', 'Ve a Datos → Plantillas automáticas → Killer + racha y pulsa Crear panel. Se crean el personaje, la racha, el récord personal y el récord mundial conectados entre sí. La primera vez aparecerá una explicación guiada.'],
      ['¿Cómo asigno teclas a una victoria o derrota?', 'Después de crear una plantilla, ve a Control o Contadores avanzados. Pulsa el campo de atajo, presiona la combinación deseada y suéltala. Pulsa Guardar para registrarla globalmente en Windows.'],
      ['¿Cómo funciona la racha?', 'La racha sube al registrar una victoria y se reinicia al registrar una derrota. El récord personal guarda el valor máximo automáticamente. Deshacer permite corregir el último cambio.'],
      ['¿Por qué mi atajo no funciona?', 'Comprueba que no esté siendo usado por otra aplicación o por otro atajo del overlay. Vuelve a capturarlo desde Atajos, evita combinaciones reservadas por Windows y pulsa Guardar. Algunas teclas pueden estar ocupadas por el juego o por software de terceros.'],
      ['¿El overlay tapa el juego?', 'La ventana es transparente y está diseñada para cubrir toda la pantalla, pero sus widgets solo ocupan las posiciones configuradas. Usa Mostrar / ocultar para apartarlo o Modo atravesable para seguir haciendo clic en el juego.'],
      ['¿Qué ocurre si cambio de resolución o monitor?', 'El overlay se reajusta automáticamente. En General puedes elegir el monitor actual o todas las pantallas y usar Reajustar ahora para comprobar el rectángulo cubierto.'],
      ['¿Dónde se guardan mis cambios?', 'Los cambios se aplican al instante en pantalla, pero debes pulsar Guardar para conservarlos al reiniciar. Los contadores también se guardan automáticamente después de un pequeño retraso.'],
      ['¿Cómo vuelvo a empezar?', 'En General → Restablecer puedes recuperar los valores de fábrica. Esto reemplaza la configuración actual; úsalo solo si quieres comenzar de nuevo.'],
    ];
    const list = el('div', 'faq-list');
    questions.forEach(([question, answer], index) => {
      const details = document.createElement('details');
      details.className = 'faq-item';
      if (index === 0) details.open = true;
      const summary = document.createElement('summary');
      summary.textContent = question;
      details.append(summary, el('p', 'faq-answer', answer));
      list.appendChild(details);
    });
    page.appendChild(list);
    return page;
  }

  function pageControl() {
    const page = el('div', 'settings-page control-page');
    const trackers = draft.stats.trackers;
    page.append(
      el('div', 'data-hero', null),
    );
    const hero = page.lastChild;
    hero.append(
      el('div', 'data-kicker', 'CONTROL RÁPIDO'),
      el('h2', 'data-title', 'Todos tus contadores en una sola pantalla'),
      el('p', 'data-copy', 'Actualiza rachas, objetivos, partidas y textos sin abrir cada panel. Los cambios se reflejan al instante en el overlay.'),
    );

    if (!trackers.length) {
      page.appendChild(el('p', 'empty-note', 'Todavía no hay contadores. Crea uno desde Datos o usa una plantilla.'));
      return page;
    }

    const list = el('div', 'control-list');
    const rows = new Map();
    trackers.forEach((tracker) => {
      const row = el('article', 'control-row');
      row.style.setProperty('--control-color', tracker.color);
      const identity = el('div', 'control-identity');
      identity.append(
        el('strong', 'control-name', tracker.label),
        el('span', 'control-type', TRACKER_KINDS.find((kind) => kind.id === tracker.kind)?.label || tracker.kind),
      );
      const value = el('div', 'control-value');
      const actions = el('div', 'control-actions');
      const action = (label, onClick, variant = '') => {
        const button = el('button', `chip-button ${variant}`, label);
        button.type = 'button';
        button.addEventListener('click', () => { onClick(); apply(); render(); });
        return button;
      };

      if (tracker.kind === 'winloss') {
        value.append(el('strong', 'control-number', `${tracker.wins}-${tracker.losses}`), el('span', 'control-subvalue', `${tracker.draws} empates`));
        actions.append(
          action('+ Victoria', () => options.stats.registerResult(tracker.id, 'win')),
          action('+ Derrota', () => options.stats.registerResult(tracker.id, 'loss')),
          action('Anular anterior', () => options.stats.undo(tracker.id)),
          action('Reiniciar', () => options.stats.reset(tracker.id), 'danger'),
        );
      } else if (tracker.kind === 'choice') {
        const current = findCharacter(tracker.catalog, tracker.choice_id);
        value.append(el('strong', 'control-number control-choice', current?.name || 'Sin elegir'));
        actions.append(
          action('Anterior', () => options.stats.bump(tracker.id, -1)),
          action('Siguiente', () => options.stats.bump(tracker.id, 1)),
          action('Primero', () => options.stats.reset(tracker.id), 'danger'),
        );
      } else if (tracker.kind === 'text') {
        const input = textField('Texto', tracker.text, { maxlength: 120 }, (text) => {
          tracker.text = text;
          apply();
          refreshPanels();
        });
        value.appendChild(input);
        actions.append(action('Borrar', () => { tracker.text = ''; }, 'danger'));
      } else {
        const goalItem = draft.stats.panels
          .flatMap((panelConfig) => panelConfig.pages || [])
          .flatMap((panelPage) => panelPage.items || [])
          .find((item) => item.source === 'goal' && item.tracker_id === tracker.id);
        value.append(el('strong', 'control-number', goalItem ? `${tracker.value} / ${goalItem.goal}` : String(tracker.value)),
          el('span', 'control-subvalue', goalItem ? 'objetivo' : `récord ${tracker.record}`));
        actions.append(
          action('+ Aumentar', () => options.stats.bump(tracker.id, tracker.step)),
          action('- Disminuir', () => options.stats.bump(tracker.id, -tracker.step)),
          action('Reiniciar', () => options.stats.reset(tracker.id), 'danger'),
        );
      }
      row.append(identity, value, actions);
      list.appendChild(row);
      rows.set(tracker.id, row);
    });

    // Use the panel composition as a friendly grouping for related counters.
    // A killer panel, for example, keeps the killer, streak and world record together.
    const used = new Set();
    const assigned = new Set();
    const grouped = draft.stats.panels.map((panelConfig) => {
      const ids = [...new Set((panelConfig.pages || []).flatMap((panelPage) => panelPage.items || [])
        .map((item) => item.tracker_id).filter((id) => id && !assigned.has(id)))];
      ids.forEach((id) => assigned.add(id));
      return { label: panelConfig.label, trackers: ids.map((id) => trackers.find((tracker) => tracker.id === id)).filter(Boolean) };
    }).filter((entry) => entry.trackers.length > 1);
    list.innerHTML = '';
    for (const entry of grouped) {
      const section = el('section', 'control-group');
      const choice = entry.trackers.find((tracker) => tracker.kind === 'choice');
      const choiceName = choice && findCharacter(choice.catalog, choice.choice_id)?.name;
      section.appendChild(el('h3', 'control-group-title', choiceName ? `${entry.label}: ${choiceName}` : entry.label));
      for (const tracker of entry.trackers) {
        if (choiceName && tracker !== choice) {
          const name = rows.get(tracker.id)?.querySelector('.control-name');
          if (name && tracker.label.toLowerCase().includes('racha')) name.textContent = `Racha de ${choiceName}`;
          else if (name && tracker.label.toLowerCase().includes('récord')) name.textContent = `${tracker.label} de ${choiceName}`;
        }
        section.appendChild(rows.get(tracker.id));
        used.add(tracker.id);
      }
      list.appendChild(section);
    }
    const remaining = trackers.filter((tracker) => !used.has(tracker.id));
    if (remaining.length) {
      const section = el('section', 'control-group');
      section.appendChild(el('h3', 'control-group-title', 'Otros contadores'));
      remaining.forEach((tracker) => section.appendChild(rows.get(tracker.id)));
      list.appendChild(section);
    }
    page.appendChild(list);
    page.appendChild(el('p', 'field-group-note', 'Los contadores avanzados, fórmulas, límites y atajos siguen disponibles en «Contadores avanzados».'));
    return page;
  }

  function pageTrackers() {
    const list = draft.stats.trackers;
    const page = el('div', 'settings-page');

    page.appendChild(group('Plantillas listas', [
      buttonRow(allTemplates().map((t) => ({
        label: t.label,
        title: t.hint,
        onClick: () => applyTemplate(t),
      }))),
    ], { note: 'Cada plantilla crea los contadores y el panel ya montados y conectados. Después puedes retocarlo todo.' }));

    const searchField = el('div', 'field tracker-search');
    const searchLabel = el('label', 'field-label', 'Buscar contador');
    const search = el('input', 'input input-text');
    search.type = 'search';
    search.placeholder = 'Nombre o clave…';
    search.value = trackerSearch;
    search.setAttribute('aria-label', 'Buscar contador por nombre o clave');
    search.addEventListener('input', () => {
      trackerSearch = search.value;
      render();
    });
    searchField.append(searchLabel, search);
    page.appendChild(searchField);

    if (selectedTracker >= list.length) selectedTracker = Math.max(0, list.length - 1);

    const chips = el('div', 'stat-chip-row');
    const visibleTrackers = list.filter((tracker) => {
      const query = trackerSearch.trim().toLowerCase();
      return !query || tracker.label.toLowerCase().includes(query) || tracker.key.toLowerCase().includes(query);
    });
    if (trackerSearch && visibleTrackers.length && !visibleTrackers.includes(list[selectedTracker])) {
      selectedTracker = list.indexOf(visibleTrackers[0]);
    }
    visibleTrackers.forEach((t) => {
      const i = list.indexOf(t);
      const chip = el('button', 'stat-chip');
      chip.type = 'button';
      chip.dataset.active = String(i === selectedTracker);
      chip.style.setProperty('--chip-color', t.color);
      const value = t.kind === 'winloss'
        ? `${t.wins}-${t.losses}`
        : t.kind === 'text'
          ? '“…”'
          : t.kind === 'choice'
            ? (findCharacter(t.catalog, t.choice_id) || {}).name || '—'
            : String(t.value);
      chip.append(el('span', 'chip-dot'), el('span', 'chip-name', t.label), el('span', 'chip-meta', value));
      chip.addEventListener('click', () => {
        selectedTracker = i;
        render();
      });
      chips.appendChild(chip);
    });
    const add = el('button', 'stat-chip add');
    add.type = 'button';
    add.textContent = '+ Contador';
    add.addEventListener('click', () => {
      if (list.length >= 32) return flash('Máximo de 32 contadores');
      const taken = list.map((t) => t.key);
      list.push(normalizeTracker({ label: `Contador ${list.length + 1}` }, taken));
      selectedTracker = list.length - 1;
      apply();
      render();
    });
    chips.appendChild(add);
    page.appendChild(chips);
    if (!visibleTrackers.length) page.appendChild(el('p', 'empty-note', 'No hay contadores que coincidan con la búsqueda.'));

    if (!list.length) {
      page.appendChild(el('p', 'empty-note', 'Empieza con una plantilla o crea un contador vacío.'));
      return page;
    }

    const t = list[selectedTracker];
    const set = (key) => (v) => {
      t[key] = v;
      refreshPanels();
    };
    const setAndRebuild = (key) => (v) => {
      t[key] = v;
      apply();
      render();
    };

    const keyTag = el('div', 'field');
    keyTag.append(el('label', 'field-label', 'Clave para las fórmulas'), el('span', 'stat-key', t.key));
    keyTag.appendChild(el('span', 'field-hint', 'Úsala en fórmulas de los paneles'));

    page.appendChild(group('Identidad', [
      textField('Nombre', t.label, { maxlength: 28 }, set('label')),
      selectField('Tipo', t.kind, TRACKER_KINDS, setAndRebuild('kind'),
        (TRACKER_KINDS.find((k) => k.id === t.kind) || {}).hint),
      colorField('Color', t.color, set('color')),
      keyTag,
    ], { columns: 2 }));

    if (t.kind === 'winloss') {
      page.appendChild(group('Marcador del contador', [
        numberField('Victorias', t.wins, { min: 0, max: 99999 }, setAndRebuild('wins')),
        numberField('Derrotas', t.losses, { min: 0, max: 99999 }, setAndRebuild('losses')),
        numberField('Empates', t.draws, { min: 0, max: 99999 }, setAndRebuild('draws')),
        numberField('Mejor marca (a mano)', t.record, { min: 0, max: 999999 }, setAndRebuild('record'),
          'Para récords que no se calculan solos'),
        buttonRow([
          { label: 'Victoria', onClick: () => { options.stats.registerResult(t.id, 'win'); render(); } },
          { label: 'Derrota', onClick: () => { options.stats.registerResult(t.id, 'loss'); render(); } },
          { label: 'Empate', onClick: () => { options.stats.registerResult(t.id, 'draw'); render(); } },
          { label: 'Deshacer', onClick: () => { options.stats.undo(t.id); render(); } },
        ]),
      ], { columns: 2 }));
    } else if (t.kind === 'choice') {
      const entries = catalogEntries(t.catalog);
      const current = findCharacter(t.catalog, t.choice_id);

      const preview = el('div', 'character-current');
      const previewImg = document.createElement('img');
      previewImg.src = portraitUrl(t.catalog, t.choice_id);
      previewImg.alt = '';
      const previewText = el('div');
      previewText.append(
        el('div', 'character-current-name', current ? current.name : 'Sin elegir'),
        el('div', 'character-current-meta', `${entries.length} disponibles · clave ${t.key}`),
      );
      preview.append(previewImg, previewText);

      const picker = el('div', 'character-picker');
      for (const entry of entries) {
        const option = el('button', 'character-option');
        option.type = 'button';
        option.dataset.active = String(entry.id === t.choice_id);
        option.title = entry.name;
        const img = document.createElement('img');
        img.src = `/${entry.file}`;
        img.alt = '';
        img.loading = 'lazy';
        option.append(img, el('span', null, entry.name));
        option.addEventListener('click', () => {
          t.choice_id = entry.id;
          apply();
          render();
        });
        picker.appendChild(option);
      }

      const pickerField = el('div', 'field');
      pickerField.append(el('label', 'field-label', 'Elige el personaje'), picker);

      page.appendChild(group('Personaje', [
        selectField('Catálogo', t.catalog, CATALOGS, (v) => {
          t.catalog = v;
          const first = catalogEntries(v)[0];
          t.choice_id = first ? first.id : '';
          apply();
          render();
        }),
        preview,
        pickerField,
      ], {
        columns: 1,
        note: 'Los retratos vienen incluidos con la app. Con los atajos de abajo puedes ir cambiando de personaje sin salir de la partida.',
      }));
    } else if (t.kind === 'text') {
      page.appendChild(group('Contenido', [
        textField('Texto', t.text, { maxlength: 120, placeholder: 'Por ejemplo: 61 partidas — Otzdarva' }, set('text')),
      ]));
    } else {
      page.appendChild(group('Valor', [
        numberField('Valor actual', t.value, { min: t.min, max: t.max }, setAndRebuild('value')),
        numberField('Récord', t.record, { min: 0, max: 999999 }, setAndRebuild('record')),
        toggleField('Guardar el récord solo', t.track_record, set('track_record'),
          'Sube cuando el valor supera al récord anterior'),
        numberField('Paso del atajo', t.step, { min: 1, max: 1000 }, set('step')),
        numberField('Mínimo', t.min, { min: -99999, max: 99999 }, setAndRebuild('min')),
        numberField('Máximo', t.max, { min: 0, max: 999999 }, setAndRebuild('max')),
      ], { columns: 3 }));

      const winlossOptions = [{ id: '', label: 'Nada' }, ...trackerOptions('winloss')];
      page.appendChild(group('Racha automática', [
        selectField('Sube con la victoria de', t.bump_with, winlossOptions, setAndRebuild('bump_with')),
        selectField('Se pone a cero con la derrota de', t.reset_with, winlossOptions, setAndRebuild('reset_with')),
      ], {
        columns: 2,
        note: 'Conecta este contador a uno de victorias y derrotas: sube solo con cada victoria y se reinicia con cada derrota. Así funciona una racha.',
      }));
    }

    const isWl = t.kind === 'winloss';
    const isChoice = t.kind === 'choice';
    const upLabel = isWl ? 'Victoria' : isChoice ? 'Personaje siguiente' : 'Sumar';
    const downLabel = isWl ? 'Derrota' : isChoice ? 'Personaje anterior' : 'Restar';
    const resetLabel = isChoice ? 'Volver al primero' : 'Poner a cero';
    page.appendChild(group('Atajos', [
      hotkeyField(upLabel, `stat:${t.id}:up`, t.hotkey_up),
      hotkeyField(downLabel, `stat:${t.id}:down`, t.hotkey_down),
      isWl ? hotkeyField('Empate', `stat:${t.id}:draw`, t.hotkey_draw) : null,
      isWl ? hotkeyField('Deshacer la última', `stat:${t.id}:undo`, t.hotkey_undo) : null,
      hotkeyField(resetLabel, `stat:${t.id}:reset`, t.hotkey_reset),
    ].filter(Boolean), { columns: 2, note: 'Funcionan aunque el juego esté en primer plano.' }));

    page.appendChild(group('Sesión y acciones', [
      toggleField('Se reinicia con la sesión', t.reset_on_session, set('reset_on_session'),
        'El récord y el texto no se pierden'),
      buttonRow([
        { label: 'Poner a cero', onClick: () => { options.stats.reset(t.id); render(); } },
        { label: 'Borrar el récord', onClick: () => { options.stats.resetRecord(t.id); render(); } },
        { label: 'Eliminar contador', variant: 'danger', onClick: () => {
          draft.stats.trackers.splice(selectedTracker, 1);
          selectedTracker = Math.max(0, selectedTracker - 1);
          apply();
          render();
        } },
      ]),
    ], { columns: 2 }));

    return page;
  }

  // --- panels ---------------------------------------------------------------

  function itemCard(item, page, index, panel) {
    const card = el('div', 'item-card');
    const head = el('div', 'item-card-head');
    head.appendChild(el('span', 'item-card-title', `Dato ${index + 1}`));
    head.appendChild(buttonRow([
      index > 0 ? { label: '↑', title: 'Subir', onClick: () => {
        page.items.splice(index - 1, 0, page.items.splice(index, 1)[0]);
        apply();
        render();
      } } : null,
      index < page.items.length - 1 ? { label: '↓', title: 'Bajar', onClick: () => {
        page.items.splice(index + 1, 0, page.items.splice(index, 1)[0]);
        apply();
        render();
      } } : null,
      { label: '×', title: 'Quitar', variant: 'danger', onClick: () => {
        page.items.splice(index, 1);
        apply();
        render();
      } },
      { label: 'Copiar', title: 'Duplicar este dato', onClick: () => {
        if (page.items.length >= 10) return flash('Máximo de 10 datos por página');
        page.items.splice(index + 1, 0, deepCopy(page.items[index]));
        apply();
        render();
      } },
    ].filter(Boolean)));
    card.appendChild(head);

    const set = (key) => (v) => {
      item[key] = v;
      apply();
    };
    const setAndRebuild = (key) => (v) => {
      item[key] = v;
      apply();
      render();
    };

    const isPortrait = item.source === 'portrait';
    const needsTracker = ['tracker', 'record', 'record_pair', 'winrate', 'goal', 'history', 'portrait']
      .includes(item.source);
    const kindFilter = item.source === 'winrate' || item.source === 'history'
      ? 'winloss'
      : isPortrait ? 'choice' : null;
    const fields = [
      selectField('Qué muestra', item.source, ITEM_SOURCES, setAndRebuild('source'),
        (ITEM_SOURCES.find((s) => s.id === item.source) || {}).hint),
      needsTracker
        ? selectField(isPortrait ? 'Personaje' : 'Contador', item.tracker_id,
          [{ id: '', label: 'Sin elegir' }, ...trackerOptions(kindFilter)], setAndRebuild('tracker_id'),
          isPortrait ? 'Necesita un contador de tipo Personaje' : undefined)
        : null,
      textField('Etiqueta', item.label, { maxlength: 28, placeholder: 'Automática' }, set('label')),
      isPortrait ? null : selectField('Tamaño', item.emphasis, EMPHASIS, set('emphasis')),
    ];

    if (isPortrait) {
      fields.push(
        numberField('Tamaño del retrato', item.image_size, { min: 32, max: 420, suffix: 'px' }, setAndRebuild('image_size')),
        numberField('Radio de esquinas', item.image_radius, { min: 0, max: 60, suffix: 'px' }, setAndRebuild('image_radius')),
        toggleField('Mostrar etiqueta', item.show_label, setAndRebuild('show_label')),
      );
      const grid = el('div', 'field-grid cols-2');
      for (const f of fields) if (f) grid.appendChild(f);
      card.appendChild(grid);
      return card;
    }

    if (item.source === 'formula') {
      const keys = Object.keys(options.stats.values());
      const input = textField('Fórmula', item.formula, { maxlength: 160, placeholder: 'kills / partidas * 100' }, (v) => {
        item.formula = v;
        const node = input.querySelector('input');
        node.classList.toggle('invalid', !formulaIsValid(v, keys));
        apply();
      });
      fields.push(input);
      const help = el('div', 'field');
      help.appendChild(el('label', 'field-label', 'Claves disponibles'));
      const helpText = el('div', 'formula-help');
      helpText.innerHTML = draft.stats.trackers.map((t) => {
        if (t.kind === 'winloss') {
          return `<code>${t.key}</code> partidas · <code>${t.key}_v</code> victorias · <code>${t.key}_d</code> derrotas · <code>${t.key}_pct</code> %`;
        }
        return `<code>${t.key}</code> valor · <code>${t.key}_record</code> récord`;
      }).concat('<code>sesion</code> minutos en directo').join('<br>');
      help.appendChild(helpText);
      fields.push(help);
    }
    if (item.source === 'text') {
      fields.push(textField('Texto', item.text, { maxlength: 120 }, set('text')));
    }
    if (item.source === 'goal') {
      fields.push(numberField('Meta', item.goal, { min: 1, max: 99999 }, set('goal')));
    }
    if (item.source === 'history') {
      fields.push(numberField('Cuántas', item.history_count, { min: 3, max: 30 }, setAndRebuild('history_count')));
    }

    fields.push(
      numberField('Decimales', item.decimals, { min: 0, max: 3 }, set('decimals')),
      textField('Prefijo', item.prefix, { maxlength: 8 }, set('prefix')),
      textField('Sufijo', item.suffix, { maxlength: 8, placeholder: '%' }, set('suffix')),
      colorField('Color propio', item.color || panel.text_color, set('color')),
      toggleField('Mostrar etiqueta', item.show_label, setAndRebuild('show_label')),
    );

    const grid = el('div', 'field-grid cols-2');
    for (const f of fields) if (f) grid.appendChild(f);
    card.appendChild(grid);
    return card;
  }

  function panelControlCard(control, panel, index) {
    const card = el('div', 'item-card panel-control-card');
    const head = el('div', 'item-card-head');
    head.appendChild(el('span', 'item-card-title', `Control ${index + 1}`));
    head.appendChild(buttonRow([
      index > 0 ? { label: '↑', title: 'Subir', onClick: () => {
        panel.controls.splice(index - 1, 0, panel.controls.splice(index, 1)[0]);
        apply();
        render();
      } } : null,
      index < panel.controls.length - 1 ? { label: '↓', title: 'Bajar', onClick: () => {
        panel.controls.splice(index + 1, 0, panel.controls.splice(index, 1)[0]);
        apply();
        render();
      } } : null,
      { label: '×', title: 'Quitar', variant: 'danger', onClick: () => {
        panel.controls.splice(index, 1);
        apply();
        render();
      } },
    ].filter(Boolean)));
    card.appendChild(head);

    const set = (key) => (value) => {
      control[key] = value;
      apply();
      schedulePanelPreview(panel);
    };
    const trackerChoices = [{ id: '', label: 'Sin elegir' }, ...trackerOptions()];
    card.appendChild(group(null, [
      selectField('Contador', control.tracker_id, trackerChoices, set('tracker_id'),
        'El botón modifica este contador'),
      textField('Texto del control', control.label, { maxlength: 28, placeholder: 'Nombre del contador' }, set('label')),
      numberField('Cantidad por pulsación', control.step, { min: 1, max: 100 }, set('step')),
      hotkeyField('Atajo +', `panel:${panel.id}:${control.id}:up`, control.hotkey_up, 'Suma la cantidad indicada'),
      hotkeyField('Atajo −', `panel:${panel.id}:${control.id}:down`, control.hotkey_down, 'Resta la cantidad indicada'),
    ], { columns: 2 }));
    return card;
  }

  function pagePanels() {
    const list = draft.stats.panels;
    const page = el('div', 'settings-page');
    page.appendChild(backToDesign());

    if (selectedPanel >= list.length) selectedPanel = Math.max(0, list.length - 1);

    const chips = el('div', 'stat-chip-row');
    list.forEach((p, i) => {
      const chip = el('button', 'stat-chip');
      chip.type = 'button';
      chip.dataset.active = String(i === selectedPanel);
      chip.style.setProperty('--chip-color', p.color);
      chip.append(
        el('span', 'chip-dot'),
        el('span', 'chip-name', p.label),
        el('span', 'chip-meta', p.pages.length > 1 ? `${p.pages.length} págs` : '1 pág'),
      );
      chip.addEventListener('click', () => {
        selectedPanel = i;
        selectedPage = 0;
        render();
      });
      chips.appendChild(chip);
    });
    const add = el('button', 'stat-chip add');
    add.type = 'button';
    add.textContent = '+ Panel';
    add.addEventListener('click', () => {
      if (list.length >= 16) return flash('Máximo de 16 paneles');
      list.push(normalizePanel({ label: `Panel ${list.length + 1}` }));
      selectedPanel = list.length - 1;
      selectedPage = 0;
      apply();
      render();
    });
    chips.appendChild(add);
    page.appendChild(chips);

    if (!list.length) {
      page.appendChild(el('p', 'empty-note',
        'Todavía no hay paneles. Crea uno aquí o usa una plantilla en la pestaña Contadores.'));
      return page;
    }

    const p = list[selectedPanel];
    if (selectedPage >= p.pages.length) selectedPage = 0;

    const set = (key) => (v) => {
      p[key] = v;
      apply();
      schedulePanelPreview(p);
    };
    const setAndRebuild = (key) => (v) => {
      p[key] = v;
      apply();
      render();
    };

    const previewBox = el('div', 'panel-preview');
    page.appendChild(previewBox);

    const mode = el('div', 'editor-mode');
    mode.append(
      el('span', 'editor-mode-label', 'Nivel de edición'),
      buttonRow([
        { label: 'Básico', variant: panelAdvanced ? '' : 'active', onClick: () => { panelAdvanced = false; render(); } },
        { label: 'Avanzado', variant: panelAdvanced ? 'active' : '', onClick: () => { panelAdvanced = true; render(); } },
      ]),
    );
    page.appendChild(mode);

    page.appendChild(group('Panel', [
      textField('Nombre', p.label, { maxlength: 28 }, (v) => {
        p.label = v;
        apply();
      }),
      toggleField('Visible', p.visible, setAndRebuild('visible')),
      selectField('Estilo', p.style, PANEL_STYLES, set('style'),
        (PANEL_STYLES.find((s) => s.id === p.style) || {}).hint),
      selectField('Disposición', p.layout, PANEL_LAYOUTS, setAndRebuild('layout'),
        (PANEL_LAYOUTS.find((l) => l.id === p.layout) || {}).hint),
      panelAdvanced && p.layout === 'media'
        ? selectField('Lado del retrato', p.media_position, [
          { id: 'left', label: 'A la izquierda' },
          { id: 'right', label: 'A la derecha' },
        ], set('media_position'))
        : null,
      selectField('Anclaje', p.position, ANCHORS, setAndRebuild('position')),
      panelAdvanced ? numberField('Desplazamiento X', p.offset_x, { min: -4000, max: 4000, suffix: 'px' }, setAndRebuild('offset_x')) : null,
      panelAdvanced ? numberField('Desplazamiento Y', p.offset_y, { min: -4000, max: 4000, suffix: 'px' }, setAndRebuild('offset_y')) : null,
      panelAdvanced ? numberField('Ancho fijo', p.width, { min: 0, max: 1600, suffix: 'px' }, set('width'), '0 = se ajusta al contenido') : null,
      rangeField('Escala', p.scale, { min: 40, max: 250, suffix: '%' }, set('scale')),
      rangeField('Opacidad', p.opacity, { min: 10, max: 100, suffix: '%' }, set('opacity')),
    ], { columns: 3 }));

    if (panelAdvanced) page.appendChild(group('Rotación automática', [
      numberField('Cambiar de página cada', p.rotate_seconds, { min: 0, max: 600, suffix: 's' }, set('rotate_seconds'),
        '0 deja fija la primera página'),
      selectField('Transición', p.transition, PANEL_TRANSITIONS, set('transition')),
      toggleField('Puntos de página', p.show_page_dots, set('show_page_dots')),
    ], {
      columns: 3,
      note: 'Con dos o más páginas, el panel va enseñando una tras otra. El atajo «Pasar de página» las adelanta a mano.',
    }));

    if (panelAdvanced) page.appendChild(group('Controles del panel', [
      buttonRow([
        { label: '+ Añadir control', onClick: () => {
          if (p.controls.length >= 8) return flash('Máximo de 8 controles por panel');
          p.controls.push(normalizePanelControl({ label: `Control ${p.controls.length + 1}` }));
          apply();
          render();
        } },
      ]),
    ], {
      note: 'Añade botones + y − propios de este panel. Cada control puede usar un contador, cantidad y atajos diferentes.',
    }));
    if (panelAdvanced) for (let i = 0; i < p.controls.length; i++) {
      page.appendChild(panelControlCard(p.controls[i], p, i));
    }

    if (panelAdvanced) page.appendChild(group('Colores y tipografía', [
      colorField('Acento', p.color, set('color')),
      colorField('Color de los valores', p.text_color, set('text_color')),
      colorField('Color de las etiquetas', p.label_color, set('label_color')),
      colorField('Color del fondo', p.backdrop_color, set('backdrop_color')),
      rangeField('Opacidad del fondo', p.backdrop_opacity, { min: 0, max: 100, suffix: '%' }, set('backdrop_opacity')),
      rangeField('Brillo', p.glow, { min: 0, max: 100, suffix: '%' }, set('glow')),
      numberField('Radio de esquinas', p.corner_radius, { min: 0, max: 40, suffix: 'px' }, set('corner_radius')),
      toggleField('Borde', p.border, set('border')),
      selectField('Tipografía', p.font_family, FONT_FAMILIES, set('font_family')),
      numberField('Tamaño del título', p.title_size, { min: 8, max: 40, suffix: 'px' }, set('title_size')),
      numberField('Tamaño de etiquetas', p.label_size, { min: 8, max: 40, suffix: 'px' }, set('label_size')),
      numberField('Tamaño de valores', p.value_size, { min: 10, max: 120, suffix: 'px' }, set('value_size')),
      toggleField('Mostrar títulos', p.show_title, set('show_title')),
      toggleField('Etiquetas en mayúsculas', p.uppercase_labels, set('uppercase_labels')),
    ], { columns: 3 }));

    // --- pages of this panel
    const tabs = el('div', 'page-tabs');
    p.pages.forEach((pg, i) => {
      const tab = el('button', 'page-tab', pg.title || `Página ${i + 1}`);
      tab.type = 'button';
      tab.dataset.active = String(i === selectedPage);
      tab.addEventListener('click', () => {
        selectedPage = i;
        render();
      });
      tabs.appendChild(tab);
    });
    const addPage = el('button', 'page-tab add', '+ Página');
    addPage.type = 'button';
    addPage.addEventListener('click', () => {
      if (p.pages.length >= 12) return flash('Máximo de 12 páginas');
      p.pages.push({ title: `Página ${p.pages.length + 1}`, items: [] });
      selectedPage = p.pages.length - 1;
      if (!p.rotate_seconds) p.rotate_seconds = 8;
      apply();
      render();
    });
    tabs.appendChild(addPage);

    const current = p.pages[selectedPage];
    const pageBox = el('section', 'field-group');
    pageBox.appendChild(el('h4', 'field-group-title', 'Páginas del panel'));
    pageBox.appendChild(el('p', 'field-group-note', 'Crea una página vacía o duplica la actual para reutilizar sus datos y modificarla sin empezar de cero.'));
    pageBox.appendChild(tabs);
    const pageGrid = el('div', 'field-grid cols-2');
    pageGrid.style.marginTop = '12px';
    pageGrid.appendChild(textField('Título de la página', current.title, { maxlength: 32 }, (v) => {
      current.title = v;
      apply();
      schedulePanelPreview(p);
    }));
    pageGrid.appendChild(selectField('Añadir página preparada', '', [
      { id: '', label: 'Elige una plantilla…' },
      ...allTemplates().map((template) => ({ id: template.id, label: template.label })),
    ], (templateId) => {
      const template = allTemplates().find((candidate) => candidate.id === templateId);
      if (template) appendTemplatePage(template, selectedPanel);
    }, 'Crea la página y sus contadores automáticamente'));
    pageGrid.appendChild(buttonRow([
      selectedPage > 0 ? { label: '↑ Página', title: 'Mover página arriba', onClick: () => {
        p.pages.splice(selectedPage - 1, 0, p.pages.splice(selectedPage, 1)[0]);
        selectedPage -= 1;
        apply();
        render();
      } } : null,
      selectedPage < p.pages.length - 1 ? { label: '↓ Página', title: 'Mover página abajo', onClick: () => {
        p.pages.splice(selectedPage + 1, 0, p.pages.splice(selectedPage, 1)[0]);
        selectedPage += 1;
        apply();
        render();
      } } : null,
      { label: '+ Añadir dato', onClick: () => {
        if (current.items.length >= 10) return flash('Máximo de 10 datos por página');
        current.items.push({ ...DEFAULT_PANEL_ITEM });
        apply();
        render();
      } },
      { label: 'Duplicar página', onClick: () => {
        if (p.pages.length >= 12) return flash('Máximo de 12 páginas');
        const copy = deepCopy(current);
        copy.title = `${current.title || `Página ${selectedPage + 1}`} copia`;
        p.pages.splice(selectedPage + 1, 0, copy);
        selectedPage += 1;
        if (!p.rotate_seconds) p.rotate_seconds = 8;
        apply();
        render();
      } },
      p.pages.length > 1 ? { label: 'Eliminar página', variant: 'danger', onClick: () => {
        p.pages.splice(selectedPage, 1);
        selectedPage = Math.max(0, selectedPage - 1);
        apply();
        render();
      } } : null,
    ].filter(Boolean)));
    pageBox.appendChild(pageGrid);
    page.appendChild(pageBox);

    for (let i = 0; i < current.items.length; i++) {
      page.appendChild(itemCard(current.items[i], current, i, p));
    }
    if (!current.items.length) {
      page.appendChild(el('p', 'empty-note', 'Esta página está vacía. Añade un dato arriba.'));
    }

    page.appendChild(group('Acciones', [
      buttonRow([
        { label: 'Duplicar panel', onClick: () => {
          if (list.length >= 16) return flash('Máximo de 16 paneles');
           const copy = deepCopy(p);
           copy.id = '';
           copy.label = `${p.label} copia`;
           copy.controls = (copy.controls || []).map((control) => ({ ...control, id: '' }));
           list.splice(selectedPanel + 1, 0, normalizePanel(copy));
          selectedPanel += 1;
          apply();
          render();
        } },
        { label: 'Eliminar panel', variant: 'danger', onClick: () => {
          list.splice(selectedPanel, 1);
          selectedPanel = Math.max(0, selectedPanel - 1);
          apply();
          render();
        } },
      ]),
    ]));

    queueMicrotask(() => mountPreview(previewBox, p));
    return page;
  }

  const BUILDERS = {
    home: pageHome,
    general: pageGeneral,
    data: pageData,
    control: pageControl,
    design: pageDesign,
    advanced: pageAdvanced,
    trackers: pageTrackers,
    panels: pagePanels,
    timers: pageTimers,
    stopwatch: pageStopwatch,
    crosshair: pageCrosshair,
    scoreboard: pageScoreboard,
    hotkeys: pageHotkeys,
    help: pageHelp,
  };

  function render() {
    const preserveScroll = renderedPage === currentPage;
    const scrollTop = pagesEl.scrollTop;
    capture.cancel();
    if (preview) {
      preview.stop();
      preview = null;
    }
    if (panelPreview) {
      panelPreview.destroy();
      panelPreview = null;
    }
    for (const instance of templatePreviews) instance.destroy();
    templatePreviews = [];
    clearTimeout(panelPreviewTimer);
    renderTabs();
    pagesEl.innerHTML = '';
    pagesEl.appendChild((BUILDERS[currentPage] || pageGeneral)());
    renderedPage = currentPage;
    pagesEl.scrollTop = preserveScroll ? scrollTop : 0;
  }

  panel.querySelector('.settings-close').addEventListener('click', () => onCloseRequest());
  panel.querySelector('.settings-exit').addEventListener('click', async () => {
    try {
      await options.onExitApp?.();
    } catch (error) {
      flash('No se pudo cerrar la aplicación');
      console.error(error);
    }
  });
  panel.querySelector('.settings-save').addEventListener('click', async () => {
    const button = panel.querySelector('.settings-save');
    button.disabled = true;
    button.textContent = 'Guardando…';
    try {
      await onSave();
      flash('Ajustes guardados');
    } catch (error) {
      flash('No se pudo guardar');
      console.error(error);
    } finally {
      button.disabled = false;
      button.textContent = 'Guardar';
    }
  });

  return {
    render,
    goTo,
    syncRuntimeState(state) {
      if (state.match_timers) Object.assign(draft.match_timers, state.match_timers);
      if (state.stopwatch) draft.stopwatch.scale = state.stopwatch.scale;
      if (state.scoreboard) draft.scoreboard.scale = state.scoreboard.scale;
      if (Array.isArray(state.countdowns)) {
        state.countdowns.forEach((timer, index) => {
          if (draft.countdowns[index] && timer) draft.countdowns[index].scale = timer.scale;
        });
      }
      if (state.stats && Array.isArray(state.stats.panels)) {
        for (const panel of state.stats.panels) {
          const local = draft.stats.panels.find((item) => item.id === panel.id);
          if (local) local.scale = panel.scale;
        }
      }
      if (state.scoreboard) {
        for (const player of [1, 2]) {
          const key = `player${player}_score`;
          draft.scoreboard[key] = state.scoreboard[key];
          const output = panel.querySelector(`[data-score-player="${player}"]`);
          if (output) {
            output.value = String(state.scoreboard[key]);
            output.textContent = String(state.scoreboard[key]);
          }
        }
      }
    },
    stopPreview() {
      if (preview) preview.stop();
      preview = null;
      if (panelPreview) panelPreview.destroy();
      panelPreview = null;
      clearTimeout(panelPreviewTimer);
    },
    flash,
  };
}
