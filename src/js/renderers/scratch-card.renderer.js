import { DrawRenderer } from './draw-renderer.js';

const SCRATCH_DURATION = 920;
const SCRATCH_STAGGER = 165;

export default class ScratchCardRenderer extends DrawRenderer {
  static id = 'scratch-card';
  static label = 'Tarjeta para rascar';
  static description = 'Una capa plateada se rasca sola para revelar cada icono.';

  async start(pool) {
    this.reset();
    this.pool = [...pool];
    const stage = this.node('div', 'scratch-stage');
    stage.append(this.node('p', 'draw-renderer-kicker', 'RASCA Y GANA'));
    const teaser = this.node('div', 'scratch-teaser');
    for (let index = 0; index < 3; index += 1) teaser.append(this.node('span', 'scratch-teaser-card'));
    stage.append(teaser);
    this.host.append(stage);
    await this.delay(140);
  }

  makeCard(item, index) {
    const card = this.node('article', 'scratch-card');
    card.style.setProperty('--scratch-index', index);
    const face = this.node('div', 'scratch-face');
    face.dataset.kind = item.kind;
    if (item.image) {
      const image = this.node('img', 'scratch-portrait');
      image.src = item.image;
      image.alt = '';
      image.loading = 'eager';
      image.decoding = 'async';
      face.append(image);
    } else face.append(this.node('span', 'scratch-mark', item.label.slice(0, 1)));
    face.append(this.node('strong', 'scratch-name', item.label));
    const canvas = this.node('canvas', 'scratch-layer');
    canvas.setAttribute('aria-hidden', 'true');
    card.append(face, canvas);
    return { card, canvas, context: null, width: 0, height: 0, lastPoint: null, progress: 0, item };
  }

  prepareCanvas(scratch) {
    const rect = scratch.canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    scratch.width = Math.max(1, rect.width);
    scratch.height = Math.max(1, rect.height);
    scratch.canvas.width = Math.round(scratch.width * ratio);
    scratch.canvas.height = Math.round(scratch.height * ratio);
    const ctx = scratch.canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    const metal = ctx.createLinearGradient(0, 0, scratch.width, scratch.height);
    metal.addColorStop(0, '#6b7077');
    metal.addColorStop(0.28, '#f0f2f3');
    metal.addColorStop(0.52, '#9299a1');
    metal.addColorStop(0.74, '#e3e5e7');
    metal.addColorStop(1, '#697078');
    ctx.fillStyle = metal;
    ctx.fillRect(0, 0, scratch.width, scratch.height);
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 1;
    for (let y = 4; y < scratch.height; y += 7) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(scratch.width, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(20,24,29,.82)';
    ctx.font = '800 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RASCA AQUÍ', scratch.width / 2, scratch.height / 2);
    ctx.globalCompositeOperation = 'destination-out';
    scratch.context = ctx;
  }

  pointAt(progress, width, height) {
    const segments = 10;
    const position = Math.min(segments - 0.0001, progress * segments);
    const segment = Math.floor(position);
    const along = position - segment;
    const x = segment % 2 ? width * (1 - along) : width * along;
    const lane = segment;
    const y = height * (0.14 + (lane % 5) * 0.18);
    return { x, y };
  }

  scratchSegment(scratch, progress) {
    if (!scratch.context || progress <= scratch.progress) return;
    const next = this.pointAt(progress, scratch.width, scratch.height);
    const previous = scratch.lastPoint || next;
    const ctx = scratch.context;
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(next.x, next.y);
    ctx.lineWidth = Math.max(24, scratch.width * 0.34);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    scratch.lastPoint = next;
    scratch.progress = progress;
  }

  async reveal(result) {
    if (this.destroyed) return;
    const table = this.node('div', 'scratch-stage');
    table.append(this.node('p', 'draw-renderer-kicker', 'RASCA Y GANA'));
    const cards = this.node('div', 'scratch-cards');
    this.scratches = result.items.map((item, index) => {
      const scratch = this.makeCard(item, index);
      cards.append(scratch.card);
      return scratch;
    });
    table.append(cards);
    this.host.replaceChildren(table);
    this.scratches.forEach((scratch) => this.prepareCanvas(scratch));

    if (this.context.reduceMotion) {
      this.scratches.forEach(({ card }) => card.classList.add('is-revealed'));
      this.renderResults(result);
      return;
    }

    await new Promise((resolve) => {
      this.resolveAnimation = resolve;
      const start = performance.now();
      const total = SCRATCH_DURATION + Math.max(0, this.scratches.length - 1) * SCRATCH_STAGGER;
      const frame = (now) => {
        if (this.destroyed) {
          resolve();
          return;
        }
        const elapsed = now - start;
        for (const [index, scratch] of this.scratches.entries()) {
          const progress = Math.max(0, Math.min(1, (elapsed - index * SCRATCH_STAGGER) / SCRATCH_DURATION));
          this.scratchSegment(scratch, progress);
          if (progress >= 1) scratch.card.classList.add('is-revealed');
        }
        if (elapsed < total) this.raf = requestAnimationFrame(frame);
        else resolve();
      };
      this.raf = requestAnimationFrame(frame);
    });
    this.resolveAnimation = null;
    if (this.destroyed) return;
    await this.delay(320);
    if (!this.destroyed) this.renderResults(result);
  }

  preview(pool) {
    this.reset();
    const preview = this.node('div', 'renderer-preview scratch-preview');
    preview.append(this.node('span', 'scratch-preview-face', pool[0]?.label?.slice(0, 1) || '✦'), this.node('span', 'scratch-preview-metal', 'RASCA'));
    preview.setAttribute('aria-label', 'Vista previa de tarjeta para rascar');
    this.host.append(preview);
  }

  destroy() {
    super.destroy();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resolveAnimation?.();
    this.resolveAnimation = null;
  }
}
