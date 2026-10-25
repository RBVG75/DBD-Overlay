// Stream theme loader. Theme JSON files are served from the existing Vite
// public directory, so adding a theme does not require changing the layout.

const DEFAULT_THEME = 'azul';
const themeEffects = document.getElementById('theme-effects');

function setToken(name, value) {
  if (value != null && value !== '') document.documentElement.style.setProperty(name, String(value));
}

function safeThemeId(value) {
  const id = String(value || '').toLowerCase();
  return /^[a-z0-9-]+$/.test(id) ? id : DEFAULT_THEME;
}

function clearParticles() {
  if (themeEffects) themeEffects.replaceChildren();
}

function createParticles(theme) {
  clearParticles();
  const config = theme.effects && theme.effects.particles;
  if (!themeEffects || !config || config.enabled === false) return;

  const count = Math.min(48, Math.max(0, Number(config.count) || 0));
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement('span');
    particle.className = 'stream-particle';
    particle.style.setProperty('--particle-x', `${Math.round(Math.random() * 100)}%`);
    particle.style.setProperty('--particle-delay', `${(-Math.random() * 12).toFixed(2)}s`);
    particle.style.setProperty('--particle-duration', `${(8 + Math.random() * 10).toFixed(2)}s`);
    particle.style.setProperty('--particle-size', `${(1 + Math.random() * 3).toFixed(1)}px`);
    fragment.appendChild(particle);
  }
  themeEffects.appendChild(fragment);
}

function applyTheme(theme) {
  const root = document.documentElement;
  const palette = theme.palette || {};
  const typography = theme.typography || {};
  const effects = theme.effects || {};
  const assets = theme.assets || {};

  root.dataset.streamTheme = theme.id;
  root.dataset.streamEffect = effects.preset || 'none';
  setToken('--stream-primary', palette.primary);
  setToken('--stream-secondary', palette.secondary);
  setToken('--stream-accent', palette.accent);
  setToken('--stream-background', palette.background);
  setToken('--stream-surface', palette.surface);
  setToken('--stream-text', palette.text);
  setToken('--stream-muted', palette.muted);
  setToken('--stream-font', typography.family);
  setToken('--stream-font-weight', typography.weight);
  setToken('--stream-letter-spacing', typography.letter_spacing);
  setToken('--stream-intensity', effects.intensity == null ? 1 : effects.intensity);
  setToken('--stream-asset-main', assets.main);
  setToken('--stream-asset-icon', assets.icon);
  setToken('--stream-asset-alert', assets.alert_icon);
  createParticles(theme);
}

export async function loadStreamTheme(requestedId = DEFAULT_THEME, { useUrl = true } = {}) {
  const queryId = useUrl ? new URLSearchParams(window.location.search).get('theme') : '';
  const id = safeThemeId(queryId || requestedId);
  let response = await fetch(`/themes/${id}.json`, { cache: 'no-cache' });

  if (!response.ok && id !== DEFAULT_THEME) {
    response = await fetch(`/themes/${DEFAULT_THEME}.json`, { cache: 'no-cache' });
  }
  if (!response.ok) {
    console.warn(`[overlay] no se pudo cargar el tema ${id}`);
    return null;
  }

  try {
    const theme = await response.json();
    if (!theme.id || !theme.palette || !theme.effects || !theme.assets) throw new Error('Esquema de tema incompleto');
    applyTheme(theme);
    return theme;
  } catch (error) {
    console.warn('[overlay] tema no válido', error);
    return null;
  }
}
