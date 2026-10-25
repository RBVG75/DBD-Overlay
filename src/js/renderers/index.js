const modules = import.meta.glob('./*.renderer.js', { eager: true });

export const rendererClasses = new Map(
  Object.values(modules)
    .map((module) => module.default)
    .map((Renderer) => [Renderer.id, Renderer]),
);

export function rendererSupportsMode(id, modeId) {
  const Renderer = rendererClasses.get(id);
  return Boolean(Renderer && (!Array.isArray(Renderer.modes) || Renderer.modes.includes(modeId)));
}

export function createRenderer(id, host, context) {
  const Renderer = rendererClasses.get(id);
  if (!Renderer) throw new Error(`Renderer «${id}» no registrado`);
  return new Renderer(host, context);
}
