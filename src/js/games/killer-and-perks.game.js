import { GameMode, characterPerkPool, killerPool, perkPool, sampleUnique } from './game-mode.js';

export default class KillerAndPerksGame extends GameMode {
  constructor() {
    super('killer-and-perks', 'Killer + perks');
  }

  getPool(request = {}) {
    const killers = killerPool(request);
    if (request.perk_source === 'character') {
      const specific = killers.flatMap((killer) => characterPerkPool(request, killer.id).items);
      return [...killers, ...(specific.length ? specific : perkPool(request, 'killer'))];
    }
    return [...killers, ...perkPool(request)];
  }

  draw(request = {}) {
    const killer = sampleUnique(killerPool(request), 1);
    const specific = request.perk_source === 'character' && killer[0]
      ? characterPerkPool(request, killer[0].id)
      : { items: perkPool(request, request.perk_role || 'killer'), fallback: false };
    const perks = sampleUnique(specific.items, request.perk_count || 4);
    return {
      items: [...killer, ...perks],
      meta: { killerId: killer[0]?.id || null, perkCount: perks.length, perkPoolFallback: specific.fallback },
    };
  }
}
