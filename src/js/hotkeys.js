// Hotkey picker. Keys are read from `event.code` so the captured combination
// matches what the Rust side can parse regardless of keyboard layout, and so
// the numeric keypad stays distinct from the number row.

const MODIFIERS = new Set(['Control', 'Alt', 'Shift', 'Meta']);

// Codes stored as-is. The stored token is what `parse_key_code()` in main.rs
// understands; `KEY_LABELS` only changes how it reads on screen.
const PASSTHROUGH = new Set([
  'Space', 'Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'Insert', 'Home', 'End',
  'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'CapsLock', 'ScrollLock', 'PrintScreen', 'Pause', 'ContextMenu', 'NumLock',
  'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6',
  'Numpad7', 'Numpad8', 'Numpad9', 'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply',
  'NumpadDivide', 'NumpadDecimal', 'NumpadEnter', 'NumpadEqual', 'NumpadComma',
  'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash', 'Semicolon',
  'Quote', 'Backquote', 'Comma', 'Period', 'Slash', 'IntlBackslash', 'IntlRo', 'IntlYen',
  'MediaPlayPause', 'MediaStop', 'MediaTrackNext', 'MediaTrackPrevious',
  'AudioVolumeUp', 'AudioVolumeDown', 'AudioVolumeMute',
]);

export const KEY_LABELS = {
  Space: 'Espacio', Enter: 'Intro', Tab: 'Tab', Escape: 'Esc', Backspace: 'Retroceso',
  Delete: 'Supr', Insert: 'Insert', Home: 'Inicio', End: 'Fin', PageUp: 'Re Pág',
  PageDown: 'Av Pág', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  CapsLock: 'Bloq Mayús', ScrollLock: 'Bloq Despl', PrintScreen: 'Impr Pant',
  Pause: 'Pausa', ContextMenu: 'Menú', NumLock: 'Bloq Num',
  Numpad0: 'Num 0', Numpad1: 'Num 1', Numpad2: 'Num 2', Numpad3: 'Num 3',
  Numpad4: 'Num 4', Numpad5: 'Num 5', Numpad6: 'Num 6', Numpad7: 'Num 7',
  Numpad8: 'Num 8', Numpad9: 'Num 9',
  NumpadAdd: 'Num +', NumpadSubtract: 'Num −', NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /', NumpadDecimal: 'Num .', NumpadEnter: 'Num Intro',
  NumpadEqual: 'Num =', NumpadComma: 'Num ,',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Backquote: '`', Comma: ',', Period: '.', Slash: '/',
  IntlBackslash: '< >', IntlRo: 'Ro', IntlYen: '¥',
  MediaPlayPause: 'Play/Pausa', MediaStop: 'Stop', MediaTrackNext: 'Siguiente',
  MediaTrackPrevious: 'Anterior', AudioVolumeUp: 'Vol +', AudioVolumeDown: 'Vol −',
  AudioVolumeMute: 'Silencio',
  Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Win',
};

/** `event.code` → the token stored in the configuration. */
export function codeToName(code) {
  if (!code) return '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  if (PASSTHROUGH.has(code)) return code;
  return '';
}

/** Turns a stored combination into something readable: "Ctrl+Numpad1" → "Ctrl + Num 1". */
export function formatHotkey(combo) {
  if (!combo) return '';
  return combo
    .split('+')
    .map((part) => KEY_LABELS[part] || part)
    .join(' + ');
}

export function createHotkeyCapture({ container, onCommit, onCancel }) {
  let active = null;
  let candidate = '';

  function label(pickerEl) {
    return pickerEl.querySelector('.hotkey-value');
  }

  function stop(restore = true) {
    if (!active) return;
    active.classList.remove('capturing');
    if (restore) {
      label(active).textContent = formatHotkey(active.dataset.current) || 'Sin asignar';
    }
    active = null;
    candidate = '';
  }

  container.addEventListener('click', (event) => {
    const picker = event.target.closest('.hotkey-picker');
    if (!picker || !container.contains(picker)) return;
    event.preventDefault();
    if (active === picker) {
      stop();
      return;
    }
    stop();
    active = picker;
    candidate = '';
    picker.classList.add('capturing');
    label(picker).textContent = 'Pulsa una combinación…';
  });

  function onKeyDown(event) {
    if (!active) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      const target = active.dataset.target;
      stop();
      if (onCancel) onCancel(target);
      return;
    }

    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');

    // Delete and Backspace clear the assignment, unless combined with a modifier
    // — then they are a shortcut like any other.
    if ((event.code === 'Delete' || event.code === 'Backspace') && !parts.length) {
      const target = active.dataset.target;
      const picker = active;
      active = null;
      candidate = '';
      picker.classList.remove('capturing');
      picker.dataset.current = '';
      label(picker).textContent = 'Sin asignar';
      onCommit(target, '');
      return;
    }

    if (MODIFIERS.has(event.key)) {
      label(active).textContent = parts.length
        ? `${parts.map((p) => KEY_LABELS[p] || p).join(' + ')} + …`
        : 'Pulsa una combinación…';
      return;
    }

    const name = codeToName(event.code);
    if (!name) {
      label(active).textContent = 'Esa tecla no se puede usar';
      return;
    }
    parts.push(name);
    candidate = parts.join('+');
    label(active).textContent = formatHotkey(candidate);
  }

  function onKeyUp(event) {
    if (!active) return;
    event.preventDefault();
    if (!candidate) return;
    // The combination is complete as soon as the first key is released.
    const target = active.dataset.target;
    const value = candidate;
    active.dataset.current = value;
    label(active).textContent = formatHotkey(value);
    active.classList.remove('capturing');
    active = null;
    candidate = '';
    onCommit(target, value);
  }

  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);

  return {
    cancel: () => stop(),
    get capturing() {
      return Boolean(active);
    },
    destroy() {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
    },
  };
}
