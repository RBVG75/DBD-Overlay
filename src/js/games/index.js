const modules = import.meta.glob('./*.game.js', { eager: true });

export const gameModes = new Map(
  Object.values(modules)
    .map((module) => new module.default())
    .map((mode) => [mode.id, mode]),
);
