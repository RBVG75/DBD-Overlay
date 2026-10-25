// Suggested default renderer for each game. Renderer-specific mode restrictions
// are declared by the renderer itself; otherwise renderers consume generic items.
export const DEFAULT_RENDERER_BY_MODE = {
  'random-killer': 'roulette',
  'random-perk': 'card-flip',
  'killer-and-perks': 'ball-drum',
};
