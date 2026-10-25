import { gameModes } from './games/index.js';
import { createRenderer, rendererSupportsMode } from './renderers/index.js';

export class DrawController {
  constructor({ stage, getContext }) {
    this.stage = stage;
    this.getContext = getContext;
    this.renderer = null;
    this.sequence = 0;
  }

  async draw(gameModeId, rendererId, request) {
    this.cancel();
    const sequence = this.sequence;
    const gameMode = gameModes.get(gameModeId);
    if (!gameMode) throw new Error(`Tipo de juego «${gameModeId}» no registrado`);
    if (!rendererSupportsMode(rendererId, gameModeId)) {
      throw new Error(`El estilo «${rendererId}» no está disponible para este tipo de sorteo.`);
    }
    const pool = gameMode.getPool(request);
    if (!pool.length) throw new Error('El pool está vacío. Activa alguna opción antes de sortear.');
    this.renderer = createRenderer(rendererId, this.stage, this.getContext());
    await this.renderer.start(pool);
    if (sequence !== this.sequence || this.renderer.destroyed) return null;
    const result = gameMode.draw(request);
    await this.renderer.reveal(result);
    return sequence === this.sequence ? result : null;
  }

  cancel() {
    this.sequence += 1;
    if (this.renderer) this.renderer.destroy();
    this.renderer = null;
    this.stage.replaceChildren();
  }

  preview(rendererId, host, request) {
    const gameMode = gameModes.get(request.game_mode);
    if (!rendererSupportsMode(rendererId, request.game_mode)) {
      throw new Error(`El estilo «${rendererId}» no está disponible para este tipo de sorteo.`);
    }
    const pool = gameMode ? gameMode.getPool(request) : [];
    const renderer = createRenderer(rendererId, host, this.getContext());
    renderer.preview(pool);
    renderer.destroy();
    return pool;
  }
}
