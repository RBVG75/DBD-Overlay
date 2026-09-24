// Two-player scoreboard with inline editable names and click-to-score.

export function createScoreboard({ root, onChange }) {
  const name1 = root.querySelector('#player1-name');
  const name2 = root.querySelector('#player2-name');
  const score1 = root.querySelector('#player1-score');
  const score2 = root.querySelector('#player2-score');
  const title = root.querySelector('#match-title');

  let cfg = null;
  let suppress = false;

  function emit() {
    if (!suppress && onChange) onChange(cfg);
  }

  function paint() {
    suppress = true;
    name1.value = cfg.player1_name;
    name2.value = cfg.player2_name;
    score1.textContent = String(cfg.player1_score);
    score2.textContent = String(cfg.player2_score);
    title.value = cfg.match_title;
    suppress = false;
  }

  function bump(player, delta) {
    const key = player === 1 ? 'player1_score' : 'player2_score';
    cfg[key] = Math.max(0, Math.min(9999, cfg[key] + delta));
    paint();
    emit();
  }

  score1.addEventListener('click', () => bump(1, 1));
  score2.addEventListener('click', () => bump(2, 1));
  score1.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    bump(1, -1);
  });
  score2.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    bump(2, -1);
  });

  name1.addEventListener('input', () => {
    cfg.player1_name = name1.value;
    emit();
  });
  name2.addEventListener('input', () => {
    cfg.player2_name = name2.value;
    emit();
  });
  title.addEventListener('input', () => {
    cfg.match_title = title.value;
    emit();
  });

  function applyConfig(next) {
    cfg = next;
    root.dataset.skin = cfg.style;
    root.classList.toggle('hidden', !cfg.visible);
    root.style.setProperty('--sb-accent1', cfg.accent1);
    root.style.setProperty('--sb-accent2', cfg.accent2);
    root.style.setProperty('--sb-size', `${cfg.font_size}px`);
    root.style.opacity = String(cfg.opacity / 100);
    title.classList.toggle('hidden', !cfg.show_title);
    paint();
  }

  return {
    applyConfig,
    addPoint(player) {
      bump(player, 1);
    },
    resetScores() {
      cfg.player1_score = 0;
      cfg.player2_score = 0;
      paint();
      emit();
    },
    get config() {
      return cfg;
    },
  };
}
