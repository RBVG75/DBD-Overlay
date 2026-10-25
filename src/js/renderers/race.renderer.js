import { DrawRenderer } from './draw-renderer.js';

export default class RaceRenderer extends DrawRenderer {
  static id = 'race';
  static label = 'Carrera';
  static description = 'Todos los killers compiten por llegar a la meta.';
  static modes = ['random-killer'];

  makeLane(item) {
    const lane = this.node('div', 'race-lane');
    lane.dataset.itemId = item.id;
    lane.append(this.makeItem(item, 'race-contestant'));
    const path = this.node('div', 'race-track');
    const runner = this.node('span', 'race-runner');
    runner.textContent = item.image ? '' : item.label.slice(0, 1);
    if (item.image) {
      const image = this.node('img', 'race-runner-image');
      image.src = item.image;
      image.alt = '';
      runner.append(image);
    }
    path.append(runner, this.node('span', 'race-finish-line', '🏁'));
    lane.append(path);
    return lane;
  }

  async start(pool) {
    this.reset();
    this.pool = [...pool];
    this.contestants = [...pool];
    for (let index = this.contestants.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [this.contestants[index], this.contestants[other]] = [this.contestants[other], this.contestants[index]];
    }
    this.contestants = this.contestants.slice(0, 10);
    const board = this.node('div', 'race-board');
    const track = this.node('div', 'race-lanes');
    for (const item of this.contestants) track.append(this.makeLane(item));
    const extra = Math.max(0, pool.length - this.contestants.length);
    board.append(this.node('p', 'draw-renderer-kicker', '¡A LA LÍNEA DE SALIDA!'), track);
    if (extra) board.append(this.node('small', 'race-pool-note', `10 corredores · ${extra} más en el pool`));
    this.host.append(board);
    await this.delay(120);
  }

  async reveal(result) {
    const winner = result.items[0];
    if (!winner || this.destroyed) return;
    if (!this.contestants.some((item) => item.id === winner.id)) {
      const lane = this.host.querySelector('.race-lane:last-child');
      if (lane) {
        lane.replaceWith(this.makeLane(winner));
        this.contestants[this.contestants.length - 1] = winner;
      }
    }
    const lanes = [...this.host.querySelectorAll('.race-lane')];
    for (const lane of lanes) {
      const isWinner = lane.dataset.itemId === winner.id;
      const progress = isWinner ? 93 : 30 + Math.random() * 58;
      lane.querySelector('.race-runner')?.style.setProperty('--race-progress', `${progress}%`);
      lane.dataset.isWinner = String(isWinner);
    }
    await this.delay(2700);
    if (!this.destroyed) {
      for (const lane of lanes) lane.classList.toggle('is-winner', lane.dataset.isWinner === 'true');
      this.renderResults(result);
    }
  }

  preview(pool) {
    this.reset();
    const preview = this.node('div', 'renderer-preview race-preview');
    for (let index = 0; index < 4; index += 1) {
      const lane = this.node('span', 'preview-race-lane');
      const runner = this.node('i');
      runner.style.setProperty('--preview-progress', `${[60, 34, 78, 48][index]}%`);
      lane.append(runner);
      preview.append(lane);
    }
    const first = pool[0];
    preview.setAttribute('aria-label', first ? `${first.label} en una carrera` : 'Vista previa de carrera');
    this.host.append(preview);
  }
}
