import { DrawRenderer } from './draw-renderer.js';

export default class ListRevealRenderer extends DrawRenderer {
  static id = 'list-reveal';
  static label = 'Lista / tómbola';
  static description = 'Nombres que pasan rápido por pantalla y frenan en el resultado.';

  async start(pool) {
    this.reset();
    this.pool = [...pool];
    const hasKiller = pool.some((item) => item.kind !== 'perk');
    this.animationPool = hasKiller ? pool.filter((item) => item.kind !== 'perk') : this.pool;
    const list = this.node('div', 'list-reveal-view');
    list.append(this.node('p', 'draw-renderer-kicker', hasKiller ? 'BUSCANDO KILLER' : 'SORTEANDO DEL POOL'));
    const currentRow = this.node('div', 'list-reveal-current-row');
    this.currentImage = this.node('img', 'list-reveal-image');
    this.currentImage.alt = '';
    this.current = this.node('strong', 'list-reveal-current', pool[0]?.label || 'Sin opciones');
    if (pool[0]?.image) {
      this.currentImage.src = pool[0].image;
      this.currentImage.classList.add('has-image');
    }
    currentRow.append(this.currentImage, this.current);
    list.append(currentRow);
    const count = this.node('span', 'list-reveal-count', `${this.animationPool.length} ${hasKiller ? 'killers' : 'opciones'}`);
    list.append(count);
    this.host.append(list);
    await this.delay(120);
  }

  async reveal(result) {
    if (this.destroyed || !result.items.length) return;
    const steps = this.context.reduceMotion ? 1 : 22;
    this.current?.classList.add('is-rolling');
    for (let step = 0; step < steps; step += 1) {
      if (this.destroyed) return;
      const item = step === steps - 1 ? result.items[0] : this.animationPool[Math.floor(Math.random() * this.animationPool.length)];
      if (this.current) {
        this.current.textContent = item.label;
        this.current.classList.toggle('is-perk', item.kind === 'perk');
        this.currentImage.src = item.image || '';
        this.currentImage.classList.toggle('has-image', Boolean(item.image));
      }
      await this.delay(Math.round(38 + (step / steps) ** 2 * 160));
    }
    this.current?.classList.remove('is-rolling');
    this.renderResults(result);
  }

  preview(pool) {
    this.reset();
    const preview = this.node('div', 'renderer-preview list-preview');
    for (let index = 0; index < 3; index += 1) {
      preview.append(this.node('span', index === 1 ? 'preview-list-row is-current' : 'preview-list-row', pool[index]?.label || 'Perk'));
    }
    this.host.append(preview);
  }
}
