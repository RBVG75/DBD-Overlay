import { DrawRenderer } from './draw-renderer.js';

export default class BallDrumRenderer extends DrawRenderer {
  static id = 'ball-drum';
  static label = 'Tambor de bolas';
  static description = 'El pool se agita dentro del bombo y los resultados salen por la compuerta.';

  async start(pool) {
    this.reset();
    this.pool = [...pool];
    this.sprites = new Map();
    for (const item of pool) {
      if (!item.image || this.sprites.has(item.id)) continue;
      const sprite = new Image();
      sprite.decoding = 'async';
      sprite.src = item.image;
      this.sprites.set(item.id, sprite);
    }
    const scene = this.node('div', 'ball-drum-scene');
    scene.append(this.node('p', 'draw-renderer-kicker', 'MEZCLANDO PERSONAJE Y PERKS'));
    const frame = this.node('div', 'ball-drum-frame');
    this.canvas = this.node('canvas', 'ball-drum-canvas');
    this.canvas.setAttribute('aria-label', `Tambor con ${pool.length} bolas de sorteo`);
    frame.append(this.canvas, this.node('span', 'ball-drum-mouth', '▼'));
    scene.append(frame);
    this.host.append(scene);
    this.startPhysics();
    await this.delay(1250);
  }

  startPhysics() {
    const canvas = this.canvas;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, rect.width || 520);
    const height = Math.max(200, rect.height || 250);
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    const cx = width * 0.5;
    const cy = height * 0.49;
    const rx = width * 0.43;
    const ry = height * 0.4;
    const radius = Math.max(5, Math.min(10, 205 / Math.sqrt(Math.max(1, this.pool.length))));
    this.balls = this.pool.map((item) => {
      let x = cx;
      let y = cy;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        x = cx + (Math.random() * 2 - 1) * rx;
        y = cy + (Math.random() * 2 - 1) * ry;
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 0.84) break;
      }
      return {
        item,
        sprite: this.sprites?.get(item.id) || null,
        x,
        y,
        vx: (Math.random() - 0.5) * 4.5,
        vy: (Math.random() - 0.5) * 4.5,
        radius,
      };
    });

    const frame = (schedule = true) => {
      if (this.destroyed || (!this.rolling && schedule)) return;
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 8, ry + 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(8, 8, 12, .86)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = this.context.accent || '#c52d35';
      ctx.stroke();
      const now = performance.now();
      for (const ball of this.balls) {
        ball.vx += Math.sin(now / 340 + ball.y) * 0.065;
        ball.vy += 0.055;
        ball.vx *= 0.995;
        ball.vy *= 0.995;
        ball.x += ball.vx;
        ball.y += ball.vy;
        const nx = (ball.x - cx) / rx;
        const ny = (ball.y - cy) / ry;
        const edge = nx * nx + ny * ny;
        if (edge > 0.89) {
          const normalLength = Math.hypot(nx / rx, ny / ry) || 1;
          const normalX = (nx / rx) / normalLength;
          const normalY = (ny / ry) / normalLength;
          const dot = ball.vx * normalX + ball.vy * normalY;
          ball.vx -= 1.82 * dot * normalX;
          ball.vy -= 1.82 * dot * normalY;
          ball.x -= normalX * 2;
          ball.y -= normalY * 2;
        }
        const colors = ball.item.kind === 'perk' ? ['#f5d99a', '#8c6a39'] : [this.context.accent || '#c52d35', '#541923'];
        const gradient = ctx.createRadialGradient(ball.x - 2, ball.y - 3, 1, ball.x, ball.y, ball.radius);
        gradient.addColorStop(0, '#fff7');
        gradient.addColorStop(0.35, colors[0]);
        gradient.addColorStop(1, colors[1]);
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        this.paintBallFace(ctx, ball);
      }
      if (schedule) this.raf = requestAnimationFrame(frame);
    };
    this.rolling = true;
    if (this.context.reduceMotion) {
      frame(false);
      this.rolling = false;
    } else this.raf = requestAnimationFrame(frame);
  }

  /** Draws the participant portrait inside the ball, keeping the sphere shading on top. */
  paintBallFace(ctx, ball) {
    const sprite = ball.sprite;
    const ready = sprite && sprite.complete && sprite.naturalWidth > 0;
    if (ready && ball.radius >= 6) {
      const side = Math.min(sprite.naturalWidth, sprite.naturalHeight);
      const sourceX = (sprite.naturalWidth - side) / 2;
      const sourceY = (sprite.naturalHeight - side) * (ball.item.kind === 'perk' ? 0.5 : 0.18);
      const radius = ball.radius * 0.92;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(sprite, sourceX, sourceY, side, side, ball.x - radius, ball.y - radius, radius * 2, radius * 2);
      ctx.restore();
    } else if (ball.radius >= 7) {
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.max(6, ball.radius - 2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ball.item.kind === 'perk' ? '✦' : ball.item.label.slice(0, 1), ball.x, ball.y + 0.5);
    }
    if (ready && ball.radius >= 6) {
      const shade = ctx.createRadialGradient(
        ball.x - ball.radius * 0.35, ball.y - ball.radius * 0.4, ball.radius * 0.1,
        ball.x, ball.y, ball.radius,
      );
      shade.addColorStop(0, 'rgba(255,255,255,.22)');
      shade.addColorStop(0.55, 'rgba(255,255,255,0)');
      shade.addColorStop(1, 'rgba(0,0,0,.5)');
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = shade;
      ctx.fill();
    }
  }

  async reveal(result) {
    if (this.destroyed) return;
    this.rolling = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.host.querySelector('.ball-drum-scene')?.classList.add('has-result');
    const exit = this.node('div', 'ball-drum-exit');
    for (const item of result.items) {
      const token = this.node('span', 'ball-drum-result-ball');
      token.dataset.kind = item.kind;
      token.title = item.label;
      if (item.image) {
        const image = this.node('img', 'ball-drum-ball-image');
        image.src = item.image;
        image.alt = '';
        token.append(image);
      } else token.textContent = item.kind === 'perk' ? '✦' : item.label.slice(0, 1);
      exit.append(token);
    }
    this.host.querySelector('.ball-drum-scene')?.append(exit);
    await this.delay(1050);
    if (!this.destroyed) this.renderResults(result);
  }

  preview(pool) {
    this.reset();
    const preview = this.node('div', 'renderer-preview drum-preview');
    for (let index = 0; index < 9; index += 1) {
      const ball = this.node('i', index % 3 === 0 ? 'is-perk' : '');
      ball.textContent = pool[index]?.kind === 'perk' ? '✦' : '';
      preview.append(ball);
    }
    this.host.append(preview);
  }

  destroy() {
    super.destroy();
    this.rolling = false;
    this.sprites?.clear();
    this.balls = [];
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}
