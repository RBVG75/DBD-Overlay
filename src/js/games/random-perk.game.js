import { GameMode, perkPool, sampleUnique } from './game-mode.js';

export default class RandomPerkGame extends GameMode {
  constructor() {
    super('random-perk', 'Perks al azar');
  }

  getPool(request = {}) {
    return perkPool(request);
  }

  draw(request = {}) {
    return { items: sampleUnique(this.getPool(request), request.perk_count || 4) };
  }
}
