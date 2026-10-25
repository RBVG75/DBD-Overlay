import { DrawRenderer } from './draw-renderer.js';

export default class SummonPortalRenderer extends DrawRenderer {
  static id = 'summon-portal';
  static label = 'Portal de invocación';
  static description = 'El asesino emerge del portal y sus perks se materializan alrededor.';
  static modes = ['random-killer', 'killer-and-perks'];

  async start(pool) {
    this.reset();
    this.pool = [...pool];
    this.stage = this.node('div', 'portal-stage');
    this.stage.append(this.node('p', 'draw-renderer-kicker', 'ABRIENDO EL PORTAL'));
    this.scene = this.node('div', 'portal-scene');
    this.ring = this.node('span', 'portal-ring');
    this.core = this.node('span', 'portal-core');
    this.figure = this.node('span', 'portal-figure');
    this.figure.append(this.node('span', 'portal-figure-mark', '✦'));
    this.scene.append(this.ring, this.core, this.figure);
    for (let index = 0; index < 14; index += 1) {
      const spark = this.node('i', 'portal-spark');
      spark.style.setProperty('--spark-x', `${((index * 47) % 88) + 6}%`);
      spark.style.setProperty('--spark-delay', `${(index % 7) * -180}ms`);
      this.scene.append(spark);
    }
    this.stage.append(this.scene);
    this.host.append(this.stage);
    await this.delay(700);
  }

  async reveal(result) {
    if (this.destroyed || !this.scene) return;
    const killer = result.items.find((item) => item.kind !== 'perk');
    const perks = result.items.filter((item) => item.kind === 'perk');
    if (killer) {
      this.figure.replaceChildren();
      if (killer.image) {
        const image = this.node('img', 'portal-portrait');
        image.src = killer.image;
        image.alt = '';
        image.loading = 'eager';
        image.decoding = 'async';
        this.figure.append(image);
      } else this.figure.append(this.node('strong', 'portal-figure-mark', killer.label.slice(0, 1)));
      this.figure.title = killer.label;
    }
    this.scene.classList.add('is-charging');
    await this.delay(900);
    if (this.destroyed) return;
    this.scene.classList.add('is-opening');
    await this.delay(1000);
    if (this.destroyed) return;

    const runes = this.node('div', 'portal-runes');
    perks.forEach((perk, index) => {
      const rune = this.node('span', 'portal-rune');
      const angle = -145 + (index / Math.max(1, perks.length - 1)) * 290;
      const radians = angle * Math.PI / 180;
      rune.style.setProperty('--rune-x', `${(Math.cos(radians) * 150).toFixed(1)}px`);
      rune.style.setProperty('--rune-y', `${(Math.sin(radians) * 74).toFixed(1)}px`);
      if (perk.image) {
        const image = this.node('img');
        image.src = perk.image;
        image.alt = '';
        image.loading = 'eager';
        rune.append(image);
      } else rune.append(this.node('span', '', '✦'));
      rune.title = perk.label;
      rune.style.setProperty('--rune-delay', `${index * 220}ms`);
      runes.append(rune);
    });
    this.scene.append(runes);
    await this.delay(Math.max(1000, perks.length * 220 + 650));
    if (this.destroyed) return;
    this.scene.classList.add('is-stable');
    await this.delay(900);
    if (!this.destroyed) this.renderResults(result);
  }

  preview(pool) {
    this.reset();
    const preview = this.node('div', 'renderer-preview portal-preview');
    preview.append(this.node('span', 'portal-preview-ring'), this.node('span', 'portal-preview-core'), this.node('span', 'portal-preview-figure'));
    preview.setAttribute('aria-label', `Vista previa de invocación para ${pool.length} asesinos`);
    this.host.append(preview);
  }
}
