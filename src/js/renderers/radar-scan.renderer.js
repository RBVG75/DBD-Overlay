import { DrawRenderer } from './draw-renderer.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export default class RadarScanRenderer extends DrawRenderer {
  static id = 'radar-scan';
  static label = 'Barrido de radar';
  static description = 'Un barrido localiza y fija los iconos elegidos.';

  async start(pool) {
    this.reset();
    this.pool = [...pool];
    const stage = this.node('div', 'radar-stage');
    stage.append(this.node('p', 'draw-renderer-kicker', 'RASTREANDO PARTICIPANTES'));
    this.scope = this.node('div', 'radar-scope is-scanning');
    this.scope.setAttribute('role', 'img');
    this.scope.setAttribute('aria-label', `Radar con ${pool.length} participantes`);
    this.scope.append(this.node('span', 'radar-cross radar-cross-x'), this.node('span', 'radar-cross radar-cross-y'));
    const sweep = this.node('span', 'radar-sweep');
    sweep.setAttribute('aria-hidden', 'true');
    this.scope.append(sweep);
    this.blips = new Map();
    const count = Math.max(1, pool.length);
    pool.forEach((item, index) => {
      const angle = index * GOLDEN_ANGLE - Math.PI / 2;
      const radius = 0.88 * Math.sqrt((index + 0.5) / count);
      const x = 50 + Math.cos(angle) * radius * 50;
      const y = 50 + Math.sin(angle) * radius * 50;
      const blip = this.node('span', 'radar-blip');
      blip.dataset.itemId = item.id;
      blip.dataset.kind = item.kind;
      blip.title = item.label;
      blip.style.setProperty('--blip-x', `${x.toFixed(2)}%`);
      blip.style.setProperty('--blip-y', `${y.toFixed(2)}%`);
      blip.style.setProperty('--blip-delay', `${(index % 17) * 65}ms`);
      if (item.image) {
        const image = this.node('img', 'radar-image');
        image.src = item.image;
        image.alt = '';
        image.loading = 'eager';
        image.decoding = 'async';
        blip.append(image);
      } else blip.append(this.node('span', 'radar-mark', item.label.slice(0, 1)));
      this.blips.set(item.id, blip);
      this.scope.append(blip);
    });
    stage.append(this.scope);
    this.host.append(stage);
    await this.delay(120);
  }

  async reveal(result) {
    if (this.destroyed || !this.scope) return;
    await this.delay(2200);
    if (this.destroyed) return;
    this.scope.classList.remove('is-scanning');
    this.scope.classList.add('is-locked');
    for (const item of result.items) {
      this.blips.get(item.id)?.classList.add('is-winner');
      await this.delay(125);
      if (this.destroyed) return;
    }
    const winners = new Set(result.items.map(({ id }) => id));
    for (const [id, blip] of this.blips) {
      if (!winners.has(id)) blip.classList.add('is-dim');
    }
    await this.delay(420);
    if (!this.destroyed) this.renderResults(result);
  }

  preview(pool) {
    this.reset();
    const preview = this.node('div', 'renderer-preview radar-preview');
    preview.append(this.node('span', 'radar-preview-sweep'));
    for (let index = 0; index < 5; index += 1) {
      const dot = this.node('span', index === 2 ? 'radar-preview-dot is-winner' : 'radar-preview-dot');
      dot.style.setProperty('--preview-angle', `${index * 72 - 90}deg`);
      preview.append(dot);
    }
    preview.setAttribute('aria-label', `Vista previa de radar para ${pool.length} opciones`);
    this.host.append(preview);
  }
}
