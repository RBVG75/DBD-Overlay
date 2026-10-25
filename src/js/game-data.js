import { PERK_ASSETS } from 'virtual:perk-assets';
import PERK_METADATA from '../data/perks.json';
import { KILLERS, SURVIVORS } from './catalog.js';

// Vite indexes every unique perk image. JSON supplies polished legacy labels
// and optional killer-to-perk associations; the image folders are the full pool.
export const PERK_DATA = { ...PERK_ASSETS, byKiller: PERK_METADATA.byKiller || {} };
export const KILLER_PERK_ITEMS = PERK_DATA.killer;
export const SURVIVOR_PERK_ITEMS = PERK_DATA.survivor;
export const KILLER_PERKS = KILLER_PERK_ITEMS.map(({ name }) => name);
export const SURVIVOR_PERKS = SURVIVOR_PERK_ITEMS.map(({ name }) => name);
export const LEGACY_KILLER_PERKS = PERK_METADATA.labelOverrides.killer;
export const LEGACY_SURVIVOR_PERKS = PERK_METADATA.labelOverrides.survivor;

export const DEFAULT_GAME_TOOLS = {
  game_mode: 'random-killer',
  renderer: 'roulette',
  killer_ids: KILLERS.map(({ id }) => id),
  survivor_ids: SURVIVORS.map(({ id }) => id),
  custom_killer_perks: [],
  custom_survivor_perks: [],
  killer_perks: [...KILLER_PERKS],
  survivor_perks: [...SURVIVOR_PERKS],
  perk_count: 4,
  perk_role: 'killer',
  perk_source: 'pool',
};
