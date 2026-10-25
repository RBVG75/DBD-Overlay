import { DrawRenderer } from './draw-renderer.js';

const MIN_SLOTS = 12;

export default class RouletteRenderer extends DrawRenderer {
  static id = 'roulette';
  static label = 'Ruleta';
  static description = 'Retratos de asesinos en una rueda ampliada que se detiene bajo la flecha.';
  static modes = ['random-killer'];

  async start(pool) {
    this.reset();
    this.pool = [...pool];
    this.slots = this.buildSlots(pool);
    this.sector = 360 / this.slots.length;

    const stage = this.node('div', 'roulette-stage');
    const scene = this.node('div', 'roulette-window');
    scene.setAttribute('role', 'group');
    scene.setAttribute('aria-label', `Ruleta de ${pool.length} asesinos`);

    const wheel = this.node('div', 'roulette-disk');
    const colors = this.slots.map((_, index) => {
      const start = index * this.sector;
      const end = (index + 1) * this.sector;
      const color = index % 2
        ? 'color-mix(in srgb, var(--accent) 34%, #21191e)'
        : 'color-mix(in srgb, var(--accent) 78%, #b48c57)';
      return `${color} ${start}deg ${end}deg`;
    });
    wheel.style.background = `conic-gradient(${colors.join(',')})`;
    wheel.append(this.buildSlotsLayer(this.slots, this.sector));

    const pointer = this.node('span', 'roulette-pointer', '▼');
    pointer.setAttribute('aria-hidden', 'true');
    const beam = this.node('span', 'roulette-beam');
    beam.setAttribute('aria-hidden', 'true');
    const count = this.node('span', 'roulette-count', `${pool.length} ${pool.length === 1 ? 'ASESINO' : 'ASESINOS'} EN EL POOL`);
    scene.append(wheel, beam, pointer, count);
    stage.append(this.node('p', 'draw-renderer-kicker', 'SORTEANDO ASESINO'), scene);
    this.host.append(stage);
    this.wheel = wheel;
    await this.delay(120);
  }

  /** Repeat small pools so sectors stay broad; all active killers remain represented. */
  buildSlots(pool) {
    if (!pool.length) return [];
    const repeats = Math.max(1, Math.ceil(MIN_SLOTS / pool.length));
    return Array.from({ length: repeats }, () => pool).flat();
  }

  buildSlotsLayer(slots, sector) {
    const layer = this.node('div', 'roulette-slots');
    const radialPosition = '44%';
    const size = Math.min(12, Math.max(4, Math.PI * 0.88 * sector / 360 * 100 * 0.8));

    slots.forEach((item, index) => {
      const angle = (index + 0.5) * sector;
      const holder = this.node('span', 'roulette-slot');
      holder.style.setProperty('--a', `${angle.toFixed(3)}deg`);

      const cell = this.node('span', 'roulette-cell');
      cell.dataset.itemId = item.id;
      cell.style.setProperty('--rr', radialPosition);
      cell.style.setProperty('--size', `${size.toFixed(2)}%`);
      const content = this.node('span', 'roulette-cell-content');
      if (item.image) {
        const image = this.node('img', 'roulette-cell-image');
        image.src = item.image;
        image.alt = '';
        image.loading = 'eager';
        image.decoding = 'async';
        content.append(image);
      } else {
        content.append(this.node('span', 'roulette-cell-mark', item.label.slice(0, 1)));
      }
      content.append(this.node('span', 'roulette-cell-name', item.label));
      cell.append(content);
      holder.append(cell);
      layer.append(holder);
    });
    return layer;
  }

  async reveal(result) {
    const winner = result.items[0];
    if (!winner || this.destroyed || !this.wheel) return;

    const index = Math.max(0, this.slots.findIndex((item) => item.id === winner.id));
    const stopAt = 360 * 7 - (index + 0.5) * this.sector;
    this.wheel.style.setProperty('--roulette-stop', `${stopAt}deg`);
    this.wheel.classList.add('is-spinning');
    await this.delay(3600);
    if (this.destroyed) return;

    this.wheel.querySelector(`[data-item-id="${CSS.escape(winner.id)}"]`)?.classList.add('is-winner');
    this.host.querySelector('.roulette-window')?.classList.add('has-winner');
    await this.delay(350);
    if (!this.destroyed) this.renderResults(result);
  }

  preview(pool) {
    this.reset();
    const preview = this.node('div', 'renderer-preview roulette-preview');
    preview.setAttribute('aria-label', `Vista previa de ruleta para ${pool.length} asesinos`);
    const arc = this.node('span', 'roulette-preview-arc');
    const marker = this.node('span', 'roulette-preview-marker');
    const pointer = this.node('span', 'roulette-preview-pointer', '▼');
    pointer.setAttribute('aria-hidden', 'true');
    preview.append(arc, marker, pointer);
    this.host.append(preview);
  }
}
