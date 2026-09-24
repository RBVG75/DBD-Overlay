// Counters, records and derived values behind the info panels.
//
// A tracker is a named value the streamer moves with a hotkey (a win, a kill, a
// streak). Panels never store numbers themselves: they point at trackers, and
// everything else (win rate, kill rate, averages) is a formula over them.

import { catalogEntries } from './catalog.js';
import { clampInt, clampNum } from './utils.js';

// ---------------------------------------------------------------------------
// Formula evaluation — a tiny shunting-yard parser, so no eval() and no CSP
// trouble. Identifiers resolve to tracker keys; unknown names become 0.
// ---------------------------------------------------------------------------

const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };

function tokenize(expression) {
  const tokens = [];
  const re = /\s*([A-Za-z_][A-Za-z0-9_]*|\d+\.?\d*|[()+\-*/%^])/g;
  let match;
  let index = 0;
  while ((match = re.exec(expression)) !== null) {
    if (match.index !== index) return null; // unexpected character
    index = re.lastIndex;
    tokens.push(match[1]);
  }
  return index === expression.length ? tokens : null;
}

function toRpn(tokens) {
  const output = [];
  const ops = [];
  let expectValue = true;
  for (const token of tokens) {
    if (/^[A-Za-z_]/.test(token) || /^\d/.test(token)) {
      output.push(token);
      expectValue = false;
    } else if (token === '(') {
      ops.push(token);
      expectValue = true;
    } else if (token === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') output.push(ops.pop());
      if (!ops.length) return null;
      ops.pop();
      expectValue = false;
    } else {
      if (expectValue && token === '-') {
        // Unary minus becomes 0 - x.
        output.push('0');
      }
      while (
        ops.length
        && ops[ops.length - 1] !== '('
        && PRECEDENCE[ops[ops.length - 1]] >= PRECEDENCE[token]
      ) {
        output.push(ops.pop());
      }
      ops.push(token);
      expectValue = true;
    }
  }
  while (ops.length) {
    const op = ops.pop();
    if (op === '(') return null;
    output.push(op);
  }
  return output;
}

export function evaluateFormula(expression, values) {
  if (typeof expression !== 'string' || !expression.trim()) return null;
  const tokens = tokenize(expression.trim());
  if (!tokens || !tokens.length) return null;
  const rpn = toRpn(tokens);
  if (!rpn) return null;

  const stack = [];
  for (const token of rpn) {
    if (/^[A-Za-z_]/.test(token)) {
      const value = values[token];
      stack.push(Number.isFinite(value) ? value : 0);
    } else if (/^\d/.test(token)) {
      stack.push(Number.parseFloat(token));
    } else {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) return null;
      switch (token) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/': stack.push(b === 0 ? 0 : a / b); break;
        case '%': stack.push(b === 0 ? 0 : a % b); break;
        case '^': stack.push(a ** b); break;
        default: return null;
      }
    }
  }
  const result = stack.length === 1 ? stack[0] : null;
  return Number.isFinite(result) ? result : null;
}

export function formulaIsValid(expression, keys) {
  if (!expression || !expression.trim()) return true;
  const tokens = tokenize(expression.trim());
  if (!tokens) return false;
  if (!toRpn(tokens)) return false;
  const known = new Set(keys);
  return tokens.every((t) => !/^[A-Za-z_]/.test(t) || known.has(t));
}

// ---------------------------------------------------------------------------

export function slugify(label, taken = []) {
  const base = String(label || 'dato')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'n$1') || 'dato';
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

export function formatNumber(value, decimals = 0) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(clampInt(decimals, 0, 3, 0));
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function createStatsEngine({ onChange, onRecord } = {}) {
  let trackers = [];
  let sessionStart = Date.now();

  const byId = new Map();
  const byKey = new Map();

  function reindex() {
    byId.clear();
    byKey.clear();
    for (const t of trackers) {
      byId.set(t.id, t);
      byKey.set(t.key, t);
    }
  }

  function setTrackers(list) {
    trackers = list;
    reindex();
  }

  function totalOf(tracker) {
    if (!tracker) return 0;
    if (tracker.kind === 'winloss') return tracker.wins + tracker.losses + tracker.draws;
    if (tracker.kind === 'text') return 0;
    return tracker.value;
  }

  /** Every tracker exposed to formulas, under several suffixes. */
  function values() {
    const out = {};
    for (const t of trackers) {
      if (t.kind === 'winloss') {
        const played = t.wins + t.losses + t.draws;
        out[t.key] = played;
        out[`${t.key}_v`] = t.wins;
        out[`${t.key}_d`] = t.losses;
        out[`${t.key}_e`] = t.draws;
        out[`${t.key}_pct`] = played ? (t.wins / played) * 100 : 0;
      } else if (t.kind === 'number') {
        out[t.key] = t.value;
      } else if (t.kind === 'choice') {
        // A character has no numeric meaning, but the key must still resolve.
        out[t.key] = 0;
      } else {
        out[t.key] = Number.parseFloat(t.text) || 0;
      }
      out[`${t.key}_record`] = t.record;
    }
    out.sesion = (Date.now() - sessionStart) / 60000;
    return out;
  }

  // Only plain counters chase a record: on a win/loss tracker the win count only
  // ever grows, so "a new record" would fire on every single win.
  function noteRecord(tracker, previous) {
    if (!tracker.track_record || tracker.kind !== 'number') return;
    if (tracker.value > tracker.record) {
      tracker.record = tracker.value;
      if (onRecord && tracker.value > previous) onRecord(tracker);
    }
  }

  /** Trackers chained to `source`: streaks that grow on a win and die on a loss. */
  function cascade(source, outcome) {
    for (const t of trackers) {
      if (t.kind !== 'number') continue;
      if (t.bump_with === source.id && outcome === 'win') {
        const before = t.record;
        t.value = clampNum(t.value + t.step, t.min, t.max, t.value);
        noteRecord(t, before);
      }
      if (t.reset_with === source.id && outcome === 'loss') t.value = 0;
    }
  }

  /** Moves a character tracker through its catalogue, wrapping at both ends. */
  function cycleChoice(tracker, delta) {
    const entries = catalogEntries(tracker.catalog);
    if (!entries.length) return;
    const current = entries.findIndex((entry) => entry.id === tracker.choice_id);
    const next = ((current < 0 ? 0 : current) + delta + entries.length * 2) % entries.length;
    tracker.choice_id = entries[next].id;
  }

  function setChoice(id, choiceId) {
    const t = byId.get(id);
    if (!t || t.kind !== 'choice') return;
    t.choice_id = choiceId;
    emit();
  }

  function bump(id, delta) {
    const t = byId.get(id);
    if (!t) return;
    if (t.kind === 'winloss') {
      registerResult(id, delta > 0 ? 'win' : 'loss');
      return;
    }
    if (t.kind === 'choice') {
      cycleChoice(t, delta > 0 ? 1 : -1);
      emit();
      return;
    }
    if (t.kind !== 'number') return;
    const before = t.record;
    t.value = clampNum(t.value + t.step * delta, t.min, t.max, t.value);
    noteRecord(t, before);
    emit();
  }

  function setValue(id, value) {
    const t = byId.get(id);
    if (!t) return;
    if (t.kind === 'text') t.text = String(value);
    else if (t.kind === 'number') {
      const before = t.record;
      t.value = clampNum(value, t.min, t.max, t.value);
      noteRecord(t, before);
    }
    emit();
  }

  function registerResult(id, outcome) {
    const t = byId.get(id);
    if (!t || t.kind !== 'winloss') return;
    const before = t.record;
    if (outcome === 'win') t.wins += 1;
    else if (outcome === 'loss') t.losses += 1;
    else t.draws += 1;
    t.history = [outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : 'E', ...(t.history || [])].slice(0, 30);
    noteRecord(t, before);
    cascade(t, outcome);
    emit();
  }

  function undo(id) {
    const t = byId.get(id);
    if (!t || t.kind !== 'winloss' || !t.history || !t.history.length) return;
    const [last, ...rest] = t.history;
    t.history = rest;
    if (last === 'W' && t.wins > 0) t.wins -= 1;
    else if (last === 'L' && t.losses > 0) t.losses -= 1;
    else if (last === 'E' && t.draws > 0) t.draws -= 1;
    emit();
  }

  function reset(id) {
    const t = byId.get(id);
    if (!t) return;
    resetTracker(t);
    emit();
  }

  function resetTracker(t) {
    if (t.kind === 'winloss') {
      t.wins = 0;
      t.losses = 0;
      t.draws = 0;
      t.history = [];
    } else if (t.kind === 'number') {
      t.value = t.start_value || 0;
    } else if (t.kind === 'choice') {
      const entries = catalogEntries(t.catalog);
      if (entries.length) t.choice_id = entries[0].id;
    } else {
      t.text = '';
    }
  }

  function resetRecord(id) {
    const t = byId.get(id);
    if (!t) return;
    t.record = 0;
    emit();
  }

  function resetSession() {
    sessionStart = Date.now();
    for (const t of trackers) if (t.reset_on_session) resetTracker(t);
    emit();
  }

  function resetAll() {
    for (const t of trackers) resetTracker(t);
    sessionStart = Date.now();
    emit();
  }

  function emit() {
    if (onChange) onChange();
  }

  return {
    setTrackers,
    bump,
    setValue,
    setChoice,
    registerResult,
    undo,
    reset,
    resetRecord,
    resetSession,
    resetAll,
    values,
    totalOf,
    get trackers() {
      return trackers;
    },
    get(id) {
      return byId.get(id);
    },
    byKey(key) {
      return byKey.get(key);
    },
    get sessionSeconds() {
      return (Date.now() - sessionStart) / 1000;
    },
    get sessionStart() {
      return sessionStart;
    },
    setSessionStart(value) {
      sessionStart = value;
    },
  };
}
