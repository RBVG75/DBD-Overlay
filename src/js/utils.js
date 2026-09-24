// Shared helpers used across the overlay.

export function clampNum(value, min, max, fallback) {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function clampInt(value, min, max, fallback) {
  const n = typeof value === 'number' ? Math.round(value) : Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function isHex(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function hex(value, fallback) {
  return isHex(value) ? value.toLowerCase() : fallback;
}

export function hexToRgb(value) {
  const h = isHex(value) ? value : '#000000';
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

export function rgba(value, alpha) {
  const { r, g, b } = hexToRgb(value);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mixHex(a, b, amount) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const t = Math.min(1, Math.max(0, amount));
  const to = (x) => Math.round(x).toString(16).padStart(2, '0');
  return `#${to(ca.r + (cb.r - ca.r) * t)}${to(ca.g + (cb.g - ca.g) * t)}${to(ca.b + (cb.b - ca.b) * t)}`;
}

export function readableOn(background) {
  const { r, g, b } = hexToRgb(background);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#05070a' : '#ffffff';
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Arc path between two angles (degrees, 0 = 12 o'clock, clockwise).
export function describeArc(cx, cy, r, startAngle, endAngle) {
  const span = Math.abs(endAngle - startAngle);
  if (span < 0.0001) return '';
  if (span >= 359.999) {
    // Two half circles so a full ring still renders as a path.
    return [
      `M ${cx} ${cy - r}`,
      `A ${r} ${r} 0 1 1 ${cx} ${cy + r}`,
      `A ${r} ${r} 0 1 1 ${cx} ${cy - r}`,
    ].join(' ');
  }
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = span <= 180 ? 0 : 1;
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

export function formatClock(totalSeconds, format, decimals) {
  const safe = Math.max(0, totalSeconds);
  const whole = decimals ? Math.floor(safe) : Math.ceil(safe - 0.0001);
  const value = Math.max(0, whole);
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  const tenths = decimals ? `.${Math.floor((safe - Math.floor(safe)) * 10)}` : '';
  const pad = (n) => String(n).padStart(2, '0');

  switch (format) {
    case 'none':
      return '';
    case 's':
      return `${value}${tenths}`;
    case 'm:ss':
      return `${m + h * 60}:${pad(s)}`;
    case 'mm:ss':
      return `${pad(m + h * 60)}:${pad(s)}`;
    case 'h:mm:ss':
      return `${h}:${pad(m)}:${pad(s)}`;
    case 'auto':
    default:
      if (value >= 3600) return `${h}:${pad(m)}:${pad(s)}`;
      if (value >= 60) return `${m}:${pad(s)}`;
      return `${value}${tenths}`;
  }
}

export function formatStopwatch(ms, options = {}) {
  const { showHours = false, showCentiseconds = true, showMilliseconds = false } = options;
  const totalMs = Math.max(0, ms);
  const totalSeconds = Math.floor(totalMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = showHours ? Math.floor((totalSeconds % 3600) / 60) : Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const pad = (n, size = 2) => String(n).padStart(size, '0');
  const parts = [];
  if (showHours) parts.push(pad(h));
  parts.push(pad(m));
  parts.push(pad(s));
  const main = parts;
  let fraction = '';
  if (showMilliseconds) fraction = pad(totalMs % 1000, 3);
  else if (showCentiseconds) fraction = pad(Math.floor((totalMs % 1000) / 10));
  return { main, fraction };
}

export function debounce(fn, wait = 120) {
  let handle = null;
  return (...args) => {
    if (handle) clearTimeout(handle);
    handle = setTimeout(() => {
      handle = null;
      fn(...args);
    }, wait);
  };
}

export function deepClone(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch (_) {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(value));
}
