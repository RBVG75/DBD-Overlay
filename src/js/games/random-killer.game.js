import { GameMode, killerPool, sampleUnique } from './game-mode.js';

export default class RandomKillerGame extends GameMode {
  constructor() {
    super('random-killer', 'Asesino aleatorio');
  }

  getPool(request = {}) {
    return killerPool(request);
  }

  draw(request = {}) {
    return { items: sampleUnique(this.getPool(request), 1) };
  }
}
