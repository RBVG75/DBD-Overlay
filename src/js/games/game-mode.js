import { KILLERS } from '../catalog.js';
import { KILLER_PERKS, PERK_DATA, SURVIVOR_PERKS } from '../game-data.js';

/** @typedef {{id:string,label:string,kind:'killer'|'perk'|'survivor',image?:string,accent?:string,meta?:Object}} DrawItem */
/** @typedef {{items:DrawItem[],meta?:Object}} DrawResult */

export class GameMode {
  constructor(id, label) {
    this.id = id;
    this.label = label;
  }

  /** @param {Object} request @returns {DrawItem[]} */
  getPool(_request = {}) {
    throw new Error(`${this.id}.getPool() must be implemented`);
  }

  /** @param {Object} request @returns {DrawResult} */
  draw(_request = {}) {
    throw new Error(`${this.id}.draw() must be implemented`);
  }
}

export function killerItem(character) {
  return {
    id: character.id,
    label: character.name,
    kind: 'killer',
    image: `/${character.file}`,
    meta: { characterId: character.id },
  };
}

export function perkItem(name, role) {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const assets = role === 'killer' ? PERK_DATA.killer : PERK_DATA.survivor;
  const asset = assets.find((entry) => entry.name === name);
  return {
    id: asset ? `perk-${asset.id}` : `${role}-perk-${slug}`,
    label: name,
    kind: 'perk',
    ...(asset ? { image: asset.image, accent: '#d5b875' } : {}),
    meta: { role, aliases: asset?.aliases || [] },
  };
}

export function killerPool(request = {}) {
  const enabled = Array.isArray(request.killer_ids) ? request.killer_ids : KILLERS.map(({ id }) => id);
  return KILLERS.filter((character) => enabled.includes(character.id)).map(killerItem);
}

export function perkPool(request = {}, role = request.perk_role || 'killer') {
  const roles = role === 'mixed' ? ['killer', 'survivor'] : [role];
  const items = roles.flatMap((currentRole) => {
    const property = currentRole === 'killer' ? 'killer_perks' : 'survivor_perks';
    const customProperty = currentRole === 'killer' ? 'custom_killer_perks' : 'custom_survivor_perks';
    const available = currentRole === 'killer' ? KILLER_PERKS : SURVIVOR_PERKS;
    const names = [...available, ...(Array.isArray(request[customProperty]) ? request[customProperty] : [])];
    const enabled = Array.isArray(request[property]) ? request[property] : names;
    return names.filter((name, index) => names.indexOf(name) === index && enabled.includes(name))
      .map((name) => perkItem(name, currentRole));
  });
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function characterPerkPool(request = {}, killerId) {
  const owners = PERK_DATA.byKiller && PERK_DATA.byKiller[killerId];
  const enabled = Array.isArray(request.killer_perks) ? request.killer_perks : KILLER_PERKS;
  const names = Array.isArray(owners) ? owners.filter((name) => enabled.includes(name)) : [];
  if (names.length) return { items: names.map((name) => perkItem(name, 'killer')), fallback: false };
  return { items: perkPool(request, 'killer'), fallback: true };
}

export function sampleUnique(pool, count = 1) {
  const copy = [...pool];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy.slice(0, Math.max(0, Math.min(Math.floor(count), copy.length)));
}
