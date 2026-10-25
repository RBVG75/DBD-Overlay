import { DrawRenderer } from './draw-renderer.js';

export default class GridBlackoutRenderer extends DrawRenderer {
  static id = 'grid-blackout';
  static label = 'Cuadrícula a ciegas';
  static description = 'El pool completo se apaga hasta dejar encendidos los elegidos.';

  async start(pool) {
    this.reset();
    this.pool = [...pool];
    const stage = this.node('div', 'blackout-stage');
    stage.append(this.node('p', 'draw-renderer-kicker', 'POOL COMPLETO'));
    this.grid = this.node('div', 'blackout-grid');
    const minCell = pool.length > 100 ? 29 : pool.length > 44 ? 38 : 48;
    this.grid.style.setProperty('--blackout-cell', `${minCell}px`);
    this.cells = new Map();
    for (const item of pool) {
      const cell = this.node('span', 'blackout-cell');
      cell.dataset.itemId = item.id;
      cell.dataset.kind = item.kind;
      cell.title = item.label;
      cell.setAttribute('aria-label', item.label);
      if (item.image) {
        const image = this.node('img', 'blackout-image');
        image.src = item.image;
        image.alt = '';
        image.loading = 'eager';
        image.decoding = 'async';
        cell.append(image);
      } else cell.append(this.node('span', 'blackout-mark', item.label.slice(0, 1)));
      this.cells.set(item.id, cell);
      this.grid.append(cell);
    }
    stage.append(this.grid);
    this.host.append(stage);
    await this.delay(120);
  }

  async reveal(result) {
    if (this.destroyed || !this.cells) return;
    const winners = new Set(result.items.map(({ id }) => id));
    const eliminated = [...this.cells.entries()].filter(([id]) => !winners.has(id));
    for (let index = eliminated.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [eliminated[index], eliminated[swap]] = [eliminated[swap], eliminated[index]];
    }
    let cursor = 0;
    for (let round = 0; round < 7 && cursor < eliminated.length; round += 1) {
      if (this.destroyed) return;
      const batchSize = Math.max(1, Math.ceil((eliminated.length - cursor) / (7 - round)));
      const batch = eliminated.slice(cursor, cursor + batchSize);
      batch.forEach(([, cell], index) => {
        cell.style.setProperty('--blackout-delay', `${Math.min(index * 12, 120)}ms`);
        cell.classList.add('is-out');
      });
      cursor += batch.length;
      await this.delay(145);
    }
    for (const id of winners) this.cells.get(id)?.classList.add('is-winner');
    await this.delay(560);
    if (!this.destroyed) this.renderResults(result);
  }

  preview(pool) {
    this.reset();
    const preview = this.node('div', 'renderer-preview blackout-preview');
    for (let index = 0; index < 12; index += 1) {
      const cell = this.node('span', `blackout-preview-cell${[1, 4, 7, 10].includes(index) ? ' is-off' : ''}`);
      cell.textContent = pool[index]?.label?.slice(0, 1) || '•';
      preview.append(cell);
    }
    preview.setAttribute('aria-label', 'Vista previa de una cuadrícula que se apaga');
    this.host.append(preview);
  }
}
