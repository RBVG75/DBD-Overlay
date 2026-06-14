import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const display = {
  minutes: document.getElementById('minutes'),
  seconds: document.getElementById('seconds'),
  centiseconds: document.getElementById('centiseconds'),
};

const statusText = document.getElementById('status-text');
const statusEl = document.getElementById('status');

const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const btnSettings = document.getElementById('btn-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnLock = document.getElementById('btn-lock');
const btnAddCountdown = document.getElementById('btn-add-countdown');
const countdownImageInput = document.getElementById('countdown-image-input');

const settingsPanel = document.getElementById('settings-panel');
const fontSizeInput = document.getElementById('font-size');
const accentColorInput = document.getElementById('accent-color');

const hotkeyDisplays = {
  start: document.getElementById('hotkey-start-display'),
  pause: document.getElementById('hotkey-pause-display'),
  reset: document.getElementById('hotkey-reset-display'),
  toggle: document.getElementById('hotkey-toggle-display'),
  settings: document.getElementById('hotkey-settings-display'),
  lock: document.getElementById('hotkey-lock-display'),
};

const hotkeyPickers = document.querySelectorAll('.hotkey-picker');

const scaleX = window.screen.width / 1920;
const scaleY = window.screen.height / 1080;
const scale = Math.min(scaleX, scaleY, 1.8);
document.documentElement.style.setProperty('--scale', scale);

const scoreState = {
  player1: { name: 'Player 1', score: 0 },
  player2: { name: 'Player 2', score: 0 },
  matchTitle: '',
};

const player1ScoreEl = document.getElementById('player1-score');
const player2ScoreEl = document.getElementById('player2-score');
const player1NameEl = document.getElementById('player1-name');
const player2NameEl = document.getElementById('player2-name');
const matchTitleEl = document.getElementById('match-title');

function updateScoreDisplay() {
  player1ScoreEl.textContent = scoreState.player1.score;
  player2ScoreEl.textContent = scoreState.player2.score;
}

function incrementScore(player) {
  scoreState[player].score++;
  updateScoreDisplay();
}

function decrementScore(player) {
  if (scoreState[player].score > 0) {
    scoreState[player].score--;
    updateScoreDisplay();
  }
}

player1ScoreEl.addEventListener('click', (e) => {
  e.preventDefault();
  incrementScore('player1');
});

player1ScoreEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  decrementScore('player1');
});

player2ScoreEl.addEventListener('click', (e) => {
  e.preventDefault();
  incrementScore('player2');
});

player2ScoreEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  decrementScore('player2');
});

player1NameEl.addEventListener('input', () => {
  scoreState.player1.name = player1NameEl.value;
});

player2NameEl.addEventListener('input', () => {
  scoreState.player2.name = player2NameEl.value;
});

matchTitleEl.addEventListener('input', () => {
  scoreState.matchTitle = matchTitleEl.value;
});

let elapsedMs = 0;
let running = false;
let startTime = 0;
let stopwatchFrameId = null;
let lastDisplayValue = '';
let locked = false;

const hotkeyState = {
  start: 'Ctrl+Shift+F1',
  pause: 'Ctrl+Shift+F2',
  reset: 'Ctrl+Shift+F3',
  toggle: 'Ctrl+Shift+F4',
  settings: 'Ctrl+Shift+F5',
  lock: 'F6',
};

let activePicker = null;
let pressedKeys = new Set();
let lastHotkeyString = '';

const CIRCUMFERENCE = 2 * Math.PI * 52;
let countdownConfigs = [];
let countdowns = [];
let rafId = null;
let imagePickerIdx = -1;

const DEFAULT_COUNTDOWN = { hotkey: 'J', seconds: 15, line_width: 4, line_color: '#00ff88', image: '' };
const MAX_IMAGE_SIZE = 256;

function formatTime(ms) {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return {
    minutes: String(min).padStart(2, '0'),
    seconds: String(sec).padStart(2, '0'),
    centiseconds: String(cs).padStart(2, '0'),
  };
}

function updateDisplay() {
  const now = running ? elapsedMs + (Date.now() - startTime) : elapsedMs;
  const t = formatTime(now);
  const nextValue = `${t.minutes}:${t.seconds}:${t.centiseconds}`;
  if (nextValue === lastDisplayValue) return;
  lastDisplayValue = nextValue;
  display.minutes.textContent = t.minutes;
  display.seconds.textContent = t.seconds;
  display.centiseconds.textContent = t.centiseconds;
}

function startStopwatchLoop() {
  if (stopwatchFrameId) return;
  const tick = () => {
    updateDisplay();
    if (!running) {
      stopwatchFrameId = null;
      return;
    }
    stopwatchFrameId = requestAnimationFrame(tick);
  };
  stopwatchFrameId = requestAnimationFrame(tick);
}

function stopStopwatchLoop() {
  if (!stopwatchFrameId) return;
  cancelAnimationFrame(stopwatchFrameId);
  stopwatchFrameId = null;
}

function startTimer() {
  if (running) return;
  running = true;
  startTime = Date.now();
  startStopwatchLoop();
  statusText.textContent = 'RUNNING';
  statusEl.className = 'running';
  invoke('set_status', { status: 'running' }).catch(() => {});
}

function pauseTimer() {
  if (!running) return;
  running = false;
  elapsedMs += Date.now() - startTime;
  stopStopwatchLoop();
  updateDisplay();
  statusText.textContent = 'PAUSED';
  statusEl.className = 'paused';
  invoke('set_status', { status: 'paused' }).catch(() => {});
}

function resetTimer() {
  running = false;
  elapsedMs = 0;
  stopStopwatchLoop();
  updateDisplay();
  statusText.textContent = 'READY';
  statusEl.className = '';
  invoke('set_status', { status: 'ready' }).catch(() => {});
}

function toggleOverlay() {
  invoke('toggle_visibility').catch(() => {});
}

async function toggleSettings() {
  const isVisible = !settingsPanel.classList.contains('hidden');
  if (isVisible) {
    settingsPanel.classList.add('hidden');
    activePicker = null;
    pressedKeys.clear();
    lastHotkeyString = '';
  } else {
    await invoke('disable_clickthrough').catch(() => {});
    renderCountdownSettings();
    settingsPanel.classList.remove('hidden');
    locked = false;
    btnLock.textContent = 'L';
  }
}

function toggleLock() {
  locked = !locked;
  if (locked) {
    invoke('enable_clickthrough').catch(() => {});
    btnLock.textContent = 'U';
    btnLock.title = 'Unlock (click to interact)';
    settingsPanel.classList.add('hidden');
    activePicker = null;
    pressedKeys.clear();
    lastHotkeyString = '';
  } else {
    invoke('disable_clickthrough').catch(() => {});
    btnLock.textContent = 'L';
    btnLock.title = 'Lock (click-through mode)';
  }
}

function buildHotkeyString(keys) {
  const parts = [];
  if (keys.has('Control')) parts.push('Ctrl');
  if (keys.has('Alt')) parts.push('Alt');
  if (keys.has('Shift')) parts.push('Shift');
  if (keys.has('Meta')) parts.push('Win');
  for (const key of keys) {
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      parts.push(key);
    }
  }
  return parts.join('+');
}

function normalizeHotkeyForRust(str) {
  return (str || '')
    .replace(/Ctrl/g, 'Ctrl')
    .replace(/Alt/g, 'Alt')
    .replace(/Shift/g, 'Shift')
    .replace(/Win/g, 'Meta');
}

function clampNumber(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeCountdownConfig(cd = {}) {
  return {
    hotkey: cd.hotkey || '',
    seconds: clampNumber(cd.seconds, 1, 999, 15),
    line_width: clampNumber(cd.line_width, 1, 12, 4),
    line_color: /^#[0-9a-f]{6}$/i.test(cd.line_color || '') ? cd.line_color : '#00ff88',
    image: typeof cd.image === 'string' && cd.image.startsWith('data:image/') ? cd.image : '',
  };
}

function buildCountdownElement(cfg) {
  const { seconds, line_width, line_color, image } = cfg;
  const lw = line_width || 4;
  const lc = line_color || '#00ff88';
  const hasImage = image && image.startsWith('data:');

  const cx = 70, cy = 70;
  const maxRadius = 62;
  const innerRadius = maxRadius - Math.max(0, lw - 4);
  const circ = 2 * Math.PI * innerRadius;

  let imageHtml = '';
  if (hasImage) {
    const imgSize = (innerRadius - 4) * 2;
    const imgX = cx - innerRadius + 4;
    const imgY = cy - innerRadius + 4;
    imageHtml = `<defs>
      <clipPath id="clip-${cfg._uid || ''}"><circle cx="${cx}" cy="${cy}" r="${innerRadius - 4}"/></clipPath>
    </defs>
    <image href="${image}" x="${imgX}" y="${imgY}"
           width="${imgSize}" height="${imgSize}"
           clip-path="url(#clip-${cfg._uid || ''})" preserveAspectRatio="xMidYMid slice"/>`;
  }

  const textClass = hasImage ? 'countdown-text has-image' : 'countdown-text';
  const textY = hasImage ? (cy + 38) : (cy + 1);

  const div = document.createElement('div');
  div.className = 'countdown-item';
  div.innerHTML = `<svg viewBox="0 0 140 140">
    ${imageHtml}
    <circle class="countdown-ring-bg" cx="${cx}" cy="${cy}" r="${innerRadius}"
            stroke-width="${lw}"/>
    <circle class="countdown-ring-fg" cx="${cx}" cy="${cy}" r="${innerRadius}"
            stroke-dasharray="${circ}" stroke-dashoffset="0"
            stroke="${lc}" stroke-width="${lw}"/>
    <text class="${textClass}" x="${cx}" y="${textY}">${seconds}</text>
    ${hasImage ? '' : '<text class="countdown-label" x="' + cx + '" y="' + (cy + 20) + '">s</text>'}
  </svg>`;
  return { element: div, circumference: circ };
}

function updateCountdownDisplay(cd, remaining) {
  const progress = cd.seconds > 0 ? remaining / cd.seconds : 0;
  cd.ringEl.style.strokeDashoffset = cd.circumference * (1 - progress);
  const displaySec = Math.ceil(remaining);
  cd.textEl.textContent = displaySec;
  const warn = remaining <= 10 && remaining > 5;
  const danger = remaining <= 5;
  const warnColor = '#ffaa00';
  const dangerColor = '#ff4466';
  cd.ringEl.classList.toggle('warning', warn);
  cd.ringEl.classList.toggle('danger', danger);
  if (danger) {
    cd.ringEl.style.stroke = dangerColor;
  } else if (warn) {
    cd.ringEl.style.stroke = warnColor;
  } else {
    cd.ringEl.style.stroke = cd.lineColor;
  }
  cd.textEl.classList.toggle('warning', warn);
  cd.textEl.classList.toggle('danger', danger);
}

function startCountdownLoop() {
  if (rafId) return;
  function tick() {
    const now = performance.now();
    for (let i = countdowns.length - 1; i >= 0; i--) {
      const cd = countdowns[i];
      if (cd.done) {
        if (now - cd.doneAt > 400) {
          cd.element.remove();
          countdowns.splice(i, 1);
        }
        continue;
      }
      const elapsed = (now - cd.startTime) / 1000;
      const remaining = Math.max(0, cd.seconds - elapsed);
      updateCountdownDisplay(cd, remaining);
      if (remaining <= 0) {
        cd.done = true;
        cd.doneAt = now;
        cd.element.classList.add('removing');
      }
    }
    if (countdowns.length === 0) {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
}

function createCountdown(cfg) {
  const seconds = cfg.seconds || 15;
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  cfg._uid = uid;
  const { element, circumference } = buildCountdownElement(cfg);
  document.getElementById('countdowns').appendChild(element);
  const cd = {
    id: uid,
    seconds,
    startTime: performance.now(),
    element,
    ringEl: element.querySelector('.countdown-ring-fg'),
    textEl: element.querySelector('.countdown-text'),
    circumference,
    lineColor: cfg.line_color || '#00ff88',
    done: false,
    doneAt: 0,
  };
  countdowns.push(cd);
  startCountdownLoop();
  return cd;
}

function renderCountdownSettings() {
  const list = document.getElementById('countdown-settings-list');
  list.innerHTML = '';
  countdownConfigs.forEach((cd, idx) => {
    const hasImg = cd.image && cd.image.startsWith('data:');
    const imgBtnClass = hasImg ? 'btn-countdown-image has-image' : 'btn-countdown-image';
    const imgPreview = hasImg
      ? `<img class="countdown-img-preview" src="${cd.image}" alt="" title="Image loaded"/>`
      : '';
    const removeImageButton = hasImg
      ? `<button class="btn-clear-countdown-image" type="button" data-idx="${idx}" title="Remove image">Clear</button>`
      : '';
    const row = document.createElement('div');
    row.className = 'countdown-config-row';
    row.innerHTML = `<div class="countdown-config-top">
      <div class="hotkey-picker" data-target="countdown-${idx}">
        <span class="hotkey-display">${cd.hotkey || 'Click to set'}</span>
        <span class="hotkey-hint">hotkey</span>
      </div>
      <button class="btn-remove-countdown" type="button" data-idx="${idx}" aria-label="Remove countdown">&times;</button>
    </div>
    <div class="countdown-config-bottom">
      <input type="number" class="countdown-seconds-input" value="${cd.seconds}" min="1" max="999" data-idx="${idx}" title="Seconds"/>
      <span class="countdown-config-label">s</span>
      <input type="number" class="countdown-line-width-input" value="${cd.line_width || 4}" min="1" max="12" data-idx="${idx}" title="Line width"/>
      <span class="countdown-config-label">px</span>
      <input type="color" class="countdown-line-color-input" value="${cd.line_color || '#00ff88'}" data-idx="${idx}" title="Line color"/>
      <button class="${imgBtnClass}" data-idx="${idx}" title="Image">${hasImg ? '✓' : '📁'}</button>
      ${imgPreview}
      ${removeImageButton}
    </div>`;
    list.appendChild(row);
  });
  bindCountdownSettingsEvents();
}

function bindCountdownSettingsEvents() {
  document.querySelectorAll('.countdown-seconds-input').forEach((input) => {
    input.addEventListener('change', () => {
      const idx = parseInt(input.dataset.idx, 10);
      countdownConfigs[idx].seconds = clampNumber(input.value, 1, 999, 15);
      input.value = countdownConfigs[idx].seconds;
    });
  });
  document.querySelectorAll('.countdown-line-width-input').forEach((input) => {
    input.addEventListener('change', () => {
      const idx = parseInt(input.dataset.idx, 10);
      countdownConfigs[idx].line_width = clampNumber(input.value, 1, 12, 4);
      input.value = countdownConfigs[idx].line_width;
    });
  });
  document.querySelectorAll('.countdown-line-color-input').forEach((input) => {
    input.addEventListener('change', () => {
      const idx = parseInt(input.dataset.idx, 10);
      countdownConfigs[idx].line_color = input.value;
    });
  });
  document.querySelectorAll('.btn-countdown-image').forEach((btn) => {
    btn.addEventListener('click', () => {
      imagePickerIdx = parseInt(btn.dataset.idx, 10);
      countdownImageInput.click();
    });
  });
  document.querySelectorAll('.btn-clear-countdown-image').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      if (!Number.isInteger(idx) || !countdownConfigs[idx]) return;
      countdownConfigs[idx].image = '';
      renderCountdownSettings();
    });
  });
  document.querySelectorAll('.btn-remove-countdown').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      countdownConfigs.splice(idx, 1);
      if (activePicker) {
        activePicker.classList.remove('active');
        activePicker = null;
        pressedKeys.clear();
        lastHotkeyString = '';
      }
      renderCountdownSettings();
    });
  });
}

function handlePickerClick(picker) {
  if (activePicker === picker) {
    picker.classList.remove('active');
    activePicker = null;
    pressedKeys.clear();
    lastHotkeyString = '';
    return;
  }
  if (activePicker) {
    activePicker.classList.remove('active');
  }
  activePicker = picker;
  pressedKeys.clear();
  lastHotkeyString = '';
  picker.classList.add('active');
  const displayEl = picker.querySelector('.hotkey-display');
  displayEl.textContent = 'Press keys...';
}

document.addEventListener('click', (e) => {
  const picker = e.target.closest('.hotkey-picker');
  if (!picker) return;
  handlePickerClick(picker);
});

document.addEventListener('keydown', (e) => {
  if (!activePicker) return;
  e.preventDefault();

  const key = e.key;
  if (key === 'Escape') {
    const picker = activePicker;
    activePicker = null;
    pressedKeys.clear();
    lastHotkeyString = '';
    if (picker) {
      picker.classList.remove('active');
      const target = picker.dataset.target;
      const displayEl = picker.querySelector('.hotkey-display');
      if (target && displayEl) {
        if (target.startsWith('countdown-')) {
          const idx = parseInt(target.replace('countdown-', ''), 10);
          displayEl.textContent = (countdownConfigs[idx]?.hotkey) || 'Click to set';
        } else {
          const name = target.replace('hotkey-', '');
          displayEl.textContent = hotkeyState[name] || '';
        }
      }
    }
    return;
  }

  if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') {
    pressedKeys.add(key);
  } else if (key !== 'Dead' && key !== 'Process' && key !== 'Unidentified') {
    pressedKeys.add(key);
  }

  const str = buildHotkeyString(pressedKeys);
  lastHotkeyString = str;
  const displayEl = activePicker.querySelector('.hotkey-display');
  if (displayEl) displayEl.textContent = str || 'Press keys...';
});

document.addEventListener('keyup', (e) => {
  if (!activePicker) return;
  e.preventDefault();

  const key = e.key;
  pressedKeys.delete(key);

  if (pressedKeys.size === 0) {
    const target = activePicker.dataset.target;
    if (lastHotkeyString) {
      if (target.startsWith('countdown-')) {
        const idx = parseInt(target.replace('countdown-', ''), 10);
        if (!isNaN(idx) && countdownConfigs[idx]) {
          countdownConfigs[idx].hotkey = lastHotkeyString;
        }
      } else {
        const name = target.replace('hotkey-', '');
        hotkeyState[name] = lastHotkeyString;
      }
      const displayEl = activePicker.querySelector('.hotkey-display');
      if (displayEl) displayEl.textContent = lastHotkeyString;
    }
    activePicker.classList.remove('active');
    activePicker = null;
    lastHotkeyString = '';
  }
});

btnStart.addEventListener('click', startTimer);
btnPause.addEventListener('click', pauseTimer);
btnReset.addEventListener('click', resetTimer);
btnSettings.addEventListener('click', toggleSettings);
btnCloseSettings.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
  activePicker = null;
  pressedKeys.clear();
  lastHotkeyString = '';
});
btnLock.addEventListener('click', toggleLock);

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Unable to read image'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to decode image'));
    img.src = src;
  });
}

async function createOptimizedImageDataUrl(file) {
  const source = await readFileAsDataUrl(file);
  const img = await loadImage(source);
  const ratio = Math.min(MAX_IMAGE_SIZE / img.width, MAX_IMAGE_SIZE / img.height, 1);
  const width = Math.max(1, Math.round(img.width * ratio));
  const height = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  context.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

countdownImageInput.addEventListener('change', async () => {
  const idx = imagePickerIdx;
  imagePickerIdx = -1;

  if (idx < 0 || !countdownConfigs[idx]) {
    countdownImageInput.value = '';
    return;
  }

  const file = countdownImageInput.files?.[0];
  countdownImageInput.value = '';
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    statusText.textContent = 'IMAGE ERROR';
    statusEl.className = 'paused';
    return;
  }

  try {
    countdownConfigs[idx].image = await createOptimizedImageDataUrl(file);
    renderCountdownSettings();
  } catch (error) {
    console.error('Failed to process countdown image:', error);
    statusText.textContent = 'IMAGE ERROR';
    statusEl.className = 'paused';
  }
});

btnSaveSettings.addEventListener('click', async () => {
  btnSaveSettings.disabled = true;
  const originalLabel = btnSaveSettings.textContent;
  btnSaveSettings.textContent = 'Saving...';
  const config = {
    hotkey_start: normalizeHotkeyForRust(hotkeyState.start),
    hotkey_pause: normalizeHotkeyForRust(hotkeyState.pause),
    hotkey_reset: normalizeHotkeyForRust(hotkeyState.reset),
    hotkey_toggle: normalizeHotkeyForRust(hotkeyState.toggle),
    hotkey_settings: normalizeHotkeyForRust(hotkeyState.settings),
    hotkey_lock: normalizeHotkeyForRust(hotkeyState.lock),
    font_size: clampNumber(fontSizeInput.value, 16, 120, 48),
    accent_color: accentColorInput.value,
    scoreboard: {
      player1_name: scoreState.player1.name,
      player1_score: scoreState.player1.score,
      player2_name: scoreState.player2.name,
      player2_score: scoreState.player2.score,
      match_title: scoreState.matchTitle,
    },
    countdowns: countdownConfigs.map((cd) => ({
      hotkey: normalizeHotkeyForRust(cd.hotkey),
      seconds: clampNumber(cd.seconds, 1, 999, 15),
      line_width: clampNumber(cd.line_width, 1, 12, 4),
      line_color: /^#[0-9a-f]{6}$/i.test(cd.line_color || '') ? cd.line_color : '#00ff88',
      image: cd.image || '',
    })),
  };
  try {
    await invoke('save_config', { config });
    applyConfig(config);
    settingsPanel.classList.add('hidden');
    activePicker = null;
    pressedKeys.clear();
    lastHotkeyString = '';
    statusText.textContent = running ? 'RUNNING' : 'READY';
    statusEl.className = running ? 'running' : '';
  } catch (error) {
    console.error('Failed to save config:', error);
    statusText.textContent = 'SAVE ERROR';
    statusEl.className = 'paused';
  } finally {
    btnSaveSettings.disabled = false;
    btnSaveSettings.textContent = originalLabel;
  }
});

function applyConfig(config) {
  if (config.font_size) {
    document.documentElement.style.setProperty('--font-size', `${config.font_size}px`);
    fontSizeInput.value = config.font_size;
  }
  if (config.accent_color) {
    document.documentElement.style.setProperty('--accent', config.accent_color);
    document.documentElement.style.setProperty('--accent-dim', config.accent_color + '4d');
    accentColorInput.value = config.accent_color;
  }
  if (config.hotkey_start) {
    hotkeyState.start = config.hotkey_start;
    hotkeyDisplays.start.textContent = config.hotkey_start;
  }
  if (config.hotkey_pause) {
    hotkeyState.pause = config.hotkey_pause;
    hotkeyDisplays.pause.textContent = config.hotkey_pause;
  }
  if (config.hotkey_reset) {
    hotkeyState.reset = config.hotkey_reset;
    hotkeyDisplays.reset.textContent = config.hotkey_reset;
  }
  if (config.hotkey_toggle) {
    hotkeyState.toggle = config.hotkey_toggle;
    hotkeyDisplays.toggle.textContent = config.hotkey_toggle;
  }
  if (config.hotkey_settings) {
    hotkeyState.settings = config.hotkey_settings;
    hotkeyDisplays.settings.textContent = config.hotkey_settings;
  }
  if (config.hotkey_lock) {
    hotkeyState.lock = config.hotkey_lock;
    hotkeyDisplays.lock.textContent = config.hotkey_lock;
  }
  if (config.countdowns) {
    countdownConfigs = config.countdowns.map(normalizeCountdownConfig);
    renderCountdownSettings();
  }
  if (config.scoreboard) {
    scoreState.player1.name = config.scoreboard.player1_name || 'Player 1';
    scoreState.player1.score = clampNumber(config.scoreboard.player1_score, 0, 999, 0);
    scoreState.player2.name = config.scoreboard.player2_name || 'Player 2';
    scoreState.player2.score = clampNumber(config.scoreboard.player2_score, 0, 999, 0);
    scoreState.matchTitle = config.scoreboard.match_title || '';
    player1NameEl.value = scoreState.player1.name;
    player2NameEl.value = scoreState.player2.name;
    matchTitleEl.value = scoreState.matchTitle;
    updateScoreDisplay();
  }
}

async function loadConfig() {
  try {
    const config = await invoke('load_config');
    if (config) {
      applyConfig(config);
      if (!config.countdowns || config.countdowns.length === 0) {
        countdownConfigs = [{ ...DEFAULT_COUNTDOWN }];
        renderCountdownSettings();
      }
    }
  } catch (e) {
    console.error('Failed to load config:', e);
    countdownConfigs = [{ ...DEFAULT_COUNTDOWN }];
    renderCountdownSettings();
  }
}

function toggleStartPause() {
  if (running) {
    pauseTimer();
  } else {
    startTimer();
  }
}

listen('hotkey-start', () => toggleStartPause());
listen('hotkey-pause', () => pauseTimer());
listen('hotkey-reset', () => resetTimer());
listen('hotkey-toggle', () => toggleOverlay());
listen('hotkey-settings', () => toggleSettings());
listen('hotkey-lock', () => toggleLock());
listen('tray-show', () => {
  invoke('show_window').catch(() => {});
});
listen('tray-hide', () => {
  invoke('hide_window').catch(() => {});
});

listen('countdown-trigger', (event) => {
  const payload = event.payload;
  const cfg = typeof payload === 'object' ? payload : { seconds: payload || 15 };
  createCountdown({
    seconds: cfg.seconds || 15,
    line_width: cfg.line_width || 4,
    line_color: cfg.line_color || '#00ff88',
    image: cfg.image || '',
  });
});

btnAddCountdown.addEventListener('click', () => {
  countdownConfigs.push(normalizeCountdownConfig({ seconds: 30 }));
  renderCountdownSettings();
});

loadConfig();
updateDisplay();
