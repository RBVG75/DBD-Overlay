// Runtime for the countdown timers: anchors, spawning, the animation loop and
// the end-of-timer behaviours.

import { ANCHOR_IDS } from './defaults.js';
import { createTimerView } from './timer-render.js';
import { formatClock } from './utils.js';

// --- tiny WebAudio helper so alerts need no bundled files -------------------

let audioCtx = null;
function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function tone(freq, duration, volume, type = 'sine', delay = 0) {
  const ac = ctx();
  if (!ac || volume <= 0) return;
  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export function playSound(name, volumePct) {
  const v = Math.max(0, Math.min(1, volumePct / 100)) * 0.35;
  if (!v) return;
  switch (name) {
    case 'beep': tone(880, 0.18, v, 'sine'); break;
    case 'double': tone(880, 0.12, v, 'sine'); tone(1180, 0.14, v, 'sine', 0.16); break;
    case 'chime': tone(1320, 0.5, v * 0.8, 'sine'); tone(1980, 0.45, v * 0.4, 'sine', 0.05); break;
    case 'alarm':
      for (let i = 0; i < 4; i++) tone(i % 2 ? 760 : 1020, 0.11, v, 'square', i * 0.14);
      break;
    case 'blip': tone(320, 0.14, v, 'triangle'); break;
    default: break;
  }
}

// ---------------------------------------------------------------------------

// A slot wrapper carries the per-timer offset so the timer element keeps its
// own transform free for the appear/pulse animations.
function createSlot(cfg) {
  const slot = document.createElement('div');
  slot.className = 'timer-slot';
  const [vertical, horizontal] = cfg.position.split('-');
  const dx = horizontal === 'right' ? -cfg.offset_x : cfg.offset_x;
  const dy = vertical === 'bottom' ? -cfg.offset_y : cfg.offset_y;
  slot.style.transform = `translate(${dx}px, ${dy}px)`;
  return slot;
}

export function createTimerEngine(layer) {
  const anchors = new Map();
  for (const id of ANCHOR_IDS) {
    const el = document.createElement('div');
    el.className = 'timer-anchor';
    el.dataset.anchor = id;
    layer.appendChild(el);
    anchors.set(id, el);
  }

  let configs = [];
  const active = [];
  let raf = null;

  function setConfigs(list) {
    configs = list;
    for (const anchor of anchors.values()) anchor.dataset.stack = 'column';
  }

  function phaseOf(cfg, remaining) {
    if (remaining <= cfg.danger_at) return 'danger';
    if (remaining <= cfg.warn_at) return 'warning';
    return 'normal';
  }

  function colorOf(cfg, phase) {
    if (phase === 'danger') return cfg.danger_color;
    if (phase === 'warning') return cfg.warn_color;
    return cfg.color;
  }

  function textOf(cfg, remaining, elapsed, p) {
    if (cfg.text_format === 'none') return '';
    if (cfg.text_format === 'percent') return `${Math.round(p * 100)}%`;
    const value = cfg.count_up ? elapsed : remaining;
    return formatClock(value, cfg.text_format, cfg.decimals);
  }

  function spawn(cfg) {
    if (!cfg) return null;
    if (!cfg.allow_multiple) {
      const existing = active.find((t) => t.cfg === cfg && !t.finished);
      if (existing) {
        existing.start = performance.now();
        existing.finished = false;
        existing.view.el.classList.remove('is-over', 'removing');
        return existing;
      }
    }

    const view = createTimerView(cfg);
    const anchor = anchors.get(cfg.position) || anchors.get('mid-left');
    anchor.dataset.stack = cfg.stack;
    const slot = createSlot(cfg);
    slot.appendChild(view.el);
    anchor.appendChild(slot);

    const entry = {
      cfg,
      view,
      slot,
      start: performance.now(),
      finished: false,
      finishedAt: 0,
      lastTick: -1,
    };
    active.push(entry);
    loop();
    return entry;
  }

  function trigger(index) {
    return spawn(configs[index]);
  }

  function preview(cfg) {
    return spawn(cfg);
  }

  function removeEntry(entry) {
    const i = active.indexOf(entry);
    if (i >= 0) active.splice(i, 1);
    entry.view.destroy();
    entry.slot.remove();
  }

  function clearAll() {
    while (active.length) removeEntry(active[0]);
  }

  function tickEntry(entry, now) {
    const { cfg, view } = entry;
    const total = cfg.seconds;
    const elapsedRaw = (now - entry.start) / 1000;
    const elapsed = Math.min(total, Math.max(0, elapsedRaw));
    const remaining = Math.max(0, total - elapsedRaw);
    const p = total > 0 ? (cfg.direction === 'fill' ? elapsed / total : remaining / total) : 0;
    const phase = phaseOf(cfg, remaining);

    if (cfg.tick_sound && !entry.finished) {
      const whole = Math.ceil(remaining);
      if (whole !== entry.lastTick && whole <= 3 && whole > 0) {
        entry.lastTick = whole;
        playSound('blip', cfg.volume);
      }
    }

    view.update({
      total,
      remaining,
      elapsed,
      p,
      phase,
      color: colorOf(cfg, phase),
      text: textOf(cfg, remaining, elapsed, p),
      now,
    });

    if (remaining > 0 || entry.finished) return;

    entry.finished = true;
    entry.finishedAt = now;
    if (cfg.sound !== 'none') playSound(cfg.sound, cfg.volume);

    switch (cfg.on_end) {
      case 'repeat':
        entry.start = now;
        entry.finished = false;
        entry.lastTick = -1;
        break;
      case 'keep':
        view.el.classList.add('is-over');
        break;
      case 'blink':
        view.el.classList.add('is-over', 'blinking');
        break;
      case 'remove':
      default:
        view.el.classList.add('removing');
        break;
    }
  }

  function loop() {
    if (raf) return;
    const step = () => {
      const now = performance.now();
      for (let i = active.length - 1; i >= 0; i--) {
        const entry = active[i];
        if (entry.finished && entry.cfg.on_end === 'remove') {
          if (now - entry.finishedAt > 380) removeEntry(entry);
          continue;
        }
        tickEntry(entry, now);
      }
      if (!active.length) {
        raf = null;
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  return {
    setConfigs,
    trigger,
    preview,
    clearAll,
    get activeCount() {
      return active.length;
    },
  };
}
