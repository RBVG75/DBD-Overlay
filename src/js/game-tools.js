import { KILLERS } from './catalog.js';
import { normalizeGameTools } from './defaults.js';
import {
  DEFAULT_GAME_TOOLS, KILLER_PERKS, KILLER_PERK_ITEMS,
  SURVIVOR_PERKS, SURVIVOR_PERK_ITEMS,
} from './game-data.js';
import { DEFAULT_RENDERER_BY_MODE } from './draw-combinations.js';
import { DrawController } from './draw-controller.js';
import { gameModes } from './games/index.js';
import { rendererClasses, rendererSupportsMode } from './renderers/index.js';

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function copyConfig(config) {
  return {
    ...config,
    killer_ids: [...config.killer_ids],
    killer_perks: [...config.killer_perks],
    survivor_perks: [...config.survivor_perks],
    custom_killer_perks: [...config.custom_killer_perks],
    custom_survivor_perks: [...config.custom_survivor_perks],
  };
}

const GAME_MODE_ORDER = ['random-killer', 'random-perk', 'killer-and-perks'];
const RENDERER_GROUPS = [
  { label: 'Clásicos', ids: ['race', 'roulette', 'list-reveal', 'card-flip'] },
  { label: 'Casino y físico', ids: ['ball-drum', 'slot-machine', 'scratch-card'] },
  { label: 'Selección visual', ids: ['grid-blackout', 'radar-scan', 'spotlight-search'] },
  { label: 'Competencia', ids: ['tournament-bracket'] },
  { label: 'Temáticos', ids: ['summon-portal'] },
];

export function createGameTools({
  root, scrim, configRoot, configScrim, configTrigger, configCloseButton,
  trigger, reduceMotion = () => false,
  getConfig = () => DEFAULT_GAME_TOOLS,
  onConfigChange = () => {},
}) {
  const status = root.querySelector('.game-tools-status');
  const closeButton = root.querySelector('.game-tools-close');
  const gameModeSelect = root.querySelector('#draw-game-mode');
  const rendererSelect = root.querySelector('#draw-renderer');
  const modeOptions = configRoot.querySelector('#draw-mode-options');
  const poolOptions = configRoot.querySelector('#draw-pool-options');
  const previewEl = root.querySelector('#draw-renderer-preview');
  const previewName = root.querySelector('#draw-renderer-name');
  const previewDescription = root.querySelector('#draw-renderer-description');
  const stage = root.querySelector('#draw-stage');
  const runButton = root.querySelector('#draw-run');
  const controller = new DrawController({ stage, getContext: rendererContext });
  let config = normalizeGameTools(getConfig());
  let poolSearch = '';
  let busy = false;
  let drawGeneration = 0;

  function rendererContext() {
    const styles = getComputedStyle(document.documentElement);
    return {
      accent: styles.getPropertyValue('--accent').trim() || '#c52d35',
      streamPrimary: styles.getPropertyValue('--stream-primary').trim() || '#c52d35',
      reduceMotion: Boolean(reduceMotion()),
    };
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function persist(next, message = 'Ajustes guardados automáticamente') {
    cancelDraw();
    config = normalizeGameTools(next);
    onConfigChange(copyConfig(config));
    setStatus(message);
  }

  function cancelDraw() {
    drawGeneration += 1;
    controller.cancel();
    busy = false;
    runButton.disabled = false;
    runButton.querySelector('span:last-child').textContent = 'Sortear ahora';
  }

  function ensureCompatibleRenderer() {
    if (!rendererSupportsMode(config.renderer, config.game_mode)) {
      const preferred = DEFAULT_RENDERER_BY_MODE[config.game_mode];
      config.renderer = rendererSupportsMode(preferred, config.game_mode)
        ? preferred
        : [...rendererClasses.keys()].find((id) => rendererSupportsMode(id, config.game_mode));
    }
  }

  function fillSelect(select, entries, selectedId) {
    select.replaceChildren();
    for (const entry of entries) {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = entry.label;
      select.append(option);
    }
    select.value = selectedId;
  }

  function fillRendererSelect(entries, selectedId) {
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    const included = new Set();
    rendererSelect.replaceChildren();
    for (const group of RENDERER_GROUPS) {
      const grouped = group.ids.map((id) => byId.get(id)).filter(Boolean);
      if (!grouped.length) continue;
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.label;
      for (const entry of grouped) {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = entry.label;
        optgroup.append(option);
        included.add(entry.id);
      }
      rendererSelect.append(optgroup);
    }
    const ungrouped = entries.filter((entry) => !included.has(entry.id));
    if (ungrouped.length) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = 'Otros';
      for (const entry of ungrouped) {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = entry.label;
        optgroup.append(option);
      }
      rendererSelect.append(optgroup);
    }
    rendererSelect.value = selectedId;
  }

  function request() {
    return config;
  }

  function renderPreview() {
    const info = rendererClasses.get(config.renderer);
    previewName.textContent = info?.label || config.renderer;
    previewDescription.textContent = info?.description || 'Vista previa del estilo';
    try {
      controller.preview(config.renderer, previewEl, request());
    } catch (error) {
      previewEl.replaceChildren(node('span', 'renderer-preview-fallback', '✦'));
      console.warn('[overlay] vista previa del renderer', error);
    }
  }

  function renderModeControls() {
    modeOptions.replaceChildren();
    const game = gameModes.get(config.game_mode);
    if (config.game_mode === 'random-killer') {
      modeOptions.append(node('p', 'draw-mode-description', 'Se elige un asesino de los que tengas activos en el pool.'));
      return;
    }

    const roleField = node('label', 'draw-inline-field');
    roleField.append(node('span', '', config.game_mode === 'random-perk' ? 'Pool de perks' : 'Pool de perks del combinado'));
    const roleSelect = node('select', 'draw-select draw-role-select');
    roleSelect.dataset.drawSetting = 'perk_role';
    for (const [value, label] of [['killer', 'Perks de killer'], ['survivor', 'Perks de superviviente'], ['mixed', 'Pool mixto']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      roleSelect.append(option);
    }
    roleSelect.value = config.perk_role;
    roleField.append(roleSelect);
    modeOptions.append(roleField);

    if (config.game_mode === 'killer-and-perks') {
      const sourceField = node('label', 'draw-inline-field');
      sourceField.append(node('span', '', 'Origen de perks'));
      const sourceSelect = node('select', 'draw-select draw-role-select');
      sourceSelect.dataset.drawSetting = 'perk_source';
      for (const [value, label] of [['pool', 'Pool elegido'], ['character', 'Asignadas al killer']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        sourceSelect.append(option);
      }
      sourceSelect.value = config.perk_source;
      sourceField.append(sourceSelect);
      modeOptions.append(sourceField);
    }

    const countField = node('label', 'draw-inline-field draw-count-field');
    countField.append(node('span', '', 'Perks a sortear'));
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = '6';
    slider.value = String(config.perk_count);
    slider.dataset.drawSetting = 'perk_count';
    const output = node('output', '', String(config.perk_count));
    output.dataset.countOutput = '';
    countField.append(slider, output);
    modeOptions.append(countField);

    const hint = config.game_mode === 'killer-and-perks'
      ? config.perk_source === 'character'
        ? 'Usa las perks asignadas a ese killer en data/perks.json; si aún no tiene asignaciones, usa el pool de killer activo.'
        : 'El resultado combina un killer con perks del pool seleccionado.'
      : `Sortea hasta ${config.perk_count} perks sin repetir.`;
    modeOptions.append(node('p', 'draw-mode-description', hint));
    if (!game) setStatus('Tipo de juego no disponible.');
  }

  function collectionForRole(role) {
    return role === 'killer'
      ? { key: 'killer_perks', customKey: 'custom_killer_perks', entries: KILLER_PERK_ITEMS, label: 'Perks de killer' }
      : { key: 'survivor_perks', customKey: 'custom_survivor_perks', entries: SURVIVOR_PERK_ITEMS, label: 'Perks de superviviente' };
  }

  function renderPoolSection({ key, customKey = null, entries, label, characters = false }) {
    const section = node('section', 'draw-pool-section');
    const active = config[key];
    const header = node('div', 'draw-pool-heading');
    header.append(node('h3', '', label));
    const count = node('span', 'draw-pool-count', `${active.length} / ${entries.length + (customKey ? config[customKey].length : 0)}`);
    count.dataset.poolCount = key;
    header.append(count);
    section.append(header);

    const actions = node('div', 'draw-pool-actions');
    const search = node('input', 'draw-pool-search');
    search.type = 'search';
    search.placeholder = `Buscar ${characters ? 'killer' : 'perk'}…`;
    search.setAttribute('aria-label', `Buscar en ${label}`);
    search.value = poolSearch;
    search.dataset.poolSearch = '';
    actions.append(search);
    const all = node('button', 'draw-pool-action', 'Todos');
    all.type = 'button';
    all.dataset.poolAction = 'all';
    all.dataset.poolKey = key;
    actions.append(all);
    const restore = node('button', 'draw-pool-action', 'Restaurar');
    restore.type = 'button';
    restore.dataset.poolAction = 'restore';
    restore.dataset.poolKey = key;
    actions.append(restore);
    section.append(actions);

    if (customKey) {
      const addRow = node('div', 'draw-custom-perk');
      const input = node('input', 'draw-pool-search');
      input.type = 'text';
      input.maxLength = 56;
      input.placeholder = 'Añadir perk personalizada…';
      input.setAttribute('aria-label', `Añadir a ${label}`);
      input.dataset.customPerk = key;
      const add = node('button', 'draw-pool-action', 'Añadir');
      add.type = 'button';
      add.dataset.addPerk = key;
      addRow.append(input, add);
      section.append(addRow);
    }

    const list = node('div', 'draw-pool-list');
    const options = characters
      ? entries.map((item) => ({ value: item.id, label: item.name, image: `/${item.file}`, characters: true }))
      : [
        ...entries.map((item) => ({ value: item.name, label: item.name, image: item.image })),
        ...(customKey ? config[customKey].map((name) => ({ value: name, label: name })) : []),
      ];
    for (const optionData of options) {
      const option = node('label', 'draw-pool-option');
      option.dataset.optionSearch = optionData.label.toLocaleLowerCase('es');
      option.hidden = !option.dataset.optionSearch.includes(poolSearch.trim().toLocaleLowerCase('es'));
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = active.includes(optionData.value);
      checkbox.dataset.poolKey = key;
      checkbox.dataset.poolValue = optionData.value;
      option.append(checkbox);
      if (optionData.image) {
        const image = node('img', characters ? 'draw-pool-portrait' : 'draw-perk-image');
        image.src = optionData.image;
        image.alt = '';
        image.loading = 'lazy';
        option.append(image);
      } else option.append(node('span', 'draw-pool-mark', '✦'));
      option.append(node('span', 'draw-pool-label', optionData.label));
      list.append(option);
    }
    section.append(list);
    return section;
  }

  function renderPoolControls() {
    poolOptions.replaceChildren();
    if (config.game_mode === 'random-killer') {
      poolOptions.append(renderPoolSection({ key: 'killer_ids', entries: KILLERS, label: 'Killers', characters: true }));
      poolOptions.dataset.poolCount = '1';
      return;
    }

    const roles = config.perk_role === 'mixed' ? ['killer', 'survivor'] : [config.perk_role];
    for (const role of roles) poolOptions.append(renderPoolSection(collectionForRole(role)));
    poolOptions.dataset.poolCount = String(roles.length);
  }

  function renderAll() {
    if (!gameModes.has(config.game_mode)) config.game_mode = DEFAULT_GAME_TOOLS.game_mode;
    ensureCompatibleRenderer();
    const modes = [...gameModes.values()].sort((left, right) => GAME_MODE_ORDER.indexOf(left.id) - GAME_MODE_ORDER.indexOf(right.id));
    fillSelect(gameModeSelect, modes.map((mode) => ({ id: mode.id, label: mode.label })), config.game_mode);
    const renderers = [...rendererClasses.entries()]
      .filter(([id]) => rendererSupportsMode(id, config.game_mode))
      .map(([id, Renderer]) => ({ id, label: Renderer.label }));
    fillRendererSelect(renderers, config.renderer);
    renderModeControls();
    renderPoolControls();
    renderPreview();
  }

  async function runDraw() {
    if (busy) return;
    const generation = ++drawGeneration;
    busy = true;
    runButton.disabled = true;
    runButton.querySelector('span:last-child').textContent = 'Sorteando…';
    setStatus(`${gameModes.get(config.game_mode)?.label || 'Sorteo'} · ${rendererClasses.get(config.renderer)?.label || config.renderer}`);
    try {
      const result = await controller.draw(config.game_mode, config.renderer, request());
      if (generation === drawGeneration && result) {
        const fallback = result.meta?.perkPoolFallback ? ' · sin asignaciones propias: se usó el pool de killer' : '';
        setStatus(`Resultado: ${result.items.map((item) => item.label).join(' · ')}${fallback}`);
      }
    } catch (error) {
      if (generation === drawGeneration) {
        console.warn('[overlay] sorteo fallido', error);
        setStatus(error.message || 'No se pudo completar el sorteo.');
      }
    } finally {
      if (generation === drawGeneration) {
        busy = false;
        runButton.disabled = false;
        runButton.querySelector('span:last-child').textContent = 'Sortear ahora';
      }
    }
  }

  function open() {
    closeConfig(false);
    root.classList.remove('hidden');
    scrim.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('active');
    renderAll();
    closeButton.focus();
  }

  function close() {
    cancelDraw();
    closeConfig(false);
    busy = false;
    root.classList.add('hidden');
    scrim.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('active');
    trigger.focus();
  }

  function openConfig() {
    if (root.classList.contains('hidden')) return;
    if (busy) {
      cancelDraw();
      setStatus('Sorteo detenido para editar el pool.');
    }
    configRoot.classList.remove('hidden');
    configScrim.classList.remove('hidden');
    configTrigger.setAttribute('aria-expanded', 'true');
    configCloseButton.focus();
  }

  function closeConfig(restoreFocus = true) {
    configRoot.classList.add('hidden');
    configScrim.classList.add('hidden');
    configTrigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && !root.classList.contains('hidden')) configTrigger.focus();
  }

  function setConfig(next) {
    const normalized = normalizeGameTools(next);
    if (!gameModes.has(normalized.game_mode)) normalized.game_mode = DEFAULT_GAME_TOOLS.game_mode;
    if (JSON.stringify(normalized) === JSON.stringify(config)) return;
    cancelDraw();
    config = normalized;
    ensureCompatibleRenderer();
    if (!root.classList.contains('hidden')) renderAll();
  }

  root.addEventListener('change', (event) => {
    const target = event.target;
    if (target === gameModeSelect) {
      config.game_mode = target.value;
      ensureCompatibleRenderer();
      persist(config, 'Tipo de juego actualizado');
      renderAll();
      return;
    }
    if (target === rendererSelect) {
      persist({ ...config, renderer: target.value }, 'Estilo actualizado');
      renderAll();
    }
  });

  configRoot.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('[data-draw-setting]')) {
      const key = target.dataset.drawSetting;
      const next = { ...config, [key]: key === 'perk_count' ? Number(target.value) : target.value };
      if (key === 'perk_source' && target.value === 'character') next.perk_role = 'killer';
      persist(next);
      renderModeControls();
      renderPoolControls();
      renderPreview();
      return;
    }
    const checkbox = target.closest('[data-pool-key]');
    if (checkbox && checkbox.type === 'checkbox') {
      const key = checkbox.dataset.poolKey;
      const next = [...config[key]];
      if (checkbox.checked) {
        if (!next.includes(checkbox.dataset.poolValue)) next.push(checkbox.dataset.poolValue);
      } else if (next.length > 1) next.splice(next.indexOf(checkbox.dataset.poolValue), 1);
      else {
        checkbox.checked = true;
        setStatus('Mantén al menos una opción activa en cada pool.');
        return;
      }
      persist({ ...config, [key]: next });
      const count = configRoot.querySelector(`[data-pool-count="${key}"]`);
      const section = checkbox.closest('.draw-pool-section');
      const total = section?.querySelectorAll('[data-pool-value]').length || next.length;
      if (count) count.textContent = `${next.length} / ${total}`;
      renderPreview();
    }
  });

  configRoot.addEventListener('input', (event) => {
    const target = event.target;
    if (target.matches('[data-pool-search]')) {
      poolSearch = target.value;
      const query = poolSearch.trim().toLocaleLowerCase('es');
      for (const option of configRoot.querySelectorAll('[data-option-search]')) {
        option.hidden = !option.dataset.optionSearch.includes(query);
      }
    }
    if (target.matches('[data-draw-setting="perk_count"]')) {
      const output = configRoot.querySelector('[data-count-output]');
      if (output) output.value = target.value;
    }
  });

  configRoot.addEventListener('click', (event) => {
    const action = event.target.closest('[data-pool-action]');
    if (action) {
      const key = action.dataset.poolKey;
      const section = action.closest('.draw-pool-section');
      const checkboxes = [...section.querySelectorAll(`[data-pool-key="${key}"]`)];
      const defaults = key === 'killer_ids'
        ? DEFAULT_GAME_TOOLS.killer_ids
        : DEFAULT_GAME_TOOLS[key];
      const values = action.dataset.poolAction === 'all'
        ? checkboxes.map((checkbox) => checkbox.dataset.poolValue)
        : defaults;
      persist({ ...config, [key]: [...values] }, action.dataset.poolAction === 'all' ? 'Pool completo activado' : 'Pool predeterminado restaurado');
      renderPoolControls();
      renderPreview();
      return;
    }

    const addPerk = event.target.closest('[data-add-perk]');
    if (addPerk) {
      const section = collectionForRole(addPerk.dataset.addPerk === 'killer_perks' ? 'killer' : 'survivor');
      const input = configRoot.querySelector(`[data-custom-perk="${section.key}"]`);
      const name = input?.value.trim().slice(0, 56) || '';
      if (!name) {
        setStatus('Escribe el nombre de una perk para añadirla.');
        input?.focus();
        return;
      }
      const allNames = [...section.entries.map((entry) => entry.name), ...config[section.customKey]];
      if (allNames.some((value) => value.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))) {
        setStatus('Esa perk ya está en el pool.');
        input.focus();
        return;
      }
      persist({
        ...config,
        [section.customKey]: [...config[section.customKey], name],
        [section.key]: [...config[section.key], name],
      }, `Perk «${name}» añadida al pool`);
      renderPoolControls();
      configRoot.querySelector(`[data-custom-perk="${section.key}"]`)?.focus();
      renderPreview();
      return;
    }
  });

  configRoot.addEventListener('keydown', (event) => {
    if (event.target.matches('[data-custom-perk]') && event.key === 'Enter') {
      event.preventDefault();
      const input = event.target;
      const section = collectionForRole(input.dataset.customPerk === 'killer_perks' ? 'killer' : 'survivor');
      configRoot.querySelector(`[data-add-perk="${section.key}"]`)?.click();
    }
  });

  closeButton.addEventListener('click', close);
  configTrigger.addEventListener('click', openConfig);
  configCloseButton.addEventListener('click', () => closeConfig());
  scrim.addEventListener('click', close);
  configScrim.addEventListener('click', () => closeConfig());
  runButton.addEventListener('click', runDraw);
  trigger.addEventListener('click', () => {
    if (root.classList.contains('hidden')) trigger.dispatchEvent(new CustomEvent('game-tools-open-request'));
    else close();
  });
  document.addEventListener('keydown', (event) => {
    if (root.classList.contains('hidden')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!configRoot.classList.contains('hidden')) closeConfig();
      else close();
    } else if (event.key === 'Tab') {
      const scope = configRoot.classList.contains('hidden') ? root : configRoot;
      const focusable = [...scope.querySelectorAll('button:not(:disabled), select:not(:disabled), input:not(:disabled), summary')]
        .filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  renderAll();
  setStatus('Elige el juego y el estilo, ajusta el pool y sortea.');
  return { open, close, setConfig };
}
