// Catalogues of presets plus the default configuration and its normalizers.

import { clampInt, clampNum, hex, isHex } from './utils.js';
import { CATALOG_IDS, catalogEntries } from './catalog.js';
import {
  DEFAULT_GAME_TOOLS, KILLER_PERKS, LEGACY_KILLER_PERKS,
  LEGACY_SURVIVOR_PERKS, SURVIVOR_PERKS,
} from './game-data.js';
import { slugify } from './stats.js';

// ---------------------------------------------------------------------------
// Timer visual styles
// ---------------------------------------------------------------------------

export const TIMER_STYLES = [
  { id: 'ring', label: 'Anillo clásico', group: 'Anillos', hint: 'Círculo que se vacía o se llena' },
  { id: 'ring-minute', label: 'Anillo por minuto', group: 'Anillos', hint: 'La línea se llena con cada minuto' },
  { id: 'ring-dual', label: 'Anillo doble', group: 'Anillos', hint: 'Total fuera, minuto dentro' },
  { id: 'ring-segments', label: 'Anillo segmentado', group: 'Anillos', hint: 'Arco dividido en tramos' },
  { id: 'ring-ticks', label: 'Anillo de marcas', group: 'Anillos', hint: '60 marcas tipo reloj' },
  { id: 'ring-gradient', label: 'Anillo degradado', group: 'Anillos', hint: 'Degradado entre dos colores' },
  { id: 'ring-neon', label: 'Anillo neón', group: 'Anillos', hint: 'Brillo intenso y estela' },
  { id: 'ring-dashed', label: 'Anillo punteado', group: 'Anillos', hint: 'Trazo discontinuo' },
  { id: 'ring-double-track', label: 'Anillo doble pista', group: 'Anillos', hint: 'Dos pistas concéntricas' },
  { id: 'orbit', label: 'Órbita', group: 'Anillos', hint: 'Punto que gira por el borde' },
  { id: 'spiral', label: 'Espiral de minutos', group: 'Anillos', hint: 'Un anillo por cada minuto' },
  { id: 'pie', label: 'Porción', group: 'Sólidos', hint: 'Sector circular relleno' },
  { id: 'gauge', label: 'Medidor', group: 'Sólidos', hint: 'Arco de 240° con aguja' },
  { id: 'liquid', label: 'Líquido', group: 'Sólidos', hint: 'Nivel con oleaje' },
  { id: 'hourglass', label: 'Reloj de arena', group: 'Sólidos', hint: 'Arena que cae' },
  { id: 'radar', label: 'Radar', group: 'Sólidos', hint: 'Barrido giratorio' },
  { id: 'analog', label: 'Reloj analógico', group: 'Sólidos', hint: 'Manecillas de minuto y segundo' },
  { id: 'pulse', label: 'Pulso', group: 'Sólidos', hint: 'Círculo que late' },
  { id: 'bar-h', label: 'Barra horizontal', group: 'Barras', hint: 'Progreso lineal' },
  { id: 'bar-v', label: 'Barra vertical', group: 'Barras', hint: 'Progreso en columna' },
  { id: 'bar-segments', label: 'Barra segmentada', group: 'Barras', hint: 'Bloques que se apagan' },
  { id: 'bar-stepped', label: 'Ecualizador', group: 'Barras', hint: 'Columnas de altura variable' },
  { id: 'dots', label: 'Puntos en línea', group: 'Barras', hint: 'Una fila de puntos' },
  { id: 'dot-grid', label: 'Rejilla de puntos', group: 'Barras', hint: 'Cuadrícula que se apaga' },
  { id: 'blocks', label: 'Bloques apilados', group: 'Barras', hint: 'Pila que baja' },
  { id: 'digital', label: 'Digital', group: 'Texto', hint: 'Solo números' },
  { id: 'lcd', label: 'LCD', group: 'Texto', hint: 'Pantalla con fondo y sombra de dígitos' },
  { id: 'flip', label: 'Flip clock', group: 'Texto', hint: 'Tarjetas de aeropuerto' },
  { id: 'matrix', label: 'Glitch', group: 'Texto', hint: 'Texto con aberración' },
  { id: 'minimal', label: 'Mínimo', group: 'Texto', hint: 'Número desnudo, sin marco' },
];

export const TIMER_STYLE_IDS = TIMER_STYLES.map((s) => s.id);

export const TEXT_FORMATS = [
  { id: 'auto', label: 'Automático' },
  { id: 's', label: 'Segundos (90)' },
  { id: 'm:ss', label: 'M:SS (1:30)' },
  { id: 'mm:ss', label: 'MM:SS (01:30)' },
  { id: 'h:mm:ss', label: 'H:MM:SS' },
  { id: 'percent', label: 'Porcentaje' },
  { id: 'none', label: 'Sin texto' },
];

export const FONT_FAMILIES = [
  { id: 'mono', label: 'Monoespaciada', value: "'JetBrains Mono', 'Cascadia Mono', Consolas, monospace" },
  { id: 'sans', label: 'Sans moderna', value: "'Segoe UI Variable Display', 'Segoe UI', Inter, system-ui, sans-serif" },
  { id: 'condensed', label: 'Condensada', value: "'Bahnschrift', 'Segoe UI Semibold', 'Arial Narrow', sans-serif" },
  { id: 'rounded', label: 'Redondeada', value: "'Nunito', 'Segoe UI', 'Trebuchet MS', sans-serif" },
  { id: 'serif', label: 'Serif', value: "'Georgia', 'Times New Roman', serif" },
  { id: 'impact', label: 'Impacto', value: "'Impact', 'Haettenschweiler', 'Arial Black', sans-serif" },
];

export const FONT_MAP = Object.fromEntries(FONT_FAMILIES.map((f) => [f.id, f.value]));

export const ANCHORS = [
  { id: 'top-left', label: 'Arriba izquierda' },
  { id: 'top-center', label: 'Arriba centro' },
  { id: 'top-right', label: 'Arriba derecha' },
  { id: 'mid-left', label: 'Centro izquierda' },
  { id: 'mid-center', label: 'Centro' },
  { id: 'mid-right', label: 'Centro derecha' },
  { id: 'bottom-left', label: 'Abajo izquierda' },
  { id: 'bottom-center', label: 'Abajo centro' },
  { id: 'bottom-right', label: 'Abajo derecha' },
];

export const ANCHOR_IDS = ANCHORS.map((a) => a.id);

export const BACKDROPS = [
  { id: 'none', label: 'Sin fondo' },
  { id: 'glass', label: 'Cristal' },
  { id: 'solid', label: 'Sólido' },
  { id: 'outline', label: 'Contorno' },
];

export const END_ACTIONS = [
  { id: 'remove', label: 'Desaparecer' },
  { id: 'keep', label: 'Quedarse en 0' },
  { id: 'blink', label: 'Parpadear' },
  { id: 'repeat', label: 'Reiniciar en bucle' },
];

export const SOUNDS = [
  { id: 'none', label: 'Ninguno' },
  { id: 'beep', label: 'Bip' },
  { id: 'double', label: 'Doble bip' },
  { id: 'chime', label: 'Campana' },
  { id: 'alarm', label: 'Alarma' },
  { id: 'blip', label: 'Blip grave' },
];

export const POINTER_TYPES = [
  { id: 'cross', label: 'Cruz' },
  { id: 'dot', label: 'Punto' },
  { id: 'cross-dot', label: 'Cruz con punto' },
  { id: 'circle', label: 'Círculo' },
  { id: 'sniper', label: 'Francotirador' },
  { id: 'star', label: 'Estrella' },
  { id: 'diamond', label: 'Diamante' },
  { id: 'brackets', label: 'Corchetes' },
  { id: 'chevron', label: 'Chevron' },
  { id: 'burst', label: 'Explosión' },
  { id: 'tdot', label: 'T invertida' },
];

export const POINTER_IDS = POINTER_TYPES.map((p) => p.id);

export const STOPWATCH_STYLES = [
  { id: 'glass', label: 'Cristal' },
  { id: 'neon', label: 'Neón' },
  { id: 'lcd', label: 'LCD' },
  { id: 'minimal', label: 'Mínimo' },
  { id: 'cards', label: 'Tarjetas' },
  { id: 'outline', label: 'Contorno' },
];

export const THEMES = [
  { id: 'dbd', label: 'La Niebla (DBD)', accent: '#c52d35', surface: '#100d0d' },
  { id: 'emerald', label: 'Esmeralda', accent: '#00ff88', surface: '#0a0c12' },
  { id: 'cyan', label: 'Cian', accent: '#22d3ee', surface: '#07111a' },
  { id: 'violet', label: 'Violeta', accent: '#a78bfa', surface: '#0e0a1a' },
  { id: 'amber', label: 'Ámbar', accent: '#fbbf24', surface: '#14100a' },
  { id: 'rose', label: 'Rosa', accent: '#fb7185', surface: '#170a0f' },
  { id: 'ice', label: 'Hielo', accent: '#e2e8f0', surface: '#0b0f16' },
];

export const HOTKEY_ACTIONS = [
  { id: 'start', label: 'Iniciar / pausar', hint: 'Alterna el cronómetro' },
  { id: 'swap_player', label: 'Cambiar jugador activo', hint: 'Alterna entre los dos cronómetros' },
  { id: 'pause', label: 'Pausar', hint: 'Solo pausa' },
  { id: 'reset', label: 'Reiniciar', hint: 'Vuelve a cero' },
  { id: 'lap', label: 'Vuelta', hint: 'Guarda una vuelta' },
  { id: 'toggle', label: 'Mostrar / ocultar ventana', hint: 'Oculta toda la superposición' },
  { id: 'settings', label: 'Ajustes', hint: 'Abre este panel' },
  { id: 'lock', label: 'Bloquear clics', hint: 'Modo atravesable' },
  { id: 'crosshair', label: 'Mira', hint: 'Muestra u oculta la mira' },
  { id: 'stopwatch', label: 'Cronómetro', hint: 'Muestra u oculta el cronómetro' },
  { id: 'scoreboard', label: 'Marcador', hint: 'Muestra u oculta el marcador' },
  { id: 'countdowns', label: 'Temporizadores', hint: 'Muestra u oculta los temporizadores' },
  { id: 'panels', label: 'Paneles de info', hint: 'Muestra u oculta los recuadros' },
  { id: 'all', label: 'Todo', hint: 'Muestra u oculta todos los elementos' },
  { id: 'next_page', label: 'Pasar de página', hint: 'Avanza los paneles rotativos' },
  { id: 'session_reset', label: 'Reiniciar sesión', hint: 'Pone a cero los contadores de sesión' },
  { id: 'clear_timers', label: 'Limpiar temporizadores', hint: 'Cancela los activos' },
  { id: 'score1_up', label: 'Punto jugador 1', hint: 'Suma un punto' },
  { id: 'score2_up', label: 'Punto jugador 2', hint: 'Suma un punto' },
  { id: 'score_reset', label: 'Reiniciar marcador', hint: 'Deja el marcador a cero' },
];

export const DEFAULT_HOTKEYS = {
  start: 'F1',
  swap_player: 'F2',
  pause: '',
  reset: 'Ctrl+Shift+F3',
  lap: '',
  toggle: 'Ctrl+Shift+F4',
  settings: 'Ctrl+Shift+F5',
  lock: 'F6',
  crosshair: 'F7',
  stopwatch: 'F8',
  scoreboard: 'F9',
  countdowns: 'F10',
  panels: '',
  all: 'F11',
  next_page: '',
  session_reset: '',
  clear_timers: '',
  score1_up: '',
  score2_up: '',
  score_reset: '',
};

// ---------------------------------------------------------------------------
// Timer defaults
// ---------------------------------------------------------------------------

export const DEFAULT_TIMER = {
  label: 'Temporizador',
  hotkey: '',
  seconds: 60,
  style: 'ring',
  size: 130,
  thickness: 6,
  color: '#c52d35',
  color2: '#b7b1a8',
  track_color: '#eee8e1',
  track_opacity: 12,
  direction: 'drain',
  spin: 'cw',
  start_angle: 0,
  text_format: 'auto',
  decimals: false,
  font_family: 'mono',
  font_size: 24,
  font_weight: 600,
  text_color: '#ffffff',
  show_label: false,
  label_position: 'bottom',
  warn_at: 10,
  danger_at: 5,
  warn_color: '#d99b45',
  danger_color: '#e0524d',
  pulse_on_danger: true,
  shake_on_danger: false,
  glow: 35,
  backdrop: 'none',
  backdrop_color: '#05070c',
  backdrop_opacity: 55,
  corner_radius: 18,
  image: '',
  image_opacity: 100,
  image_blur: 0,
  opacity: 100,
  position: 'mid-left',
  offset_x: 36,
  offset_y: 0,
  stack: 'column',
  on_end: 'remove',
  count_up: false,
  sound: 'none',
  volume: 50,
  tick_sound: false,
  segments: 12,
  show_progress_text: false,
  allow_multiple: true,
  scale: 100,
};

export const TIMER_PRESETS = [
  {
    id: 'minute-ring',
    label: 'Anillo por minuto',
    patch: { style: 'ring-minute', seconds: 300, size: 150, thickness: 7, text_format: 'mm:ss', color: '#00ff88', color2: '#22d3ee', glow: 45 },
  },
  {
    id: 'neon-rush',
    label: 'Neón rápido',
    patch: { style: 'ring-neon', seconds: 15, size: 120, thickness: 5, color: '#22d3ee', glow: 80, pulse_on_danger: true },
  },
  {
    id: 'gauge',
    label: 'Medidor',
    patch: { style: 'gauge', seconds: 90, size: 150, thickness: 9, color: '#fbbf24', text_format: 'mm:ss' },
  },
  {
    id: 'liquid',
    label: 'Líquido',
    patch: { style: 'liquid', seconds: 45, size: 140, color: '#22d3ee', direction: 'fill', backdrop: 'none' },
  },
  {
    id: 'bar',
    label: 'Barra superior',
    patch: { style: 'bar-h', seconds: 60, size: 320, thickness: 12, position: 'top-center', offset_x: 0, offset_y: 70, text_format: 'mm:ss' },
  },
  {
    id: 'flip',
    label: 'Flip clock',
    patch: { style: 'flip', seconds: 120, size: 150, text_format: 'mm:ss', font_family: 'sans' },
  },
];

export function normalizeTimer(raw = {}) {
  const t = { ...DEFAULT_TIMER, ...(raw && typeof raw === 'object' ? raw : {}) };
  const out = {
    label: typeof t.label === 'string' ? t.label.slice(0, 24) : DEFAULT_TIMER.label,
    hotkey: typeof t.hotkey === 'string' ? t.hotkey : '',
    seconds: clampInt(t.seconds, 1, 86400, DEFAULT_TIMER.seconds),
    style: TIMER_STYLE_IDS.includes(t.style) ? t.style : DEFAULT_TIMER.style,
    size: clampInt(t.size, 48, 640, DEFAULT_TIMER.size),
    scale: clampInt(t.scale, 50, 250, DEFAULT_TIMER.scale),
    thickness: clampNum(t.thickness, 1, 40, DEFAULT_TIMER.thickness),
    color: hex(t.color, DEFAULT_TIMER.color),
    color2: hex(t.color2, DEFAULT_TIMER.color2),
    track_color: hex(t.track_color, DEFAULT_TIMER.track_color),
    track_opacity: clampInt(t.track_opacity, 0, 100, DEFAULT_TIMER.track_opacity),
    direction: t.direction === 'fill' ? 'fill' : 'drain',
    spin: t.spin === 'ccw' ? 'ccw' : 'cw',
    start_angle: clampInt(t.start_angle, -360, 360, 0),
    text_format: TEXT_FORMATS.some((f) => f.id === t.text_format) ? t.text_format : DEFAULT_TIMER.text_format,
    decimals: Boolean(t.decimals),
    font_family: FONT_MAP[t.font_family] ? t.font_family : DEFAULT_TIMER.font_family,
    font_size: clampInt(t.font_size, 6, 60, DEFAULT_TIMER.font_size),
    font_weight: clampInt(t.font_weight, 200, 900, DEFAULT_TIMER.font_weight),
    text_color: hex(t.text_color, DEFAULT_TIMER.text_color),
    show_label: Boolean(t.show_label),
    label_position: t.label_position === 'top' ? 'top' : 'bottom',
    warn_at: clampInt(t.warn_at, 0, 3600, DEFAULT_TIMER.warn_at),
    danger_at: clampInt(t.danger_at, 0, 3600, DEFAULT_TIMER.danger_at),
    warn_color: hex(t.warn_color, DEFAULT_TIMER.warn_color),
    danger_color: hex(t.danger_color, DEFAULT_TIMER.danger_color),
    pulse_on_danger: Boolean(t.pulse_on_danger),
    shake_on_danger: Boolean(t.shake_on_danger),
    glow: clampInt(t.glow, 0, 100, DEFAULT_TIMER.glow),
    backdrop: BACKDROPS.some((b) => b.id === t.backdrop) ? t.backdrop : DEFAULT_TIMER.backdrop,
    backdrop_color: hex(t.backdrop_color, DEFAULT_TIMER.backdrop_color),
    backdrop_opacity: clampInt(t.backdrop_opacity, 0, 100, DEFAULT_TIMER.backdrop_opacity),
    corner_radius: clampInt(t.corner_radius, 0, 80, DEFAULT_TIMER.corner_radius),
    image: typeof t.image === 'string' && t.image.startsWith('data:image/') ? t.image : '',
    image_opacity: clampInt(t.image_opacity, 0, 100, DEFAULT_TIMER.image_opacity),
    image_blur: clampInt(t.image_blur, 0, 20, 0),
    opacity: clampInt(t.opacity, 10, 100, DEFAULT_TIMER.opacity),
    position: ANCHOR_IDS.includes(t.position) ? t.position : DEFAULT_TIMER.position,
    offset_x: clampInt(t.offset_x, -2000, 2000, DEFAULT_TIMER.offset_x),
    offset_y: clampInt(t.offset_y, -2000, 2000, DEFAULT_TIMER.offset_y),
    stack: t.stack === 'row' ? 'row' : 'column',
    on_end: END_ACTIONS.some((a) => a.id === t.on_end) ? t.on_end : DEFAULT_TIMER.on_end,
    count_up: Boolean(t.count_up),
    sound: SOUNDS.some((s) => s.id === t.sound) ? t.sound : 'none',
    volume: clampInt(t.volume, 0, 100, DEFAULT_TIMER.volume),
    tick_sound: Boolean(t.tick_sound),
    segments: clampInt(t.segments, 2, 120, DEFAULT_TIMER.segments),
    show_progress_text: Boolean(t.show_progress_text),
    allow_multiple: t.allow_multiple !== false,
  };
  if (out.danger_at > out.warn_at) out.danger_at = out.warn_at;
  return out;
}

// ---------------------------------------------------------------------------
// Stopwatch / scoreboard / crosshair / interface defaults
// ---------------------------------------------------------------------------

export const DEFAULT_STOPWATCH = {
  visible: true,
  style: 'glass',
  font_family: 'mono',
  font_size: 48,
  font_weight: 300,
  color: '#c52d35',
  separator_color: '#7c8698',
  show_hours: false,
  show_centiseconds: true,
  show_milliseconds: false,
  blink_separator: false,
  show_controls: true,
  show_status: true,
  show_laps: false,
  lap_count: 3,
  glow: 40,
  backdrop_opacity: 65,
  corner_radius: 18,
  letter_spacing: 2,
  progress_ring: false,
  progress_minutes: 5,
  position: 'top-right',
  offset_x: 16,
  offset_y: 10,
  opacity: 100,
  scale: 100,
};

export const DEFAULT_SCOREBOARD = {
  visible: true,
  player1_name: 'Jugador 1',
  player1_score: 0,
  player2_name: 'Jugador 2',
  player2_score: 0,
  match_title: '',
  style: 'glass',
  accent1: '#c52d35',
  accent2: '#b7b1a8',
  font_size: 30,
  show_title: true,
  position: 'top-left',
  offset_x: 16,
  offset_y: 10,
  opacity: 100,
  scale: 100,
};

export const DEFAULT_CROSSHAIR = {
  enabled: true,
  pointer_type: 'cross',
  color: '#c52d35',
  size: 14,
  thickness: 2,
  gap: 4,
  opacity: 100,
  outline: true,
  dot: false,
  offset_y: 0,
};

export const SCREEN_MODES = [
  { id: 'monitor', label: 'El monitor actual', hint: 'Cubre la pantalla donde arranca, barra de tareas incluida' },
  { id: 'all', label: 'Todas las pantallas', hint: 'Una sola capa sobre el escritorio completo' },
];

export const DEFAULT_INTERFACE = {
  theme: 'dbd',
  stream_theme: 'azul',
  screen_mode: 'monitor',
  accent_color: '#c52d35',
  ui_scale: 100,
  panel_opacity: 96,
  show_toolbar: true,
  toolbar_position: 'bottom-right',
  reduce_motion: false,
  start_locked: false,
};

export const DEFAULT_MATCH_TIMERS = {
  active_player: 1,
  auto_score: true,
  auto_score_threshold_seconds: 5,
  timers: {
    1: { status: 'stopped', elapsed_ms: 0 },
    2: { status: 'stopped', elapsed_ms: 0 },
  },
};

export const DEFAULT_CONFIG = {
  version: 3,
  hotkeys: { ...DEFAULT_HOTKEYS },
  interface: { ...DEFAULT_INTERFACE },
  game_tools: { ...DEFAULT_GAME_TOOLS },
  stopwatch: { ...DEFAULT_STOPWATCH },
  scoreboard: { ...DEFAULT_SCOREBOARD },
  match_timers: { ...DEFAULT_MATCH_TIMERS },
  crosshair: { ...DEFAULT_CROSSHAIR },
  stats: { session_reset_hotkey: '', trackers: [], panels: [], groups: [], saved_templates: [] },
  countdowns: [
    normalizeTimer({ label: 'Corto', hotkey: 'J', seconds: 15, style: 'ring', color: '#c52d35', offset_y: -80 }),
    normalizeTimer({ label: 'Largo', hotkey: 'K', seconds: 60, style: 'ring-minute', color: '#b7b1a8', text_format: 'mm:ss', offset_y: 80 }),
  ],
};

function normalizeSection(defaults, raw, rules) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const rule = rules[key];
    const value = src[key];
    if (value === undefined) continue;
    if (!rule) {
      out[key] = value;
      continue;
    }
    out[key] = rule(value, defaults[key]);
  }
  return out;
}

const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const str = (v, d) => (typeof v === 'string' ? v : d);
const color = (v, d) => (isHex(v) ? v.toLowerCase() : d);
const intIn = (min, max) => (v, d) => clampInt(v, min, max, d);
const oneOf = (list) => (v, d) => (list.includes(v) ? v : d);

export function normalizeStopwatch(raw) {
  return normalizeSection(DEFAULT_STOPWATCH, raw, {
    visible: bool,
    style: oneOf(STOPWATCH_STYLES.map((s) => s.id)),
    font_family: oneOf(Object.keys(FONT_MAP)),
    font_size: intIn(16, 160),
    font_weight: intIn(100, 900),
    color,
    separator_color: color,
    show_hours: bool,
    show_centiseconds: bool,
    show_milliseconds: bool,
    blink_separator: bool,
    show_controls: bool,
    show_status: bool,
    show_laps: bool,
    lap_count: intIn(1, 10),
    glow: intIn(0, 100),
    backdrop_opacity: intIn(0, 100),
    corner_radius: intIn(0, 40),
    letter_spacing: intIn(-2, 16),
    progress_ring: bool,
    progress_minutes: intIn(1, 120),
    position: oneOf(ANCHOR_IDS),
    offset_x: intIn(-4000, 4000),
    offset_y: intIn(-4000, 4000),
    opacity: intIn(10, 100),
    scale: intIn(50, 250),
  });
}

export function normalizeScoreboard(raw) {
  return normalizeSection(DEFAULT_SCOREBOARD, raw, {
    visible: bool,
    player1_name: (v, d) => (typeof v === 'string' ? v.slice(0, 32) : d),
    player2_name: (v, d) => (typeof v === 'string' ? v.slice(0, 32) : d),
    player1_score: intIn(0, 9999),
    player2_score: intIn(0, 9999),
    match_title: (v, d) => (typeof v === 'string' ? v.slice(0, 48) : d),
    style: oneOf(['glass', 'minimal', 'bars', 'cards']),
    accent1: color,
    accent2: color,
    font_size: intIn(14, 96),
    show_title: bool,
    position: oneOf(ANCHOR_IDS),
    offset_x: intIn(-4000, 4000),
    offset_y: intIn(-4000, 4000),
    opacity: intIn(10, 100),
    scale: intIn(50, 250),
  });
}

export function normalizeCrosshair(raw) {
  return normalizeSection(DEFAULT_CROSSHAIR, raw, {
    enabled: bool,
    pointer_type: oneOf(POINTER_IDS),
    color,
    size: intIn(2, 120),
    thickness: intIn(1, 16),
    gap: intIn(0, 60),
    opacity: intIn(10, 100),
    outline: bool,
    dot: bool,
    offset_y: intIn(-400, 400),
  });
}

const LEGACY_STREAM_THEMES = {
  gojo: 'azul', sukuna: 'rojo', choso: 'violeta', geto: 'plata',
  naoya: 'verde', akaza: 'rosa', kokushibo: 'oro', naruto: 'naranja',
};

const streamTheme = (v, d) => {
  const id = str(v, d);
  return Object.hasOwn(LEGACY_STREAM_THEMES, id) ? LEGACY_STREAM_THEMES[id] : id;
};

export function normalizeInterface(raw) {
  return normalizeSection(DEFAULT_INTERFACE, raw, {
    theme: oneOf(THEMES.map((t) => t.id).concat('custom')),
    stream_theme: streamTheme,
    screen_mode: oneOf(SCREEN_MODES.map((m) => m.id)),
    accent_color: color,
    ui_scale: intIn(60, 200),
    panel_opacity: intIn(50, 100),
    show_toolbar: bool,
    toolbar_position: oneOf(['bottom-right', 'bottom-left', 'top-right', 'top-left']),
    reduce_motion: bool,
    start_locked: bool,
  });
}

function normalizeSelection(value, allowed, fallback) {
  if (!Array.isArray(value)) return [...fallback];
  const selected = new Set(value.filter((item) => typeof item === 'string' && allowed.includes(item)));
  // Each randomizer needs at least one possible result; corrupted or stale
  // configs fall back to the safe default selection instead of a dead control.
  return selected.size ? allowed.filter((item) => selected.has(item)) : [...fallback];
}

function normalizeCustomPerks(value, builtins) {
  if (!Array.isArray(value)) return [];
  const blocked = new Set(builtins.map((name) => name.toLocaleLowerCase('es')));
  const seen = new Set();
  return value
    .filter((name) => typeof name === 'string')
    .map((name) => name.trim().slice(0, 56))
    .filter((name) => {
      const key = name.toLocaleLowerCase('es');
      if (!key || blocked.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 100);
}

export function normalizeGameTools(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const killerIds = catalogEntries('killers').map(({ id }) => id);
  const survivorIds = catalogEntries('survivors').map(({ id }) => id);
  const customKillerPerks = normalizeCustomPerks(src.custom_killer_perks, KILLER_PERKS);
  const customSurvivorPerks = normalizeCustomPerks(src.custom_survivor_perks, SURVIVOR_PERKS);
  const idString = (value, fallback) => (typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value) ? value : fallback);
  const wasOldKillerDefault = Array.isArray(src.killer_perks)
    && src.killer_perks.length === LEGACY_KILLER_PERKS.length
    && LEGACY_KILLER_PERKS.every((perk) => src.killer_perks.includes(perk));
  const wasOldSurvivorDefault = Array.isArray(src.survivor_perks)
    && src.survivor_perks.length === LEGACY_SURVIVOR_PERKS.length
    && LEGACY_SURVIVOR_PERKS.every((perk) => src.survivor_perks.includes(perk));
  return {
    game_mode: idString(src.game_mode, DEFAULT_GAME_TOOLS.game_mode),
    renderer: idString(src.renderer, DEFAULT_GAME_TOOLS.renderer),
    killer_ids: normalizeSelection(src.killer_ids, killerIds, DEFAULT_GAME_TOOLS.killer_ids),
    survivor_ids: normalizeSelection(src.survivor_ids, survivorIds, DEFAULT_GAME_TOOLS.survivor_ids),
    custom_killer_perks: customKillerPerks,
    custom_survivor_perks: customSurvivorPerks,
    killer_perks: wasOldKillerDefault
      ? [...KILLER_PERKS, ...customKillerPerks]
      : normalizeSelection(src.killer_perks, [...KILLER_PERKS, ...customKillerPerks], DEFAULT_GAME_TOOLS.killer_perks),
    survivor_perks: wasOldSurvivorDefault
      ? [...SURVIVOR_PERKS, ...customSurvivorPerks]
      : normalizeSelection(src.survivor_perks, [...SURVIVOR_PERKS, ...customSurvivorPerks], DEFAULT_GAME_TOOLS.survivor_perks),
    perk_count: clampInt(src.perk_count, 1, 6, DEFAULT_GAME_TOOLS.perk_count),
    perk_role: oneOf(['killer', 'survivor', 'mixed'])(src.perk_role, DEFAULT_GAME_TOOLS.perk_role),
    perk_source: oneOf(['pool', 'character'])(src.perk_source, DEFAULT_GAME_TOOLS.perk_source),
  };
}

export function normalizeHotkeys(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const action of HOTKEY_ACTIONS) {
    out[action.id] = str(src[action.id], DEFAULT_HOTKEYS[action.id] ?? '');
  }
  return out;
}

// Version 1 stored flat `hotkey_*` keys, a top-level accent/font size and a
// much smaller countdown shape. Rather than detecting a "legacy file" (and
// risking dropping new fields), merge: modern values always win and legacy
// values only fill the gaps.
export function migrateLegacy(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const legacyHotkeys = {};
  for (const action of HOTKEY_ACTIONS) {
    const value = raw[`hotkey_${action.id}`];
    if (typeof value === 'string') legacyHotkeys[action.id] = value;
  }

  const section = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

  const out = {
    version: Number.isInteger(raw.version) ? raw.version : 1,
    hotkeys: { ...DEFAULT_HOTKEYS, ...section(raw.hotkeys), ...legacyHotkeys },
    interface: { ...DEFAULT_INTERFACE, ...section(raw.interface) },
    game_tools: { ...DEFAULT_GAME_TOOLS, ...section(raw.game_tools) },
    stopwatch: { ...DEFAULT_STOPWATCH, ...section(raw.stopwatch) },
    scoreboard: { ...DEFAULT_SCOREBOARD, ...section(raw.scoreboard) },
    match_timers: { ...DEFAULT_MATCH_TIMERS, ...section(raw.match_timers) },
    crosshair: { ...DEFAULT_CROSSHAIR, ...section(raw.crosshair) },
    stats: { ...DEFAULT_STATS, ...section(raw.stats) },
    countdowns: [],
  };

  if (isHex(raw.accent_color)) {
    out.interface.accent_color = raw.accent_color;
    out.interface.theme = 'custom';
    if (!raw.stopwatch) out.stopwatch.color = raw.accent_color;
  }
  if (!raw.stopwatch && Number.isFinite(raw.font_size)) out.stopwatch.font_size = raw.font_size;

  const list = Array.isArray(raw.countdowns) ? raw.countdowns : [];
  out.countdowns = list.map((cd, index) => {
    const src = cd && typeof cd === 'object' ? cd : {};
    return {
      label: `Temporizador ${index + 1}`,
      ...src,
      thickness: src.thickness ?? src.line_width,
      color: src.color ?? src.line_color,
    };
  });

  return out;
}


// ---------------------------------------------------------------------------
// Stream info panels: trackers (counters) and the panels that display them
// ---------------------------------------------------------------------------

export const TRACKER_KINDS = [
  { id: 'number', label: 'Contador', hint: 'Un número que sube y baja con un atajo' },
  { id: 'winloss', label: 'Victorias / derrotas', hint: 'Lleva V, D, E, porcentaje e historial' },
  { id: 'text', label: 'Texto libre', hint: 'Para el récord mundial, el killer de turno, notas…' },
  { id: 'choice', label: 'Personaje', hint: 'Un killer o superviviente del juego, con su retrato' },
];

export const TRACKER_KIND_IDS = TRACKER_KINDS.map((k) => k.id);

export const PANEL_STYLES = [
  { id: 'card', label: 'Tarjeta', hint: 'Cristal con título y filas' },
  { id: 'tile', label: 'Mosaico', hint: 'Número grande, etiqueta pequeña' },
  { id: 'banner', label: 'Banner', hint: 'Etiqueta a la izquierda, valor a la derecha' },
  { id: 'badge', label: 'Píldora', hint: 'Compacto, de una línea' },
  { id: 'bar', label: 'Franja', hint: 'Barra horizontal para la parte superior' },
  { id: 'neon', label: 'Neón', hint: 'Borde y texto encendidos' },
  { id: 'esports', label: 'Esports', hint: 'Esquinas cortadas y barra de acento' },
  { id: 'outline', label: 'Contorno', hint: 'Solo borde, sin relleno' },
  { id: 'minimal', label: 'Mínimo', hint: 'Sin caja, solo texto' },
  { id: 'terminal', label: 'Terminal', hint: 'Monoespaciada sobre fondo oscuro' },
];

export const PANEL_STYLE_IDS = PANEL_STYLES.map((s) => s.id);

export const PANEL_LAYOUTS = [
  { id: 'vertical', label: 'En columna' },
  { id: 'horizontal', label: 'En fila' },
  { id: 'grid', label: 'En rejilla' },
  { id: 'media', label: 'Retrato al lado', hint: 'El retrato a un lado y el resto de datos apilados al otro' },
];

export const PANEL_TRANSITIONS = [
  { id: 'fade', label: 'Fundido' },
  { id: 'slide-up', label: 'Deslizar hacia arriba' },
  { id: 'slide-left', label: 'Deslizar al lado' },
  { id: 'flip', label: 'Voltear' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'none', label: 'Sin transición' },
];

export const PANEL_TRANSITION_IDS = PANEL_TRANSITIONS.map((t) => t.id);

export const ITEM_SOURCES = [
  { id: 'tracker', label: 'Valor del contador', hint: 'El número o texto actual' },
  { id: 'record', label: 'Récord del contador', hint: 'El mejor valor alcanzado' },
  { id: 'winrate', label: 'Porcentaje de victorias', hint: 'V / partidas de un contador V-D' },
  { id: 'record_pair', label: 'Actual y récord', hint: 'Los dos juntos: 12 · récord 27' },
  { id: 'formula', label: 'Fórmula', hint: 'Por ejemplo: kills / partidas * 100' },
  { id: 'goal', label: 'Objetivo con barra', hint: 'Progreso hacia una meta' },
  { id: 'history', label: 'Últimos resultados', hint: 'Cadena de V y D' },
  { id: 'session_time', label: 'Tiempo de sesión', hint: 'Desde que empezó el directo' },
  { id: 'clock', label: 'Hora actual', hint: 'Reloj del sistema' },
  { id: 'text', label: 'Texto fijo', hint: 'Lo que escribas aquí' },
  { id: 'portrait', label: 'Retrato del personaje', hint: 'La imagen del killer o superviviente elegido' },
];

export const ITEM_SOURCE_IDS = ITEM_SOURCES.map((s) => s.id);

export const EMPHASIS = [
  { id: 'small', label: 'Pequeño' },
  { id: 'normal', label: 'Normal' },
  { id: 'big', label: 'Grande' },
  { id: 'huge', label: 'Enorme' },
];

export const DEFAULT_TRACKER = {
  id: '',
  key: '',
  label: 'Contador',
  kind: 'number',
  value: 0,
  start_value: 0,
  text: '',
  catalog: 'killers',
  choice_id: '',
  wins: 0,
  losses: 0,
  draws: 0,
  history: [],
  record: 0,
  track_record: true,
  step: 1,
  min: 0,
  max: 99999,
  color: '#00ff88',
  reset_on_session: true,
  bump_with: '',
  reset_with: '',
  hotkey_up: '',
  hotkey_down: '',
  hotkey_reset: '',
  hotkey_draw: '',
  hotkey_undo: '',
};

export const DEFAULT_PANEL_ITEM = {
  source: 'tracker',
  tracker_id: '',
  label: '',
  formula: '',
  text: '',
  goal: 10,
  decimals: 0,
  prefix: '',
  suffix: '',
  color: '',
  emphasis: 'normal',
  history_count: 8,
  image_size: 108,
  image_radius: 14,
  show_label: true,
};

export const DEFAULT_PANEL_CONTROL = {
  id: '',
  tracker_id: '',
  label: '',
  step: 1,
  hotkey_up: '',
  hotkey_down: '',
};

export const DEFAULT_PANEL = {
  id: '',
  label: 'Panel',
  visible: true,
  style: 'card',
  layout: 'vertical',
  position: 'top-left',
  offset_x: 16,
  offset_y: 150,
  width: 0,
  scale: 100,
  opacity: 100,
  color: '#00ff88',
  text_color: '#eef2f7',
  label_color: '#8b95a6',
  backdrop_color: '#080a10',
  backdrop_opacity: 65,
  corner_radius: 16,
  glow: 25,
  border: true,
  font_family: 'sans',
  title_size: 12,
  label_size: 11,
  value_size: 28,
  show_title: true,
  uppercase_labels: true,
  rotate_seconds: 0,
  transition: 'fade',
  media_position: 'left',
  show_page_dots: true,
  pages: [{ title: '', items: [] }],
  controls: [],
};

function normalizeItem(raw = {}) {
  const item = { ...DEFAULT_PANEL_ITEM, ...(raw && typeof raw === 'object' ? raw : {}) };
  return {
    source: ITEM_SOURCE_IDS.includes(item.source) ? item.source : 'tracker',
    tracker_id: typeof item.tracker_id === 'string' ? item.tracker_id : '',
    label: typeof item.label === 'string' ? item.label.slice(0, 28) : '',
    formula: typeof item.formula === 'string' ? item.formula.slice(0, 160) : '',
    text: typeof item.text === 'string' ? item.text.slice(0, 120) : '',
    goal: clampInt(item.goal, 1, 99999, 10),
    decimals: clampInt(item.decimals, 0, 3, 0),
    prefix: typeof item.prefix === 'string' ? item.prefix.slice(0, 8) : '',
    suffix: typeof item.suffix === 'string' ? item.suffix.slice(0, 8) : '',
    color: isHex(item.color) ? item.color.toLowerCase() : '',
    emphasis: EMPHASIS.some((e) => e.id === item.emphasis) ? item.emphasis : 'normal',
    history_count: clampInt(item.history_count, 3, 30, 8),
    image_size: clampInt(item.image_size, 32, 420, 108),
    image_radius: clampInt(item.image_radius, 0, 60, 14),
    show_label: item.show_label !== false,
  };
}

let panelControlSeq = 0;
function newPanelControlId() {
  panelControlSeq += 1;
  return `ctl-${Date.now().toString(36)}-${panelControlSeq}`;
}

export function normalizePanelControl(raw = {}) {
  const control = { ...DEFAULT_PANEL_CONTROL, ...(raw && typeof raw === 'object' ? raw : {}) };
  return {
    id: typeof control.id === 'string' && control.id ? control.id : newPanelControlId(),
    tracker_id: typeof control.tracker_id === 'string' ? control.tracker_id : '',
    label: typeof control.label === 'string' ? control.label.slice(0, 28) : '',
    step: clampInt(control.step, 1, 100, 1),
    hotkey_up: typeof control.hotkey_up === 'string' ? control.hotkey_up : '',
    hotkey_down: typeof control.hotkey_down === 'string' ? control.hotkey_down : '',
  };
}

let trackerSeq = 0;
export function newTrackerId() {
  trackerSeq += 1;
  return `trk-${Date.now().toString(36)}-${trackerSeq}`;
}

let panelSeq = 0;
export function newPanelId() {
  panelSeq += 1;
  return `pnl-${Date.now().toString(36)}-${panelSeq}`;
}

export function normalizeTracker(raw = {}, takenKeys = []) {
  const t = { ...DEFAULT_TRACKER, ...(raw && typeof raw === 'object' ? raw : {}) };
  const kind = TRACKER_KIND_IDS.includes(t.kind) ? t.kind : 'number';
  const label = typeof t.label === 'string' && t.label.trim() ? t.label.slice(0, 28) : 'Contador';
  const key = /^[a-z_][a-z0-9_]*$/.test(t.key) && !takenKeys.includes(t.key)
    ? t.key
    : slugify(label, takenKeys);
  const min = clampInt(t.min, -99999, 99999, 0);
  const max = clampInt(t.max, min, 999999, Math.max(min, 99999));
  return {
    id: typeof t.id === 'string' && t.id ? t.id : newTrackerId(),
    key,
    label,
    kind,
    value: clampNum(t.value, min, max, 0),
    start_value: clampNum(t.start_value, min, max, 0),
    text: typeof t.text === 'string' ? t.text.slice(0, 120) : '',
    catalog: CATALOG_IDS.includes(t.catalog) ? t.catalog : 'killers',
    choice_id: typeof t.choice_id === 'string' ? t.choice_id : '',
    wins: clampInt(t.wins, 0, 99999, 0),
    losses: clampInt(t.losses, 0, 99999, 0),
    draws: clampInt(t.draws, 0, 99999, 0),
    history: Array.isArray(t.history) ? t.history.filter((h) => h === 'W' || h === 'L' || h === 'E').slice(0, 30) : [],
    record: clampNum(t.record, 0, 999999, 0),
    track_record: t.track_record !== false,
    step: clampInt(t.step, 1, 1000, 1),
    min,
    max,
    color: hex(t.color, DEFAULT_TRACKER.color),
    reset_on_session: t.reset_on_session !== false,
    bump_with: typeof t.bump_with === 'string' ? t.bump_with : '',
    reset_with: typeof t.reset_with === 'string' ? t.reset_with : '',
    hotkey_up: typeof t.hotkey_up === 'string' ? t.hotkey_up : '',
    hotkey_down: typeof t.hotkey_down === 'string' ? t.hotkey_down : '',
    hotkey_reset: typeof t.hotkey_reset === 'string' ? t.hotkey_reset : '',
    hotkey_draw: typeof t.hotkey_draw === 'string' ? t.hotkey_draw : '',
    hotkey_undo: typeof t.hotkey_undo === 'string' ? t.hotkey_undo : '',
  };
}

export function normalizePanel(raw = {}) {
  const p = { ...DEFAULT_PANEL, ...(raw && typeof raw === 'object' ? raw : {}) };
  const pages = Array.isArray(p.pages) && p.pages.length ? p.pages : DEFAULT_PANEL.pages;
  return {
    id: typeof p.id === 'string' && p.id ? p.id : newPanelId(),
    label: typeof p.label === 'string' ? p.label.slice(0, 28) : 'Panel',
    visible: p.visible !== false,
    style: PANEL_STYLE_IDS.includes(p.style) ? p.style : 'card',
    layout: PANEL_LAYOUTS.some((l) => l.id === p.layout) ? p.layout : 'vertical',
    position: ANCHOR_IDS.includes(p.position) ? p.position : 'top-left',
    offset_x: clampInt(p.offset_x, -4000, 4000, 16),
    offset_y: clampInt(p.offset_y, -4000, 4000, 150),
    width: clampInt(p.width, 0, 1600, 0),
    scale: clampInt(p.scale, 40, 250, 100),
    opacity: clampInt(p.opacity, 10, 100, 100),
    color: hex(p.color, DEFAULT_PANEL.color),
    text_color: hex(p.text_color, DEFAULT_PANEL.text_color),
    label_color: hex(p.label_color, DEFAULT_PANEL.label_color),
    backdrop_color: hex(p.backdrop_color, DEFAULT_PANEL.backdrop_color),
    backdrop_opacity: clampInt(p.backdrop_opacity, 0, 100, 65),
    corner_radius: clampInt(p.corner_radius, 0, 40, 16),
    glow: clampInt(p.glow, 0, 100, 25),
    border: p.border !== false,
    font_family: FONT_MAP[p.font_family] ? p.font_family : 'sans',
    title_size: clampInt(p.title_size, 8, 40, 12),
    label_size: clampInt(p.label_size, 8, 40, 11),
    value_size: clampInt(p.value_size, 10, 120, 28),
    show_title: p.show_title !== false,
    uppercase_labels: p.uppercase_labels !== false,
    rotate_seconds: clampInt(p.rotate_seconds, 0, 600, 0),
    transition: PANEL_TRANSITION_IDS.includes(p.transition) ? p.transition : 'fade',
    media_position: p.media_position === 'right' ? 'right' : 'left',
    show_page_dots: p.show_page_dots !== false,
    pages: pages.slice(0, 12).map((page) => ({
      title: typeof page?.title === 'string' ? page.title.slice(0, 32) : '',
      items: Array.isArray(page?.items) ? page.items.slice(0, 10).map(normalizeItem) : [],
    })),
    controls: Array.isArray(p.controls) ? p.controls.slice(0, 8).map(normalizePanelControl) : [],
  };
}

/**
 * Normalizes a panel *in place*, keeping the identity of its pages and items.
 *
 * The settings editor holds direct references to a page and to each of its
 * items, so returning fresh objects (as `normalizePanel` does) would orphan
 * those references: the first keystroke in a text field would land on the old
 * object and every one after it would be lost.
 */
export function normalizePanelInto(panel) {
  const next = normalizePanel(panel);
  const pages = Array.isArray(panel.pages) ? panel.pages : [];

  next.pages = next.pages.map((page, i) => {
    const targetPage = pages[i] && typeof pages[i] === 'object' ? pages[i] : {};
    const items = Array.isArray(targetPage.items) ? targetPage.items : [];
    page.items = page.items.map((item, j) => {
      const targetItem = items[j] && typeof items[j] === 'object' ? items[j] : {};
      return Object.assign(targetItem, item);
    });
    return Object.assign(targetPage, page);
  });

  const controls = Array.isArray(panel.controls) ? panel.controls : [];
  next.controls = next.controls.map((control, i) => {
    const targetControl = controls[i] && typeof controls[i] === 'object' ? controls[i] : {};
    return Object.assign(targetControl, control);
  });

  return Object.assign(panel, next);
}

export const DEFAULT_STATS = {
  session_reset_hotkey: '',
  trackers: [],
  panels: [],
  groups: [],
  saved_templates: [],
};

export const DEFAULT_PANEL_GROUP = {
  id: '',
  label: 'Grupo de paneles',
  visible: true,
  panel_ids: [],
};

let panelGroupSeq = 0;
export function newPanelGroupId() {
  panelGroupSeq += 1;
  return `grp-${Date.now().toString(36)}-${panelGroupSeq}`;
}

export function normalizePanelGroup(raw = {}) {
  const group = { ...DEFAULT_PANEL_GROUP, ...(raw && typeof raw === 'object' ? raw : {}) };
  return {
    id: typeof group.id === 'string' && group.id ? group.id : newPanelGroupId(),
    label: typeof group.label === 'string' && group.label.trim()
      ? group.label.slice(0, 28)
      : DEFAULT_PANEL_GROUP.label,
    visible: group.visible !== false,
    panel_ids: Array.isArray(group.panel_ids)
      ? [...new Set(group.panel_ids.filter((id) => typeof id === 'string'))].slice(0, 16)
      : [],
  };
}

export function normalizeStats(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const takenKeys = [];
  const trackers = (Array.isArray(src.trackers) ? src.trackers : []).slice(0, 32).map((t) => {
    const normalized = normalizeTracker(t, takenKeys);
    takenKeys.push(normalized.key);
    return normalized;
  });
  const ids = new Set(trackers.map((t) => t.id));
  for (const t of trackers) {
    if (t.bump_with && !ids.has(t.bump_with)) t.bump_with = '';
    if (t.reset_with && !ids.has(t.reset_with)) t.reset_with = '';
  }
  const panels = (Array.isArray(src.panels) ? src.panels : []).slice(0, 16).map(normalizePanel);
  const panelIds = new Set(panels.map((panel) => panel.id));
  const groups = (Array.isArray(src.groups) ? src.groups : [])
    .map(normalizePanelGroup)
    .map((group) => ({ ...group, panel_ids: group.panel_ids.filter((id) => panelIds.has(id)) }))
    .filter((group) => group.panel_ids.length > 1);
  const grouped = new Set();
  for (const group of groups) {
    group.panel_ids = group.panel_ids.filter((id) => !grouped.has(id));
    group.panel_ids.forEach((id) => grouped.add(id));
  }
  return {
    session_reset_hotkey: typeof src.session_reset_hotkey === 'string' ? src.session_reset_hotkey : '',
    trackers,
    panels,
    groups: groups.filter((group) => group.panel_ids.length > 1),
    saved_templates: Array.isArray(src.saved_templates)
      ? src.saved_templates.slice(0, 12).filter((template) => template && typeof template === 'object' && template.panel)
      : [],
  };
}

// --- ready-made setups -----------------------------------------------------

/**
 * Each template returns the trackers and panels to append. Trackers are created
 * first so panel items can point at their fresh ids.
 */
export const STATS_TEMPLATES = [
  {
    id: 'killer-streak',
    label: 'Killer + racha',
    hint: 'Retrato del killer y, al lado, racha actual, récord personal y récord mundial',
    build(ctx) {
      const games = ctx.games();
      const killer = ctx.make({
        label: 'Killer', kind: 'choice', catalog: 'killers',
        choice_id: catalogEntries('killers')[0].id, reset_on_session: false,
      });
      const streak = ctx.make({
        label: 'Racha', kind: 'number', color: '#fbbf24', track_record: true,
        bump_with: games.id, reset_with: games.id, reset_on_session: false,
      });
      const world = ctx.make({
        label: 'Récord mundial', kind: 'text', text: '—', reset_on_session: false,
      });
      return {
        panels: [normalizePanel({
          label: 'Killer', style: 'card', layout: 'media', media_position: 'left',
          position: 'top-left', offset_y: 150, value_size: 26,
          pages: [{
            title: '',
            items: [
              { source: 'portrait', tracker_id: killer.id, image_size: 120, image_radius: 16, show_label: false },
              { source: 'tracker', tracker_id: killer.id, label: 'Killer', emphasis: 'normal' },
              { source: 'record_pair', tracker_id: streak.id, label: 'Racha actual', emphasis: 'big', color: '#fbbf24' },
              { source: 'tracker', tracker_id: world.id, label: 'Récord mundial', emphasis: 'small' },
            ],
          }],
        })],
      };
    },
  },
  {
    id: 'streak',
    label: 'Racha',
    hint: 'Racha actual, récord personal y récord mundial',
    build(ctx) {
      const games = ctx.games();
      const streak = ctx.make({
        label: 'Racha', kind: 'number', color: '#fbbf24', track_record: true,
        bump_with: games.id, reset_with: games.id, reset_on_session: false,
      });
      const world = ctx.make({ label: 'Récord mundial', kind: 'text', text: '—', reset_on_session: false });
      return {
        panels: [normalizePanel({
          label: 'Racha', style: 'card', position: 'top-left', offset_y: 150, value_size: 34,
          pages: [{
            title: 'Racha',
            items: [
              { source: 'tracker', tracker_id: streak.id, label: 'Racha actual', emphasis: 'huge', color: '#fbbf24' },
              { source: 'record', tracker_id: streak.id, label: 'Récord personal' },
              { source: 'tracker', tracker_id: world.id, label: 'Récord mundial' },
            ],
          }],
        })],
      };
    },
  },
  {
    id: 'winrate',
    label: 'Winrate',
    hint: 'Victorias, derrotas, porcentaje y últimas partidas',
    build(ctx) {
      const games = ctx.games();
      return {
        panels: [normalizePanel({
          label: 'Winrate', style: 'banner', position: 'top-left', offset_y: 150, width: 320,
          pages: [{
            title: 'Sesión',
            items: [
              { source: 'winrate', tracker_id: games.id, label: 'Winrate', emphasis: 'big', decimals: 1, suffix: '%' },
              { source: 'formula', formula: `${games.key}_v`, label: 'Victorias', color: '#00ff88' },
              { source: 'formula', formula: `${games.key}_d`, label: 'Derrotas', color: '#ff4d6a' },
              { source: 'history', tracker_id: games.id, label: 'Últimas', history_count: 8 },
            ],
          }],
        })],
      };
    },
  },
  {
    id: 'killrate',
    label: 'Killrate',
    hint: 'Kills por partida y porcentaje sobre cuatro supervivientes',
    build(ctx) {
      const played = ctx.make({ label: 'Partidas jugadas', kind: 'number', color: '#22d3ee' });
      const kills = ctx.make({ label: 'Kills', kind: 'number', color: '#ff4d6a' });
      return {
        panels: [normalizePanel({
          label: 'Killrate', style: 'tile', position: 'top-left', offset_y: 150,
          pages: [{
            title: 'Killrate',
            items: [
              {
                source: 'formula', formula: `${kills.key} / ${played.key} / 4 * 100`,
                label: 'Killrate', emphasis: 'huge', decimals: 1, suffix: '%',
              },
              { source: 'formula', formula: `${kills.key} / ${played.key}`, label: 'Kills por partida', decimals: 2 },
              { source: 'tracker', tracker_id: kills.id, label: 'Kills totales' },
            ],
          }],
        })],
      };
    },
  },
  {
    id: 'session',
    label: 'Sesión',
    hint: 'Franja superior con tiempo en directo, partidas y winrate',
    build(ctx) {
      const games = ctx.games();
      return {
        panels: [normalizePanel({
          label: 'Sesión', style: 'bar', layout: 'horizontal', position: 'top-center',
          offset_x: 0, offset_y: 0, value_size: 22,
          pages: [{
            title: '',
            items: [
              { source: 'session_time', label: 'En directo' },
              { source: 'formula', formula: games.key, label: 'Partidas' },
              { source: 'winrate', tracker_id: games.id, label: 'Winrate', decimals: 0, suffix: '%' },
              { source: 'clock', label: 'Hora' },
            ],
          }],
        })],
      };
    },
  },
  {
    id: 'goal',
    label: 'Objetivo del día',
    hint: 'Barra de progreso hacia una meta',
    build(ctx) {
      const wins = ctx.make({ label: 'Victorias de hoy', kind: 'number', color: '#00ff88' });
      return {
        panels: [normalizePanel({
          label: 'Objetivo', style: 'esports', position: 'bottom-left', offset_y: 60, width: 300,
          pages: [{
            title: 'Objetivo del día',
            items: [{ source: 'goal', tracker_id: wins.id, label: 'Victorias', goal: 10, emphasis: 'big' }],
          }],
        })],
      };
    },
  },
  {
    id: 'rotating',
    label: 'Panel rotativo',
    hint: 'Tres páginas que se turnan cada ocho segundos',
    build(ctx) {
      const games = ctx.games();
      const streak = ctx.make({
        label: 'Racha en directo', kind: 'number', color: '#fbbf24',
        bump_with: games.id, reset_with: games.id, reset_on_session: false,
      });
      const social = ctx.make({ label: 'Redes', kind: 'text', text: '@tucanal', reset_on_session: false });
      return {
        panels: [normalizePanel({
          label: 'Rotativo', style: 'neon', position: 'bottom-center', offset_y: 40,
          width: 330, rotate_seconds: 8, transition: 'slide-up',
          pages: [
            {
              title: 'Racha',
              items: [{ source: 'record_pair', tracker_id: streak.id, label: 'Racha actual', emphasis: 'huge' }],
            },
            {
              title: 'Sesión',
              items: [
                { source: 'winrate', tracker_id: games.id, label: 'Winrate', emphasis: 'big', decimals: 0, suffix: '%' },
                { source: 'history', tracker_id: games.id, label: 'Últimas partidas', history_count: 10 },
              ],
            },
            {
              title: 'Sígueme',
              items: [
                { source: 'tracker', tracker_id: social.id, label: 'Redes', emphasis: 'big' },
                { source: 'session_time', label: 'En directo' },
              ],
            },
          ],
        })],
      };
    },
  },
];

/**
 * Runs a template against the trackers that already exist. A win/loss counter is
 * shared instead of duplicated, so stacking «Racha» and «Winrate» keeps one set
 * of games rather than two that disagree.
 */
export function buildTemplate(template, existing = []) {
  const taken = existing.map((t) => t.key);
  const created = [];
  const ctx = {
    make(cfg) {
      const tracker = normalizeTracker(cfg, taken);
      taken.push(tracker.key);
      created.push(tracker);
      return tracker;
    },
    games() {
      const found = existing.find((t) => t.kind === 'winloss')
        || created.find((t) => t.kind === 'winloss');
      return found || ctx.make({ label: 'Partidas', kind: 'winloss', color: '#00ff88' });
    },
  };
  const { panels } = template.build(ctx);
  return { trackers: created, panels };
}

export function normalizeConfig(raw) {
  const migrated = migrateLegacy(raw) || {};
  const countdowns = Array.isArray(migrated.countdowns) ? migrated.countdowns : [];
  const matchTimers = migrated.match_timers;
  const migrateOldAutoScoreDefault = migrated.version < 3
    && matchTimers && matchTimers.auto_score_threshold_seconds === 25;
  return {
    version: 3,
    hotkeys: normalizeHotkeys(migrated.hotkeys),
    interface: normalizeInterface(migrated.interface),
    game_tools: normalizeGameTools(migrated.game_tools),
    stopwatch: normalizeStopwatch(migrated.stopwatch),
    scoreboard: normalizeScoreboard(migrated.scoreboard),
    match_timers: normalizeMatchTimers(matchTimers, migrateOldAutoScoreDefault),
    crosshair: normalizeCrosshair(migrated.crosshair),
    stats: normalizeStats(migrated.stats),
    countdowns: countdowns.length
      ? countdowns.slice(0, 24).map(normalizeTimer)
      : DEFAULT_CONFIG.countdowns.map((c) => normalizeTimer(c)),
  };
}

function normalizeMatchTimers(raw, migrateOldDefault = false) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const timers = src.timers && typeof src.timers === 'object' ? src.timers : {};
  return {
    active_player: src.active_player === 2 ? 2 : 1,
    auto_score: bool(src.auto_score, true),
    auto_score_threshold_seconds: intIn(0, 3600)(
      migrateOldDefault ? 5 : src.auto_score_threshold_seconds,
      DEFAULT_MATCH_TIMERS.auto_score_threshold_seconds,
    ),
    timers: Object.fromEntries([1, 2].map((id) => {
      const timer = timers[id] && typeof timers[id] === 'object' ? timers[id] : {};
      return [id, {
        status: ['running', 'paused', 'stopped'].includes(timer.status) ? timer.status : 'stopped',
        elapsed_ms: Math.max(0, Math.min(86_400_000, Number.isFinite(timer.elapsed_ms) ? timer.elapsed_ms : 0)),
      }];
    })),
  };
}
