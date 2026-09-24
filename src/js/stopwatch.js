// Stopwatch widget: display, laps, and the visual options from settings.

import { FONT_MAP } from './defaults.js';
import { formatStopwatch, rgba } from './utils.js';

const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;

export function createStopwatch({ root, onStatusChange }) {
  const ring = root.querySelector('.sw-ring-fg');
  const displayEl = root.querySelector('.sw-display');
  const lapsEl = root.querySelector('.sw-laps');
  const statusEl = root.querySelector('.sw-status');
  const statusText = root.querySelector('.sw-status-text');
  const controlsEl = root.querySelector('.sw-controls');

  let cfg = null;
  let elapsed = 0;
  let running = false;
  let startedAt = 0;
  let frame = null;
  let lastRendered = '';
  const laps = [];
  let parts = null;

  function buildDisplay() {
    displayEl.innerHTML = '';
    const nodes = [];
    const count = cfg.show_hours ? 3 : 2;
    for (let i = 0; i < count; i++) {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'sw-sep';
        sep.textContent = ':';
        displayEl.appendChild(sep);
      }
      const span = document.createElement('span');
      span.className = 'sw-part';
      span.textContent = '00';
      displayEl.appendChild(span);
      nodes.push(span);
    }
    let fraction = null;
    if (cfg.show_centiseconds || cfg.show_milliseconds) {
      const dot = document.createElement('span');
      dot.className = 'sw-sep sw-sep-dot';
      dot.textContent = '.';
      displayEl.appendChild(dot);
      fraction = document.createElement('span');
      fraction.className = 'sw-frac';
      fraction.textContent = cfg.show_milliseconds ? '000' : '00';
      displayEl.appendChild(fraction);
    }
    parts = { nodes, fraction };
    lastRendered = '';
  }

  function render() {
    const value = running ? elapsed + (performance.now() - startedAt) : elapsed;
    const { main, fraction } = formatStopwatch(value, {
      showHours: cfg.show_hours,
      showCentiseconds: cfg.show_centiseconds,
      showMilliseconds: cfg.show_milliseconds,
    });
    const key = main.join(':') + '.' + fraction;
    if (key !== lastRendered) {
      lastRendered = key;
      for (let i = 0; i < parts.nodes.length; i++) parts.nodes[i].textContent = main[i] ?? '00';
      if (parts.fraction) parts.fraction.textContent = fraction;
    }
    if (cfg.progress_ring && ring) {
      const span = cfg.progress_minutes * 60000;
      const p = span > 0 ? (value % span) / span : 0;
      ring.setAttribute('stroke-dashoffset', (RING_C * (1 - p)).toFixed(2));
    }
  }

  function loop() {
    if (frame) return;
    const step = () => {
      render();
      if (!running) {
        frame = null;
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  function stopLoop() {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = null;
  }

  function setStatus(key, label) {
    statusEl.dataset.state = key;
    statusText.textContent = label;
    root.dataset.state = key;
    if (onStatusChange) onStatusChange(key);
  }

  function start() {
    if (running) return;
    running = true;
    startedAt = performance.now();
    loop();
    setStatus('running', 'EN MARCHA');
  }

  function pause() {
    if (!running) return;
    running = false;
    elapsed += performance.now() - startedAt;
    stopLoop();
    render();
    setStatus('paused', 'EN PAUSA');
  }

  function toggle() {
    if (running) pause();
    else start();
  }

  function reset() {
    running = false;
    elapsed = 0;
    stopLoop();
    laps.length = 0;
    renderLaps();
    render();
    setStatus('ready', 'LISTO');
  }

  function lap() {
    const value = running ? elapsed + (performance.now() - startedAt) : elapsed;
    if (value <= 0) return;
    laps.unshift(value);
    if (laps.length > 20) laps.pop();
    renderLaps();
  }

  function renderLaps() {
    if (!cfg || !cfg.show_laps) {
      lapsEl.classList.add('hidden');
      lapsEl.innerHTML = '';
      return;
    }
    lapsEl.classList.remove('hidden');
    lapsEl.innerHTML = '';
    const visible = laps.slice(0, cfg.lap_count);
    visible.forEach((value, i) => {
      const row = document.createElement('div');
      row.className = 'sw-lap';
      const name = document.createElement('span');
      name.textContent = `V${laps.length - i}`;
      const time = document.createElement('span');
      const { main, fraction } = formatStopwatch(value, {
        showHours: cfg.show_hours,
        showCentiseconds: true,
      });
      time.textContent = `${main.join(':')}.${fraction}`;
      row.append(name, time);
      lapsEl.appendChild(row);
    });
  }

  function applyConfig(next) {
    cfg = next;
    root.dataset.skin = cfg.style;
    root.classList.toggle('hidden', !cfg.visible);
    root.style.setProperty('--sw-font', FONT_MAP[cfg.font_family] || FONT_MAP.mono);
    root.style.setProperty('--sw-size', `${cfg.font_size}px`);
    root.style.setProperty('--sw-weight', cfg.font_weight);
    root.style.setProperty('--sw-color', cfg.color);
    root.style.setProperty('--sw-sep-color', cfg.separator_color);
    root.style.setProperty('--sw-glow', `${(cfg.glow / 100) * 26}px`);
    root.style.setProperty('--sw-surface', rgba('#080a10', cfg.backdrop_opacity / 100));
    root.style.setProperty('--sw-radius', `${cfg.corner_radius}px`);
    root.style.setProperty('--sw-spacing', `${cfg.letter_spacing}px`);
    root.style.opacity = String(cfg.opacity / 100);
    root.classList.toggle('blink-sep', cfg.blink_separator);
    controlsEl.classList.toggle('hidden', !cfg.show_controls);
    statusEl.classList.toggle('hidden', !cfg.show_status);
    if (ring) {
      ring.parentElement.classList.toggle('hidden', !cfg.progress_ring);
      ring.setAttribute('stroke-dasharray', RING_C.toFixed(2));
    }
    buildDisplay();
    renderLaps();
    render();
  }

  return {
    applyConfig,
    start,
    pause,
    toggle,
    reset,
    lap,
    render,
    get running() {
      return running;
    },
  };
}
