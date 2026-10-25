import { DrawRenderer } from './draw-renderer.js';

export default class SpotlightSearchRenderer extends DrawRenderer {
  static id = 'spotlight-search';
  static label = 'Reflectores';
  static description = 'Los reflectores buscan entre los retratos hasta iluminar el resultado.';

  async start(pool) {
    this.reset();
    this.pool = [...pool];
    const stage = this.node('div', 'spotlight-stage');
    stage.append(this.node('p', 'draw-renderer-kicker', 'BUSCANDO ENTRE EL POOL'));
    this.room = this.node('div', 'spotlight-room');
    this.room.style.setProperty('--spot-cell', pool.length > 100 ? '20px' : pool.length > 44 ? '29px' : '40px');
    this.faces = new Map();
    pool.forEach((item, index) => {
      const face = this.node('span', 'spotlight-face');
      face.dataset.itemId = item.id;
      face.dataset.kind = item.kind;
      face.title = item.label;
      if (item.image) {
        const image = this.node('img', 'spotlight-image');
        image.src = item.image;
        image.alt = '';
        image.loading = 'eager';
        image.decoding = 'async';
        face.append(image);
      } else face.append(this.node('span', 'spotlight-mark', item.label.slice(0, 1)));
      this.faces.set(item.id, face);
      this.room.append(face);
    });
    this.beams = [];
    for (let index = 0; index < 3; index += 1) {
      const beam = this.node('span', `spotlight-beam beam-${index + 1}`);
      beam.setAttribute('aria-hidden', 'true');
      this.beams.push(beam);
      this.room.append(beam);
    }
    stage.append(this.room);
    this.host.append(stage);
    await this.delay(100);
  }

  async reveal(result) {
    if (this.destroyed || !this.room) return;
    const roomRect = this.room.getBoundingClientRect();
    const winners = new Set(result.items.map(({ id }) => id));
    const decoys = this.pool.filter((item) => !winners.has(item.id));
    for (let index = decoys.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [decoys[index], decoys[other]] = [decoys[other], decoys[index]];
    }
    const searchPasses = decoys.length ? Math.min(9, Math.max(6, decoys.length)) : 6;
    for (let pass = 0; pass < searchPasses; pass += 1) {
      const decoy = decoys[pass % decoys.length];
      const face = decoy && this.faces.get(decoy.id);
      if (!face) continue;
      const rect = face.getBoundingClientRect();
      const x = rect.left + rect.width / 2 - (roomRect.left + roomRect.width / 2);
      const y = rect.top + rect.height / 2 - (roomRect.top + roomRect.height / 2);
      this.beams.forEach((beam, beamIndex) => {
        beam.classList.add('is-targeting');
        beam.style.setProperty('--spot-x', `${x + (beamIndex - 1) * 12}px`);
        beam.style.setProperty('--spot-y', `${y + (beamIndex - 1) * 8}px`);
      });
      face.classList.add('is-search-hit');
      await this.delay(420 + Math.min(180, pass * 22));
      if (this.destroyed) return;
      face.classList.remove('is-search-hit');
    }

    for (const item of result.items) {
      const face = this.faces.get(item.id);
      if (!face) continue;
      const rect = face.getBoundingClientRect();
      const x = rect.left + rect.width / 2 - (roomRect.left + roomRect.width / 2);
      const y = rect.top + rect.height / 2 - (roomRect.top + roomRect.height / 2);
      for (const beam of this.beams) {
        beam.classList.add('is-targeting');
        beam.style.setProperty('--spot-x', `${x}px`);
        beam.style.setProperty('--spot-y', `${y}px`);
      }
      face.classList.add('is-found');
      await this.delay(850);
      if (this.destroyed) return;
    }
    this.room.classList.add('is-settled');
    for (const [id, face] of this.faces) {
      if (!winners.has(id)) face.classList.add('is-dim');
    }
    await this.delay(1200);
    if (!this.destroyed) this.renderResults(result);
  }

  preview(pool) {
    this.reset();
    const preview = this.node('div', 'renderer-preview spotlight-preview');
    for (let index = 0; index < 12; index += 1) {
      const face = this.node('span', `spotlight-preview-face${index === 5 ? ' is-lit' : ''}`);
      preview.append(face);
    }
    preview.setAttribute('aria-label', `Vista previa de reflector para ${pool.length} participantes`);
    this.host.append(preview);
  }
}
