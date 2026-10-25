import { DrawRenderer } from './draw-renderer.js';

const REEL_CELLS = 18;
const CELL_HEIGHT = 112;

export default class SlotMachineRenderer extends DrawRenderer {
  static id = 'slot-machine';
  static label = 'Tragaperras';
  static description = 'Los rodillos giran y paran en cascada con los iconos sorteados.';

  async start(pool) {
    this.reset();
    this.pool = [...pool];
    this.root = this.node('div', 'slotm-machine');
    this.root.append(this.node('p', 'draw-renderer-kicker', 'GIRANDO LOS RODILLOS'));
    this.reels = this.node('div', 'slotm-reels');
    for (let index = 0; index < 3; index += 1) {
      const reel = this.node('div', 'slotm-reel is-idle');
      const item = pool[index % pool.length];
      reel.append(this.makeCell(item));
      this.reels.append(reel);
    }
    this.root.append(this.reels, this.node('span', 'slotm-machine-lights', '✦  ✦  ✦  ✦  ✦'));
    this.host.append(this.root);
    await this.delay(140);
  }

  makeCell(item) {
    const cell = this.node('div', 'slotm-cell');
    if (item?.kind) cell.dataset.kind = item.kind;
    if (item?.image) {
      const image = this.node('img', 'slotm-image');
      image.src = item.image;
      image.alt = '';
      image.loading = 'eager';
      image.decoding = 'async';
      cell.append(image);
    } else cell.append(this.node('span', 'slotm-mark', item?.label?.slice(0, 1) || '✦'));
    cell.append(this.node('strong', 'slotm-name', item?.label || 'SORTEO'));
    return cell;
  }

  async reveal(result) {
    if (this.destroyed || !this.root) return;
    const reels = this.node('div', 'slotm-reels');
    const strips = [];
    result.items.forEach((winner, index) => {
      const reel = this.node('div', 'slotm-reel');
      const strip = this.node('div', 'slotm-strip');
      for (let cellIndex = 0; cellIndex < REEL_CELLS - 1; cellIndex += 1) {
        const item = this.pool[(cellIndex * 7 + index * 11) % this.pool.length];
        strip.append(this.makeCell(item));
      }
      strip.append(this.makeCell(winner));
      strip.style.setProperty('--reel-index', index);
      strip.style.setProperty('--reel-delay', `${index * 150}ms`);
      strip.style.setProperty('--stop-y', `${-(REEL_CELLS - 1) * CELL_HEIGHT}px`);
      reel.append(strip);
      reels.append(reel);
      strips.push(strip);
    });
    this.reels.replaceWith(reels);
    this.reels = reels;
    const duration = 2200;
    const spacing = 190;
    if (this.context.reduceMotion) {
      strips.forEach((strip) => { strip.style.transform = `translateY(${strip.style.getPropertyValue('--stop-y')})`; });
      await this.delay(160);
    } else {
      this.animations = strips.map((strip) => strip.animate(
        [
          { transform: 'translateY(0px)' },
          { transform: `translateY(${strip.style.getPropertyValue('--stop-y')})` },
        ],
        {
          duration,
          delay: Number(strip.style.getPropertyValue('--reel-index')) * spacing,
          easing: 'cubic-bezier(.1,.72,.06,1)',
          fill: 'forwards',
        },
      ));
      await Promise.all(this.animations.map((animation) => animation.finished.catch(() => undefined)));
      if (this.destroyed) return;
      strips.forEach((strip) => {
        strip.style.transform = `translateY(${strip.style.getPropertyValue('--stop-y')})`;
      });
      this.animations.forEach((animation) => animation.cancel());
      this.animations = [];
    }
    if (!this.destroyed) this.renderResults(result);
  }

  destroy() {
    this.animations?.forEach((animation) => animation.cancel());
    this.animations = [];
    super.destroy();
  }

  preview(pool) {
    this.reset();
    const preview = this.node('div', 'renderer-preview slotm-preview');
    for (let index = 0; index < 3; index += 1) {
      const cell = this.node('span', index === 1 ? 'slotm-preview-cell is-center' : 'slotm-preview-cell');
      cell.textContent = pool[index]?.label?.slice(0, 1) || '✦';
      preview.append(cell);
    }
    preview.setAttribute('aria-label', 'Vista previa de tragaperras con tres rodillos');
    this.host.append(preview);
  }
}
