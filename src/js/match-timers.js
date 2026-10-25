// Two independent monotonic stopwatches and the 1v1 auto-score rule.
const PLAYER_IDS = [1, 2];
const clampTime = (value) => Number.isFinite(value) ? Math.max(0, value) : 0;

export function createMatchTimers({ root, getScoreboard, getSettings, onScore, onChange }) {
  const states = {
    1: { status: 'stopped', elapsedMs: 0, startedAt: null },
    2: { status: 'stopped', elapsedMs: 0, startedAt: null },
  };
  let activePlayer = 1;
  let pausedAt = { 1: null, 2: null };
  let frame = 0;
  let initialized = false;
  let autoScoreWasEnabled = true;

  const elapsed = (id, now = performance.now()) => {
    const timer = states[id];
    return Math.floor(clampTime(timer.elapsedMs + (timer.status === 'running' && timer.startedAt !== null ? now - timer.startedAt : 0)));
  };

  function format(ms) {
    const centis = Math.floor(ms / 10);
    const cs = String(centis % 100).padStart(2, '0');
    const seconds = Math.floor(centis / 100) % 60;
    const minutes = Math.floor(centis / 6000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${cs}`;
  }

  function persistState() {
    const config = getSettings();
    config.active_player = activePlayer;
    config.auto_score = Boolean(config.auto_score);
    config.auto_score_threshold_seconds = clampTime(config.auto_score_threshold_seconds);
    config.timers = Object.fromEntries(PLAYER_IDS.map((id) => [id, {
      status: states[id].status === 'running' ? 'paused' : states[id].status,
      elapsed_ms: elapsed(id),
    }]));
    if (onChange) onChange();
  }

  function paint() {
    const board = getScoreboard();
    for (const id of PLAYER_IDS) {
      const card = root.querySelector(`.match-timer[data-player="${id}"]`);
      const timer = states[id];
      card.classList.toggle('active', id === activePlayer);
      card.dataset.state = timer.status;
      root.querySelector(`[data-time="${id}"]`).textContent = format(elapsed(id));
      root.querySelector(`[data-status="${id}"]`).textContent = timer.status === 'running' ? 'EN MARCHA' : timer.status === 'paused' ? 'EN PAUSA' : 'LISTO';
      const name = board[`player${id}_name`] || `Jugador ${id}`;
      const select = card.querySelector('.match-player-select');
      select.textContent = name;
      select.setAttribute('aria-pressed', String(id === activePlayer));
      const score = board[`player${id}_score`] || 0;
      card.querySelector('.match-status').setAttribute('aria-label', `Puntuación ${score}`);
    }
  }

  function schedule() {
    if (frame) return;
    const tick = () => {
      paint();
      if (PLAYER_IDS.some((id) => states[id].status === 'running')) frame = requestAnimationFrame(tick);
      else frame = 0;
    };
    frame = requestAnimationFrame(tick);
  }

  function awardIfReady() {
    const settings = getSettings();
    if (!settings.auto_score) {
      pausedAt = { 1: null, 2: null };
      return;
    }
    if (pausedAt[1] === null || pausedAt[2] === null) return;
    const threshold = clampTime(settings.auto_score_threshold_seconds ?? 5) * 1000;
    const firstTime = pausedAt[1];
    const secondTime = pausedAt[2];
    if (firstTime >= threshold && secondTime >= threshold && firstTime !== secondTime) {
      const winner = firstTime > secondTime ? 1 : 2;
      if (onScore) onScore(winner);
      else {
        const board = getScoreboard();
        board[`player${winner}_score`] = Math.min(9999, board[`player${winner}_score`] + 1);
      }
    }
    // Evaluate each pair of pauses once. A fresh comparison requires both
    // players to pause again, preventing a stale result from a previous round.
    pausedAt = { 1: null, 2: null };
  }

  function toggle(id = activePlayer) {
    const timer = states[id];
    const now = performance.now();
    if (timer.status === 'running') {
      timer.elapsedMs = elapsed(id, now);
      timer.startedAt = null;
      timer.status = 'paused';
      pausedAt[id] = timer.elapsedMs;
      awardIfReady();
    } else {
      if (timer.status === 'stopped') {
        timer.elapsedMs = 0;
        pausedAt = { 1: null, 2: null };
      }
      timer.startedAt = now;
      timer.status = 'running';
    }
    paint();
    schedule();
    persistState();
  }

  function reset(id = activePlayer) {
    states[id] = { status: 'stopped', elapsedMs: 0, startedAt: null };
    pausedAt = { 1: null, 2: null };
    paint();
    persistState();
  }

  function select(id) {
    activePlayer = id === 2 ? 2 : 1;
    paint();
    persistState();
  }

  function applyConfig(config) {
    if (initialized) {
      if (autoScoreWasEnabled && !config.auto_score) pausedAt = { 1: null, 2: null };
      autoScoreWasEnabled = Boolean(config.auto_score);
      paint();
      return;
    }
    const timers = config.timers && typeof config.timers === 'object' ? config.timers : {};
    activePlayer = config.active_player === 2 ? 2 : 1;
    for (const id of PLAYER_IDS) {
      const saved = timers[id] || timers[String(id)] || {};
      // Never restore running against a stale monotonic timestamp.
      states[id] = {
        status: saved.status === 'running' ? 'paused' : ['paused', 'stopped'].includes(saved.status) ? saved.status : 'stopped',
        elapsedMs: clampTime(saved.elapsed_ms),
        startedAt: null,
      };
    }
    pausedAt = { 1: null, 2: null };
    autoScoreWasEnabled = Boolean(config.auto_score);
    initialized = true;
    paint();
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action][data-player], [data-action="swap"]');
    if (!button) return;
    const action = button.dataset.action;
    const id = Number(button.dataset.player);
    if (action === 'select') select(id);
    else if (action === 'toggle-player') { select(id); toggle(id); }
    else if (action === 'reset-player') { select(id); reset(id); }
    else if (action === 'swap') select(activePlayer === 1 ? 2 : 1);
  });

  return {
    applyConfig,
    render: paint,
    toggle: () => toggle(),
    pause: () => { if (states[activePlayer].status === 'running') toggle(); },
    reset: () => reset(),
    swap: () => select(activePlayer === 1 ? 2 : 1),
  };
}
