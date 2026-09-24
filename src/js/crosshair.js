// Centre-screen crosshair. Every shape is drawn with CSS so it stays crisp.

import { POINTER_IDS } from './defaults.js';

export function createCrosshair(root) {
  let cfg = null;

  function applyConfig(next) {
    cfg = next;
    root.dataset.pointer = cfg.pointer_type;
    root.classList.toggle('hidden', !cfg.enabled);
    root.classList.toggle('with-dot', cfg.dot);
    root.classList.toggle('with-outline', cfg.outline);
    root.style.setProperty('--ch-color', cfg.color);
    root.style.setProperty('--ch-size', `${cfg.size}px`);
    root.style.setProperty('--ch-thickness', `${cfg.thickness}px`);
    root.style.setProperty('--ch-gap', `${cfg.gap}px`);
    root.style.setProperty('--ch-offset', `${cfg.offset_y}px`);
    root.style.opacity = String(cfg.opacity / 100);
  }

  return {
    applyConfig,
    toggle() {
      cfg.enabled = !cfg.enabled;
      applyConfig(cfg);
      return cfg.enabled;
    },
    setEnabled(value) {
      cfg.enabled = value;
      applyConfig(cfg);
    },
    cycle() {
      const i = POINTER_IDS.indexOf(cfg.pointer_type);
      cfg.pointer_type = POINTER_IDS[(i + 1) % POINTER_IDS.length];
      applyConfig(cfg);
      return cfg.pointer_type;
    },
    get config() {
      return cfg;
    },
  };
}
